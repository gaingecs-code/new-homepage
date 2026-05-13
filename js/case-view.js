/**
 * 사례 본문 전용 뷰어 (case-view.html). main.js 비로드.
 * 본문은 data/cases/<id>.json 단일 요청만 사용 (레거시 통합 묶음 미사용).
 */
(function () {
  var SCHEMA_DETAIL = "cases-detail.v1";
  var NOT_FOUND_MSG = "해당 사례를 찾을 수 없거나 준비 중입니다.";
  var ID_RE = /^[a-zA-Z0-9_-]+$/;

  function getCaseViewRev() {
    try {
      var m = document.querySelector('meta[name="case-view-rev"]');
      return (m && m.getAttribute("content")) || "";
    } catch (e) {
      return "";
    }
  }

  function getId() {
    try {
      return (new URLSearchParams(window.location.search).get("id") || "").trim();
    } catch (e) {
      return "";
    }
  }

  function showState(msg, isError) {
    var el = document.getElementById("case-view-state");
    var art = document.getElementById("case-view-article");
    if (el) {
      el.removeAttribute("hidden");
      el.textContent = msg;
      el.classList.toggle("case-view-state--error", !!isError);
    }
    if (art) art.setAttribute("hidden", "hidden");
  }

  function showArticle(title, metaLine, html) {
    var stateEl = document.getElementById("case-view-state");
    var art = document.getElementById("case-view-article");
    if (stateEl) stateEl.setAttribute("hidden", "hidden");
    if (art) art.removeAttribute("hidden");
    var t = document.getElementById("case-view-title");
    if (t) t.textContent = title || "";
    var meta = document.getElementById("case-view-meta");
    if (meta) {
      meta.textContent = metaLine || "";
      meta.style.display = metaLine ? "block" : "none";
    }
    var c = document.getElementById("case-view-content");
    if (c) c.innerHTML = html || "";
    document.title = (title || "사례") + " | 가인지컨설팅그룹";
  }

  function fetchDetailJson(id) {
    var base = new URL("data/cases/" + encodeURIComponent(id) + ".json", window.location.href).href;
    var rev = getCaseViewRev();
    var url = rev ? base + "?v=" + encodeURIComponent(rev) : base;
    var opts = { cache: rev ? "default" : "no-cache" };
    return fetch(url, opts)
      .then(function (r) {
        if (!r.ok) throw new Error("no detail");
        return r.json();
      })
      .then(function (d) {
        if (!d || d.schema !== SCHEMA_DETAIL) throw new Error("bad detail");
        return d;
      });
  }

  function metaLine(d) {
    var parts = [];
    if (d.authorName) parts.push(d.authorName);
    if (d.publishedAt) parts.push(String(d.publishedAt).slice(0, 10));
    return parts.join(" · ");
  }

  function run() {
    var id = getId();
    if (!id || !ID_RE.test(id)) {
      showState(NOT_FOUND_MSG, true);
      return;
    }

    fetchDetailJson(id)
      .then(function (d) {
        showArticle(d.title || "", metaLine(d), d.contentHtml || "");
      })
      .catch(function () {
        showState(NOT_FOUND_MSG, true);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
