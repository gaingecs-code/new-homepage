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
    .order("id", { ascending: true });

  if (error) {
    return { error: error.message, useRowStorage: false, data: { items: [], updatedAt: new Date().toISOString() } };
  }

  if (rows && rows.length > 0) {
    const items = rows.map((r) => {
      const p = r.payload && typeof r.payload === "object" ? { ...r.payload } : {};
      return { ...p, id: r.id, _syncVersion: r.version };
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
      items: Array.isArray(legacy.items) ? legacy.items : [],
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
