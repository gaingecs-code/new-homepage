/**
 * 기업교육 "교육 종료" 오버레이 — `items[].ended` 출처:
 * - 우선: data/corporate-education-programs.json (Admin JSON 내보내기와 동일 파일)
 * - 폴백: data/corporate-education-intro-ended.json (구 형식 id→boolean)
 * - file:// : #corporate-education-programs-data 또는 구형 #corporate-education-intro-ended-data
 */
(function () {
  var PROGRAMS_PATH = "data/corporate-education-programs.json";
  var LEGACY_ENDED_PATH = "data/corporate-education-intro-ended.json";
  var INLINE_PROGRAMS_ID = "corporate-education-programs-data";
  var INLINE_LEGACY_ENDED_ID = "corporate-education-intro-ended-data";
  var MESSAGE = "이 교육은 종료되었습니다.";
  var PANEL_CLASS = "corporate-education-intro-ended-panel";

  function endedMapFromProgramPayload(obj) {
    if (!obj || typeof obj !== "object") return null;
    var items = obj.items;
    if (!Array.isArray(items)) return null;
    var m = {};
    items.forEach(function (item) {
      if (item && item.id) m[item.id] = !!item.ended;
    });
    return Object.keys(m).length ? m : null;
  }

  function parseJsonEl(id) {
    var el = document.getElementById(id);
    if (!el || !String(el.textContent || "").trim()) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
  }

  /** 구형: { "cert-1": true, ... } 만 있는 객체 */
  function isLegacyEndedOnly(obj) {
    if (!obj || typeof obj !== "object") return false;
    return !Array.isArray(obj.items) && Object.keys(obj).length > 0;
  }

  function normalizeEndedMap(raw) {
    if (!raw || typeof raw !== "object") return {};
    if (endedMapFromProgramPayload(raw)) return endedMapFromProgramPayload(raw);
    if (isLegacyEndedOnly(raw)) return raw;
    return {};
  }

  function ensurePanel(media) {
    if (!media || media.querySelector("." + PANEL_CLASS)) return;
    var p = document.createElement("div");
    p.className = PANEL_CLASS;
    p.setAttribute("role", "presentation");
    p.setAttribute("aria-hidden", "true");
    p.innerHTML =
      '<div class="corporate-education-intro-ended-shade" aria-hidden="true"></div>' +
      '<p class="corporate-education-intro-ended-text">' +
      MESSAGE +
      "</p>";
    media.appendChild(p);
  }

  function applyEnded(map) {
    var ended = map && typeof map === "object" ? map : {};
    document.querySelectorAll(".corporate-education-intro-item[data-admin-item-key]").forEach(function (article) {
      var key = article.getAttribute("data-admin-item-key");
      if (!key) return;
      var on = ended[key] === true;
      if (on) {
        article.classList.add("corporate-education-intro-item--ended");
        article.setAttribute("aria-label", MESSAGE);
        var media = article.querySelector(".corporate-education-intro-media");
        ensurePanel(media);
      } else {
        article.classList.remove("corporate-education-intro-item--ended");
        article.removeAttribute("aria-label");
        var m = article.querySelector(".corporate-education-intro-media");
        if (m) {
          var old = m.querySelector("." + PANEL_CLASS);
          if (old) old.remove();
        }
      }
    });
    if (typeof window.initCorporateEducationWorkshopCarousel === "function") {
      try {
        window.initCorporateEducationWorkshopCarousel();
      } catch (e) {}
    }
  }

  function mergeEndedPreferPrograms(programsPayload, legacyEnded) {
    var fromPrograms = endedMapFromProgramPayload(programsPayload);
    if (fromPrograms) return fromPrograms;
    if (legacyEnded && typeof legacyEnded === "object") return normalizeEndedMap(legacyEnded);
    return {};
  }

  function loadInlineOnly() {
    var programsEl = parseJsonEl(INLINE_PROGRAMS_ID);
    var legacyEl = parseJsonEl(INLINE_LEGACY_ENDED_ID);
    var merged = mergeEndedPreferPrograms(programsEl, legacyEl);
    applyEnded(merged);
  }

  function fetchLegacyEndedMap() {
    return fetch(LEGACY_ENDED_PATH, { cache: "no-store" }).then(function (r) {
      if (!r.ok) return {};
      return r.json();
    });
  }

  function load() {
    var isFile = typeof location !== "undefined" && location.protocol === "file:";
    if (isFile) {
      loadInlineOnly();
      return;
    }

    fetch(PROGRAMS_PATH, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("no programs");
        return r.json();
      })
      .then(function (j) {
        var m = endedMapFromProgramPayload(j);
        if (m) return m;
        return fetchLegacyEndedMap();
      })
      .catch(function () {
        return fetchLegacyEndedMap();
      })
      .then(function (map) {
        applyEnded(map && typeof map === "object" ? map : {});
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
