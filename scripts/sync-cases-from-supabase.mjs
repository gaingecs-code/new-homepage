/**
 * Admin CasesEditorPage.jsx 의 「배포용 분리보내기」와 동일 규칙으로
 * data/cases-list.json + data/cases/<id>.json 을 생성합니다.
 * 데이터 소스: public.cases 가 비어 있지 않으면 행 단위 테이블을 사용하고,
 * 비어 있으면 레거시 app_settings(admin.local.cases.v1) 를 사용합니다.
 * GitHub Actions 또는 로컬에서 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 로 실행.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ws from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const STORAGE_KEY = "admin.local.cases.v1";
const DATA_DIR = path.join(REPO_ROOT, "data");
const CASES_DIR = path.join(DATA_DIR, "cases");

function slugify(input) {
  const text = String(input || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return text || "case";
}

function blocksToHtml(blocks) {
  return (blocks || [])
    .map((block) => {
      if (block.type === "image") {
        const src = block.imageUrl || "";
        const caption = block.caption ? `<figcaption>${block.caption}</figcaption>` : "";
        return src ? `<figure><img src="${src}" style="max-width:100%;" />${caption}</figure>` : "";
      }
      return block.text ? `<p>${block.text.replace(/\n/g, "<br/>")}</p>` : "";
    })
    .join("");
}

function withDerivedFields(rawItems) {
  const items = (rawItems || []).map((item) => ({
    ...item,
    authorName: item.authorName || "",
    industryTags: Array.isArray(item.industryTags) ? item.industryTags : [],
    companySize: item.companySize || "",
    consultingTypeTags: Array.isArray(item.consultingTypeTags) ? item.consultingTypeTags : [],
    thumbnailUrl: item.thumbnailUrl || "",
    featuredImageUrl: item.featuredImageUrl || "",
    imageUrl: item.thumbnailUrl || item.featuredImageUrl || item.imageUrl || "",
    contentHtml:
      item.contentHtml ||
      blocksToHtml(item.contentBlocks) ||
      (item.content ? `<p>${String(item.content).replace(/\n/g, "<br/>")}</p>` : "<p></p>"),
  }));
  const used = new Set();
  items.forEach((item) => {
    const base = slugify(item.slug || item.title || item.id);
    let slug = base;
    let n = 2;
    while (used.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    used.add(slug);
    item.slug = slug;
  });
  items.forEach((item, index) => {
    if (!item.link) item.link = `story-testimonial-${index + 1}.html`;
  });
  return items;
}

function normalizeData(data) {
  return { ...data, items: withDerivedFields(data.items || []) };
}

function stripHtmlToSearchText(html) {
  return String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildWebCasesExport(items, updatedAt) {
  const listItems = [];
  const details = [];
  for (const item of items || []) {
    if (item.status !== "published") continue;
    const contentHtml = String(item.contentHtml || "");
    const searchText = stripHtmlToSearchText(contentHtml);
    listItems.push({
      id: item.id,
      slug: item.slug,
      title: item.title,
      authorName: item.authorName,
      industryTags: item.industryTags || [],
      companySize: item.companySize || "",
      consultingTypeTags: item.consultingTypeTags || [],
      thumbnailUrl: item.thumbnailUrl || "",
      featuredImageUrl: item.featuredImageUrl || "",
      imageUrl: item.imageUrl || "",
      link: `testimonials.html?id=${encodeURIComponent(item.id)}`,
      publishedAt: item.publishedAt || "",
      searchText,
    });
    details.push({
      filename: `cases/${item.id}.json`,
      payload: {
        schema: "cases-detail.v1",
        id: item.id,
        title: item.title,
        authorName: item.authorName || "",
        contentHtml,
      },
    });
  }
  const listPayload = {
    schema: "cases-list.v1",
    updatedAt: updatedAt || new Date().toISOString(),
    note: "게시판 목록용. 본문은 data/cases/<id>.json 에서 클릭 시 로드합니다.",
    items: listItems,
  };
  return { listPayload, details };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** @returns {Promise<{ items: unknown[], updatedAt: string, source: string } | null>} */
async function loadDatasetFromCasesTable(supabase) {
  const { data: rows, error } = await supabase
    .from("cases")
    .select("id, payload, updated_at")
    .order("id", { ascending: true });

  if (error) {
    console.warn("public.cases 조회 실패 — app_settings 로 폴백합니다:", error.message);
    return null;
  }
  if (!rows || rows.length === 0) return null;

  const items = rows.map((r) => {
    const p = r.payload && typeof r.payload === "object" ? { ...r.payload } : {};
    return { ...p, id: r.id };
  });
  const updatedAtMs = rows.reduce((m, r) => {
    const t = new Date(r.updated_at || 0).getTime();
    return t > m ? t : m;
  }, 0);

  return {
    items,
    updatedAt: new Date(updatedAtMs || Date.now()).toISOString(),
    source: "public.cases",
  };
}

/** @returns {Promise<{ items: unknown[], updatedAt: string, source: string } | null>} */
async function loadDatasetFromAppSettings(supabase) {
  const { data: row, error } = await supabase.from("app_settings").select("value").eq("key", STORAGE_KEY).maybeSingle();

  if (error) {
    console.error("Supabase(app_settings) 조회 실패:", error.message);
    return null;
  }
  if (!row || row.value === undefined || row.value === null) {
    console.error(
      "app_settings 에서 key=",
      STORAGE_KEY,
      "인 행이 없습니다. public.cases 마이그레이션 전이면 Admin 저장 또는 npm run migrate:cases-to-rows 를 실행하세요."
    );
    return null;
  }

  let rawValue = row.value;
  if (typeof rawValue === "string") {
    try {
      rawValue = JSON.parse(rawValue);
    } catch (e) {
      console.error("app_settings.value 가 JSON 문자열로 파싱되지 않습니다.");
      return null;
    }
  }
  if (!rawValue || typeof rawValue !== "object") {
    console.error("app_settings.value 가 객체가 아닙니다. (key=", STORAGE_KEY, ")");
    return null;
  }

  return {
    items: Array.isArray(rawValue.items) ? rawValue.items : [],
    updatedAt: rawValue.updatedAt || new Date().toISOString(),
    source: "app_settings",
  };
}

async function main() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    console.error("SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. (저장소 Settings → Secrets → Actions)");
    process.exit(1);
  }
  if (!/^https:\/\/.+/.test(url)) {
    console.error(
      "SUPABASE_URL 은 https:// 로 시작하는 프로젝트 URL 이어야 합니다. (JWT/eyJ 로 시작하는 값은 API 키입니다 — SUPABASE_SERVICE_ROLE_KEY 에 넣으세요.)"
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    realtime: {
      transport: ws,
    },
  });

  let dataset = await loadDatasetFromCasesTable(supabase);
  if (!dataset) {
    dataset = await loadDatasetFromAppSettings(supabase);
  }
  if (!dataset) {
    process.exit(1);
  }

  console.log("데이터 소스:", dataset.source, "| 사례", dataset.items.length, "건");

  const data = normalizeData({
    items: dataset.items,
    updatedAt: dataset.updatedAt,
  });

  const { listPayload, details } = buildWebCasesExport(data.items, data.updatedAt);

  const allowEmptyExport =
    process.argv.includes("--allow-empty-export") ||
    String(process.env.CASES_SYNC_ALLOW_EMPTY || "").trim() === "1";

  if (!details.length && !allowEmptyExport) {
    console.error(
      "발행(published) 상태 사례가 없습니다. data/cases-list.json 과 data/cases/ 를 덮어쓰거나 비우지 않고 종료합니다."
    );
    console.error(
      "의도적으로 웹 사례를 모두 비우려면 CASES_SYNC_ALLOW_EMPTY=1 또는 npm run sync-cases-data -- --allow-empty-export 를 사용하세요."
    );
    process.exit(1);
  }

  if (!details.length && allowEmptyExport) {
    console.warn("발행 사례 0건 — 빈 목록으로 동기화합니다(기존 data/cases/*.json 은 삭제됩니다).");
  }

  ensureDir(CASES_DIR);

  const publishedIds = new Set(details.map((d) => d.payload.id));
  for (const f of fs.readdirSync(CASES_DIR)) {
    if (!f.endsWith(".json")) continue;
    const id = f.replace(/\.json$/i, "");
    if (!publishedIds.has(id)) {
      fs.unlinkSync(path.join(CASES_DIR, f));
    }
  }

  fs.writeFileSync(path.join(DATA_DIR, "cases-list.json"), JSON.stringify(listPayload, null, 2) + "\n", "utf8");
  for (const row of details) {
    const id = row.payload.id;
    const filePath = path.join(CASES_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(row.payload, null, 2) + "\n", "utf8");
  }

  console.log("작성 완료: data/cases-list.json + data/cases/*.json (발행 ", publishedIds.size, "건)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
