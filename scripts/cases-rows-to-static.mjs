/**
 * cases_rows.json(Supabase보내기 형태) → data/cases-list.json + data/cases/<id>.json
 * 잘린 payload 문자열(... 로 끝남)은 문자열 필드 추출 + 불완전 img 제거로 복구합니다.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ROWS_PATH = path.join(ROOT, "cases_rows.json");
const DATA_DIR = path.join(ROOT, "data");
const CASES_DIR = path.join(DATA_DIR, "cases");

function readJsonStringField(s, key) {
  const token = `"${key}"`;
  const i = s.indexOf(token);
  if (i < 0) return "";
  let j = i + token.length;
  while (j < s.length && /\s/.test(s[j])) j++;
  if (s[j] !== ":") return "";
  j++;
  while (j < s.length && /\s/.test(s[j])) j++;
  if (s[j] !== '"') return "";
  j++;
  let out = "";
  while (j < s.length) {
    const c = s[j];
    if (c === "\\") {
      j++;
      if (j >= s.length) break;
      const n = s[j];
      if (n === "n") out += "\n";
      else if (n === "t") out += "\t";
      else if (n === "r") out += "\r";
      else if (n === '"' || n === "\\" || n === "/") out += n;
      else out += n;
      j++;
      continue;
    }
    if (c === '"') break;
    out += c;
    j++;
  }
  return out;
}

function trimBrokenTrailingImg(html) {
  const h = String(html || "").replace(/\.\.\.$/, "");
  const idx = h.lastIndexOf("<img");
  if (idx === -1) return h;
  const tail = h.slice(idx);
  if (!tail.includes(">")) return h.slice(0, idx);
  return h;
}

function parsePayloadFromRow(row) {
  let raw = row.payload;
  if (raw && typeof raw === "object") {
    return { ...raw, id: row.id };
  }
  if (typeof raw !== "string") return null;
  try {
    const o = JSON.parse(raw);
    return { ...o, id: row.id };
  } catch {
    const s = raw.endsWith("...") ? raw.slice(0, -3) : raw;
    const keysStr = [
      "id",
      "link",
      "slug",
      "title",
      "status",
      "content",
      "imageUrl",
      "createdAt",
      "updatedAt",
      "authorName",
      "companySize",
      "contentHtml",
      "publishedAt",
      "thumbnailUrl",
      "featuredImageUrl",
    ];
    const o = {};
    for (const k of keysStr) {
      o[k] = readJsonStringField(s, k);
    }
    o.contentHtml = trimBrokenTrailingImg(o.contentHtml);
    if (!o.publishedAt) o.publishedAt = row.updated_at || new Date().toISOString();
    o.industryTags = [];
    o.consultingTypeTags = [];
    o.id = row.id;
    o.status = row.status || o.status || "saved";
    return o;
  }
}

function caseIdEpochMs(id) {
  const m = /^case-(\d+)$/.exec(String(id || ""));
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sortCasesItemsNewestFirst(items) {
  const arr = Array.isArray(items) ? [...items] : [];
  function ts(it) {
    if (!it || typeof it !== "object") return 0;
    const fromId = caseIdEpochMs(it.id);
    if (fromId) return fromId;
    const c = it.createdAt;
    if (c) {
      const t0 = new Date(c).getTime();
      if (Number.isFinite(t0) && t0 > 0) return t0;
    }
    for (const k of ["publishedAt", "updatedAt", "rowUpdatedAt"]) {
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

function stripHtmlToSearchText(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function withDerivedSlugLink(items) {
  const used = Object.create(null);
  return (items || []).map(function (item, index) {
    const base = slugify(item.slug || item.title || item.id);
    let slug = base;
    let n = 2;
    while (used[slug]) {
      slug = base + "-" + n;
      n += 1;
    }
    used[slug] = true;
    let link = item.link;
    if (!link) link = "story-testimonial-" + String(index + 1) + ".html";
    return Object.assign({}, item, { slug, link });
  });
}

function buildListAndDetails(items, updatedAtIso) {
  const published = sortCasesItemsNewestFirst(
    (items || []).filter((item) => item && item.status === "published")
  );
  const listItems = [];
  const details = [];
  for (const item of published) {
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
      createdAt: item.createdAt || "",
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
  const derived = withDerivedSlugLink(listItems);
  derived.forEach((it) => {
    it.link = "testimonials.html?id=" + encodeURIComponent(it.id);
  });
  const listPayload = {
    schema: "cases-list.v1",
    updatedAt: updatedAtIso || new Date().toISOString(),
    note: "cases_rows.json 기준 정적 생성(발행 상태만). 본문은 data/cases/<id>.json",
    items: derived,
  };
  return { listPayload, details };
}

function main() {
  const rows = JSON.parse(fs.readFileSync(ROWS_PATH, "utf8"));
  if (!Array.isArray(rows)) {
    console.error("cases_rows.json 은 배열이어야 합니다.");
    process.exit(1);
  }

  const items = [];
  const repairedRows = [];
  let updatedAtMs = 0;

  for (const row of rows) {
    const p = parsePayloadFromRow(row);
    if (!p || !p.id) {
      console.warn("건너뜀(복구 실패):", row && row.id);
      continue;
    }
    const t = new Date(row.updated_at || p.updatedAt || 0).getTime();
    if (Number.isFinite(t) && t > updatedAtMs) updatedAtMs = t;

    const forWeb = {
      ...p,
      id: row.id,
      status: "published",
      publishedAt: p.publishedAt || p.updatedAt || row.updated_at || new Date().toISOString(),
    };
    items.push(forWeb);

    repairedRows.push({
      id: row.id,
      payload: {
        ...p,
        id: row.id,
        status: "published",
        publishedAt: forWeb.publishedAt,
      },
      status: "published",
      updated_at: row.updated_at || p.updatedAt || new Date().toISOString(),
      version: row.version ?? 1,
    });
  }

  const { listPayload, details } = buildListAndDetails(items, new Date(updatedAtMs || Date.now()).toISOString());

  if (!fs.existsSync(CASES_DIR)) fs.mkdirSync(CASES_DIR, { recursive: true });

  for (const f of fs.readdirSync(CASES_DIR)) {
    if (!f.endsWith(".json")) continue;
    fs.unlinkSync(path.join(CASES_DIR, f));
  }

  for (const d of details) {
    const abs = path.join(DATA_DIR, d.filename);
    fs.writeFileSync(abs, JSON.stringify(d.payload, null, 2) + "\n", "utf8");
  }

  fs.writeFileSync(path.join(DATA_DIR, "cases-list.json"), JSON.stringify(listPayload, null, 2) + "\n", "utf8");

  const legacy = {
    note: "레거시 폴백: 게시판은 우선 data/cases-list.json + data/cases/<id>.json 을 사용합니다.",
    updatedAt: listPayload.updatedAt,
    items: listPayload.items.map((it) => ({
      id: it.id,
      slug: it.slug,
      title: it.title,
      authorName: it.authorName,
      industryTags: it.industryTags,
      companySize: it.companySize,
      consultingTypeTags: it.consultingTypeTags,
      thumbnailUrl: it.thumbnailUrl,
      featuredImageUrl: it.featuredImageUrl,
      imageUrl: it.imageUrl,
      link: it.link,
      publishedAt: it.publishedAt,
      createdAt: it.createdAt,
      status: "published",
      contentHtml: "",
    })),
  };
  fs.writeFileSync(path.join(DATA_DIR, "cases.json"), JSON.stringify(legacy, null, 2) + "\n", "utf8");

  fs.writeFileSync(ROWS_PATH, JSON.stringify(repairedRows, null, 2) + "\n", "utf8");

  console.log(
    "완료: 발행 기준 목록",
    listPayload.items.length,
    "건, 상세 JSON",
    details.length,
    "개. cases_rows.json 은 payload 객체·전원 published 로 정리했습니다."
  );
}

main();
