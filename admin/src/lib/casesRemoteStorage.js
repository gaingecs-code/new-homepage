import { loadRemoteJsonByKey } from "./adminRemoteJson";
import { supabase, supabaseEnabled } from "./supabase";
import { defaultCasesData } from "../data/defaultCases";

const LEGACY_STORAGE_KEY = "admin.local.cases.v1";

/** DB에 넣기 전 내부 필드 제거 */
export function casePayloadForDb(item) {
  if (!item || typeof item !== "object") return {};
  const { _syncVersion, ...rest } = item;
  return rest;
}

/** 목록 표시: 최근 수정·발행이 위로 (payload 타임스탬프 기준) */
export function sortCasesItemsNewestFirst(items) {
  const arr = Array.isArray(items) ? [...items] : [];
  function ts(it) {
    if (!it || typeof it !== "object") return 0;
    const keys = ["rowUpdatedAt", "updatedAt", "publishedAt", "createdAt"];
    for (const k of keys) {
      const v = it[k];
      if (v) {
        const t = new Date(v).getTime();
        if (Number.isFinite(t) && t > 0) return t;
      }
    }
    return 0;
  }
  arr.sort((a, b) => ts(b) - ts(a) || String(b.id || "").localeCompare(String(a.id || "")));
  return arr;
}

/**
 * @returns {Promise<{ error: string | null, useRowStorage: boolean, data: { items: unknown[], updatedAt: string } }>}
 */
export async function loadCasesAdminData() {
  if (!supabaseEnabled || !supabase) {
    return { error: null, useRowStorage: false, data: { items: [], updatedAt: new Date().toISOString() } };
  }

  const { data: rows, error } = await supabase
    .from("cases")
    .select("id, payload, version, updated_at")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    return { error: error.message, useRowStorage: false, data: { items: [], updatedAt: new Date().toISOString() } };
  }

  if (rows && rows.length > 0) {
    const items = rows.map((r) => {
      const p = r.payload && typeof r.payload === "object" ? { ...r.payload } : {};
      return { ...p, id: r.id, _syncVersion: r.version, rowUpdatedAt: r.updated_at };
    });
    const updatedAtMs = rows.reduce((m, r) => {
      const t = new Date(r.updated_at || 0).getTime();
      return Number.isFinite(t) && t > m ? t : m;
    }, 0);
    return {
      error: null,
      useRowStorage: true,
      data: {
        items,
        updatedAt: new Date(updatedAtMs || Date.now()).toISOString(),
      },
    };
  }

  // cases 가 비어 있어도 조회에 성공했다면 행 저장(RPC) 경로를 켠다.
  // 레거시 app_settings 목록은 초기 표시용이며, 임시 저장·작성 완료 시 upsert_case 로 첫 행이 생긴다.
  const legacy = await loadRemoteJsonByKey(LEGACY_STORAGE_KEY, defaultCasesData);
  return {
    error: null,
    useRowStorage: true,
    data: {
      items: sortCasesItemsNewestFirst(Array.isArray(legacy.items) ? legacy.items : []),
      updatedAt: legacy.updatedAt || new Date().toISOString(),
    },
  };
}

/**
 * @returns {Promise<{ ok: boolean, newVersion?: number, err?: string, message?: string }>}
 */
export async function upsertCaseRow(item, expectedVersion) {
  if (!supabaseEnabled || !supabase) {
    return { ok: false, err: "no_supabase", message: "Supabase가 설정되어 있지 않습니다." };
  }
  const payload = casePayloadForDb(item);
  const { data, error } = await supabase.rpc("upsert_case", {
    p_id: item.id,
    p_payload: payload,
    p_expected_version: expectedVersion,
  });

  if (error) {
    return { ok: false, err: error.code || "rpc_error", message: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { ok: false, err: "empty_response", message: "서버 응답이 비어 있습니다." };
  }
  if (row.ok === true) {
    return { ok: true, newVersion: row.new_version };
  }
  const err = row.err || "unknown";
  if (err === "version_mismatch") {
    return {
      ok: false,
      err,
      newVersion: row?.new_version,
      message: "다른 곳에서 먼저 저장되었습니다. 새로고침 후 다시 시도해 주세요.",
    };
  }
  return {
    ok: false,
    err,
    message: err === "create_requires_version_zero" ? "저장 순서 오류입니다. 새로고침 후 다시 시도해 주세요." : String(err),
  };
}

export async function deleteCaseRow(id) {
  if (!supabaseEnabled || !supabase) {
    return { error: { message: "Supabase가 설정되어 있지 않습니다." } };
  }
  return supabase.from("cases").delete().eq("id", id);
}

/**
 * @param {unknown[]} items — normalize 전/후 모두 가능. _syncVersion 은 제거됨.
 */
export async function importCasesReplaceAll(items) {
  if (!supabaseEnabled || !supabase) {
    return { error: { message: "Supabase가 설정되어 있지 않습니다." } };
  }
  const clean = (items || []).map((x) => casePayloadForDb(x));
  const { error } = await supabase.rpc("import_cases_replace_all", { p_items: clean });
  return { error };
}

const DEPLOYED_LIST_SCHEMA = "cases-list.v1";
const DEPLOYED_DETAIL_SCHEMA = "cases-detail.v1";

function escapeHtmlMinimal(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Supabase cases 조회 실패 시: 공개 API(/api/public-cases) → 배포 data/cases-list.json (+ 분리 상세) 순.
 * @returns {Promise<{ items: unknown[], updatedAt: string } | null>}
 */
export async function loadCasesItemsFromDeployedStatic() {
  if (typeof window === "undefined" || !window.location?.origin) return null;
  const origin = window.location.origin;

  const apiUrl = new URL("/api/public-cases", origin).href;
  try {
    const apiRes = await fetch(apiUrl, { cache: "no-store" });
    if (apiRes.ok) {
      const list = await apiRes.json();
      if (
        list &&
        list.ok === true &&
        list.schema === DEPLOYED_LIST_SCHEMA &&
        Array.isArray(list.items)
      ) {
        const updatedAt = list.updatedAt || new Date().toISOString();
        const merged = list.items.map((row) => {
          const contentHtml = String(row.contentHtml || "<p></p>");
          const id = row && row.id != null ? String(row.id) : "";
          return {
            ...row,
            id,
            title: row.title || "",
            authorName: row.authorName || "",
            contentHtml,
            industryTags: Array.isArray(row.industryTags) ? row.industryTags : [],
            consultingTypeTags: Array.isArray(row.consultingTypeTags) ? row.consultingTypeTags : [],
            companySize: row.companySize || "",
            thumbnailUrl: row.thumbnailUrl || "",
            featuredImageUrl: row.featuredImageUrl || "",
            imageUrl: row.imageUrl || "",
            link: row.link || "",
            slug: row.slug || "",
            publishedAt: row.publishedAt || "",
            status: "published",
            createdAt: row.publishedAt || updatedAt,
            updatedAt: row.publishedAt || updatedAt,
          };
        });
        return { items: sortCasesItemsNewestFirst(merged), updatedAt };
      }
    }
  } catch {
    /* fall through */
  }

  const listUrl = new URL("/data/cases-list.json", origin).href;
  try {
    const listRes = await fetch(listUrl, { cache: "no-store" });
    if (!listRes.ok) return null;
    const list = await listRes.json();
    if (!list || list.schema !== DEPLOYED_LIST_SCHEMA || !Array.isArray(list.items)) {
      return null;
    }
    const updatedAt = list.updatedAt || new Date().toISOString();
    if (list.items.length === 0) {
      return { items: [], updatedAt };
    }
    const detailPromises = list.items.map(async (row) => {
      const id = row && row.id;
      if (!id || String(id).trim() === "") return null;
      const detailUrl = new URL(`/data/cases/${encodeURIComponent(String(id))}.json`, origin).href;
      let detail = null;
      try {
        const dr = await fetch(detailUrl, { cache: "no-store" });
        if (dr.ok) {
          const j = await dr.json();
          if (j && j.schema === DEPLOYED_DETAIL_SCHEMA) detail = j;
        }
      } catch {
        /* ignore */
      }
      const search = String((row && row.searchText) || "").trim();
      const contentHtml =
        detail?.contentHtml ||
        (search ? `<p>${escapeHtmlMinimal(search.slice(0, 800))}</p>` : "<p></p>");
      return {
        ...row,
        ...detail,
        id: String(id),
        title: (detail && detail.title) || row.title || "",
        authorName: (detail && detail.authorName) ?? row.authorName ?? "",
        contentHtml,
        industryTags: Array.isArray(row.industryTags) ? row.industryTags : [],
        consultingTypeTags: Array.isArray(row.consultingTypeTags) ? row.consultingTypeTags : [],
        companySize: row.companySize || "",
        thumbnailUrl: row.thumbnailUrl || "",
        featuredImageUrl: row.featuredImageUrl || "",
        imageUrl: row.imageUrl || "",
        link: row.link || "",
        slug: row.slug || "",
        publishedAt: row.publishedAt || "",
        status: "published",
        createdAt: row.publishedAt || updatedAt,
        updatedAt: row.publishedAt || updatedAt,
      };
    });
    const merged = (await Promise.all(detailPromises)).filter(Boolean);
    if (merged.length === 0) return null;
    return { items: sortCasesItemsNewestFirst(merged), updatedAt };
  } catch {
    return null;
  }
}
