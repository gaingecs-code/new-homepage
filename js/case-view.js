/**
 * 사례 본문 전용 뷰어 (case-view.html). main.js 비로드.
 */
(function () {
  var SCHEMA_DETAIL = "cases-detail.v1";
  var SETTING_KEY = "admin.local.cases.v1";
  var HIDDEN_MSG = "해당 게시글은 숨김 처리되었습니다.";
  var ID_RE = /^[a-zA-Z0-9_-]+$/;

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
    var url = new URL("data/cases/" + encodeURIComponent(id) + ".json", window.location.href).href;
    return fetch(url, { cache: "default" }).then(function (r) {
      if (!r.ok) throw new Error("no detail");
      return r.json();
    }).then(function (d) {
      if (!d || d.schema !== SCHEMA_DETAIL) throw new Error("bad detail");
      return d;
    });
  }

  function loadFromPayload(payload, id) {
    var items = (payload && payload.items) || [];
    var item = items.find(function (x) {
      return x && String(x.id) === id;
    });
    if (!item) throw new Error("not found");
    var html = item.contentHtml || "";
    if (!html && item.content) {
      html =
        "<p>" +
        String(item.content)
          .split("\n")
          .map(function (line) {
            return line.trim();
          })
          .filter(Boolean)
          .join("</p><p>") +
        "</p>";
    }
    if (!html) throw new Error("no html");
    return {
      title: item.title || "",
      authorName: item.authorName || "",
      publishedAt: item.publishedAt || "",
      contentHtml: html,
    };
  }

  function fetchLegacyCase(id) {
    function fromCasesJson() {
      return fetch(new URL("data/cases.json", window.location.href).href, { cache: "no-store" }).then(function (r2) {
        if (!r2.ok) throw new Error("no cases json");
        return r2.json();
      });
    }

    if (window.location.protocol === "file:") {
      return fromCasesJson().then(function (payload) {
        return loadFromPayload(payload, id);
      });
    }

    return fetch("/api/public-settings?key=" + encodeURIComponent(SETTING_KEY), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("api");
        return r.json();
      })
      .then(function (j) {
        var v = j && j.value;
        if (v && Array.isArray(v.items)) return v;
        throw new Error("no remote items");
      })
      .then(function (payload) {
        return loadFromPayload(payload, id);
      })
      .catch(function () {
        return fromCasesJson().then(function (payload) {
          return loadFromPayload(payload, id);
        });
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
      showState(HIDDEN_MSG, true);
      return;
    }

    fetchDetailJson(id)
      .then(function (d) {
        showArticle(d.title || "", metaLine(d), d.contentHtml || "");
      })
      .catch(function () {
        return fetchLegacyCase(id).then(function (d) {
          showArticle(d.title || "", metaLine(d), d.contentHtml || "");
        });
      })
      .catch(function () {
        showState(HIDDEN_MSG, true);
      });
  }

  var closeBtn = document.getElementById("case-view-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      window.close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
