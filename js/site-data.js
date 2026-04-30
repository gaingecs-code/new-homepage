/**
 * 공통 데이터 로드: 외부 JSON → 인라인(#id) → defaults
 * file:// 에서는 fetch 생략 후 인라인 → defaults
 */
(function (global) {
  var SiteData = {};

  SiteData.isFileProtocol = function () {
    return global.location.protocol === "file:";
  };

  SiteData.parseInlineJson = function (elementId) {
    var el = global.document.getElementById(elementId);
    if (!el) return null;
    var text = String(el.textContent || "").trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  };

  /**
   * @param {object} opts
   * @param {string} opts.url - data/*.json
   * @param {string} opts.inlineId - script[type=application/json] id
   * @param {function(*): boolean} [opts.validate] - true면 해당 페이로드 사용
   * @param {*} [opts.defaults] - 최종 폴백
   * @returns {Promise<*>}
   */
  SiteData.resolvePayload = function (opts) {
    var defaults = opts.defaults;
    var validate =
      typeof opts.validate === "function"
        ? opts.validate
        : function () {
            return true;
          };
    var url = opts.url;
    var inlineId = opts.inlineId;

    function finalize(raw) {
      if (validate(raw)) return raw;
      return defaults;
    }

    if (SiteData.isFileProtocol()) {
      return Promise.resolve(finalize(SiteData.parseInlineJson(inlineId)));
    }

    return fetch(url, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("fetch " + url);
        return r.json();
      })
      .then(function (data) {
        if (validate(data)) return data;
        return finalize(SiteData.parseInlineJson(inlineId));
      })
      .catch(function () {
        return finalize(SiteData.parseInlineJson(inlineId));
      });
  };

  SiteData.validateBooksPayload = function (d) {
    return !!(d && Array.isArray(d.items) && d.items.length > 0);
  };

  SiteData.validateHomePayload = function (d) {
    if (!d || typeof d !== "object") return false;
    if (Array.isArray(d.heroRotationImages) && d.heroRotationImages.length > 0) return true;
    if (d.heroVideoUrl && String(d.heroVideoUrl).trim()) return true;
    if (d.logoSlotImages && typeof d.logoSlotImages === "object") {
      for (var k in d.logoSlotImages) {
        if (Object.prototype.hasOwnProperty.call(d.logoSlotImages, k)) return true;
      }
    }
    if (d.homeTestimonialVideoUrls && typeof d.homeTestimonialVideoUrls === "object") return true;
    if (d.homeStoryPageUrls && typeof d.homeStoryPageUrls === "object") return true;
    return false;
  };

  SiteData.validateTestimonialsPagePayload = function (d) {
    if (!d || typeof d !== "object") return false;
    var pv = d.pageVideoUrls;
    if (pv && typeof pv === "object") {
      for (var k in pv) {
        if (!Object.prototype.hasOwnProperty.call(pv, k)) continue;
        if (pv[k] != null && String(pv[k]).trim()) return true;
      }
    }
    var sv = d.storyPageUrls;
    if (sv && typeof sv === "object") {
      for (var k2 in sv) {
        if (!Object.prototype.hasOwnProperty.call(sv, k2)) continue;
        if (sv[k2] != null && String(sv[k2]).trim()) return true;
      }
    }
    return false;
  };

  SiteData.validateConsultingPagePayload = function (d) {
    if (!d || typeof d !== "object") return false;
    if (d.vocVideoUrls && typeof d.vocVideoUrls === "object") {
      for (var k in d.vocVideoUrls) {
        if (!Object.prototype.hasOwnProperty.call(d.vocVideoUrls, k)) continue;
        var v = d.vocVideoUrls[k];
        if (v != null && String(v).trim()) return true;
      }
    }
    if (d.businessRoadmapPdfUrl && String(d.businessRoadmapPdfUrl).trim()) return true;
    return false;
  };

  SiteData.validateBusinessDescriptionsPayload = function (d) {
    if (!d || !d.descriptions || typeof d.descriptions !== "object") return false;
    for (var key in d.descriptions) {
      if (!Object.prototype.hasOwnProperty.call(d.descriptions, key)) continue;
      var v = d.descriptions[key];
      if (v != null && String(v).trim()) return true;
    }
    return false;
  };

  global.SiteData = SiteData;
})(typeof window !== "undefined" ? window : this);
