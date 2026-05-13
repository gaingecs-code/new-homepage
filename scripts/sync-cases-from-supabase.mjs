/**
 * Admin CasesEditorPage.jsx 의 「배포용 분리보내기」와 동일 규칙으로
 * data/cases-list.json + data/cases/<id>.json 을 생성합니다.
 * GitHub Actions 또는 로컬에서 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 로 실행.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: row, error } = await supabase.from("app_settings").select("value").eq("key", STORAGE_KEY).maybeSingle();

  if (error) {
    console.error("Supabase 조회 실패:", error.message);
    process.exit(1);
  }
  if (!row || !row.value || typeof row.value !== "object") {
    console.error("app_settings 에서 key=", STORAGE_KEY, "인 value 가 없습니다.");
    process.exit(1);
  }

  const raw = row.value;
  const data = normalizeData({
    items: Array.isArray(raw.items) ? raw.items : [],
    updatedAt: raw.updatedAt || new Date().toISOString(),
  });

  const { listPayload, details } = buildWebCasesExport(data.items, data.updatedAt);

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
