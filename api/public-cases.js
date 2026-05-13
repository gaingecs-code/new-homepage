/**
 * 공개 고객 사례: Supabase public.cases 중 status=published 만 반환.
 * 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Vercel/GitHub Secrets)
 */
function normalizeSupabaseUrl(raw) {
  var s = String(raw || "").trim().replace(/\/+$/, "");
  return s.replace(/\/rest\/v1$/i, "");
}

function stripHtmlToSearchText(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtmlMinimal(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Admin withDerivedFields 와 동일: payload 에 contentHtml 이 없을 때 블록·텍스트에서 본문 생성 */
function blocksToHtml(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map(function (block) {
      if (!block || typeof block !== "object") return "";
      if (block.type === "image") {
        var src = block.imageUrl || "";
        var caption = block.caption
          ? "<figcaption>" + escapeHtmlMinimal(block.caption) + "</figcaption>"
          : "";
        return src
          ? '<figure><img src="' +
            String(src).replace(/"/g, "&quot;") +
            '" style="max-width:100%;" alt="" />' +
            caption +
            "</figure>"
          : "";
      }
      var text = block.text;
      return text ? "<p>" + String(text).replace(/\n/g, "<br/>") + "</p>" : "";
    })
    .join("");
}

function payloadDisplayHtml(p) {
  if (!p || typeof p !== "object") return "";
  var direct = String(p.contentHtml || "").trim();
  if (direct) return direct;
  var fromBlocks = blocksToHtml(p.contentBlocks);
  if (fromBlocks) return fromBlocks;
  var c = p.content;
  if (c != null && String(c).trim()) {
    return "<p>" + String(c).replace(/\n/g, "<br/>") + "</p>";
  }
  return "";
}

function slugify(input) {
  var text = String(input || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return text || "case";
}

function withDerivedSlugLink(items) {
  var used = Object.create(null);
  return (items || []).map(function (item, index) {
    var base = slugify(item.slug || item.title || item.id);
    var slug = base;
    var n = 2;
    while (used[slug]) {
      slug = base + "-" + n;
      n += 1;
    }
    used[slug] = true;
    var link = item.link;
    if (!link) link = "story-testimonial-" + String(index + 1) + ".html";
    return Object.assign({}, item, { slug: slug, link: link });
  });
}

function rowToListItem(row, index) {
  var p = row.payload && typeof row.payload === "object" ? row.payload : {};
  var id = String(row.id || p.id || "");
  var contentHtml = payloadDisplayHtml(p);
  var searchText = stripHtmlToSearchText(contentHtml);
  return {
    id: id,
    slug: p.slug || "",
    title: p.title || "",
    authorName: p.authorName || "",
    industryTags: Array.isArray(p.industryTags) ? p.industryTags : [],
    companySize: p.companySize || "",
    consultingTypeTags: Array.isArray(p.consultingTypeTags) ? p.consultingTypeTags : [],
    thumbnailUrl: p.thumbnailUrl || "",
    featuredImageUrl: p.featuredImageUrl || "",
    imageUrl: p.imageUrl || "",
    publishedAt: p.publishedAt || "",
    createdAt: p.createdAt || "",
    rowUpdatedAt: row.updated_at || "",
    searchText: searchText,
    contentHtml: contentHtml,
    link: "",
    _index: index,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED" });
  }

  var SUPABASE_URL = normalizeSupabaseUrl(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  );
  var SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ ok: false, code: "MISSING_SUPABASE_ENV" });
  }

  var idFilter = String((req.query && req.query.id) || "").trim();

  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");

  try {
    var url =
      SUPABASE_URL +
      "/rest/v1/cases?status=eq.published&select=id,payload,updated_at&order=updated_at.desc,id.desc";
    if (idFilter) {
      url =
        SUPABASE_URL +
        "/rest/v1/cases?id=eq." +
        encodeURIComponent(idFilter) +
        "&status=eq.published&select=id,payload,updated_at&limit=1";
    }

    var r = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
        Accept: "application/json",
      },
    });

    var rows = [];
    try {
      rows = await r.json();
    } catch (e) {
      rows = [];
    }
    if (!r.ok) {
      return res.status(502).json({ ok: false, code: "SUPABASE_READ_FAILED" });
    }
    if (!Array.isArray(rows)) {
      rows = [];
    }

    if (idFilter) {
      if (!rows.length) {
        return res.status(404).json({ ok: false, code: "NOT_FOUND" });
      }
      var row0 = rows[0];
      var p0 = row0.payload && typeof row0.payload === "object" ? row0.payload : {};
      return res.status(200).json({
        ok: true,
        schema: "cases-detail.v1",
        id: row0.id,
        title: p0.title || "",
        authorName: p0.authorName || "",
        contentHtml: payloadDisplayHtml(p0),
        publishedAt: p0.publishedAt || "",
      });
    }

    var rawItems = rows.map(function (row, idx) {
      return rowToListItem(row, idx);
    });
    var derived = withDerivedSlugLink(rawItems);
    derived.forEach(function (it) {
      it.link = "testimonials.html?id=" + encodeURIComponent(it.id);
      delete it._index;
    });

    function caseIdEpochMs(id) {
      var m = /^case-(\d+)$/.exec(String(id || ""));
      if (!m) return 0;
      var n = Number(m[1]);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    function listSortTs(it) {
      if (!it || typeof it !== "object") return 0;
      var fromId = caseIdEpochMs(it.id);
      if (fromId) return fromId;
      var c = it.createdAt;
      if (c) {
        var t0 = new Date(c).getTime();
        if (Number.isFinite(t0) && t0 > 0) return t0;
      }
      var keys = ["publishedAt", "updatedAt", "rowUpdatedAt"];
      for (var i = 0; i < keys.length; i++) {
        var v = it[keys[i]];
        if (v) {
          var t = new Date(v).getTime();
          if (Number.isFinite(t) && t > 0) return t;
        }
      }
      return 0;
    }
    derived.sort(function (a, b) {
      var tb = listSortTs(b);
      var ta = listSortTs(a);
      if (tb !== ta) return tb - ta;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

    var updatedAtMs = rows.reduce(function (m, row) {
      var t = new Date(row.updated_at || 0).getTime();
      return Number.isFinite(t) && t > m ? t : m;
    }, 0);

    return res.status(200).json({
      ok: true,
      schema: "cases-list.v1",
      updatedAt: new Date(updatedAtMs || Date.now()).toISOString(),
      note: "Supabase public.cases (published only).",
      items: derived,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, code: "UNEXPECTED_ERROR" });
  }
};
