(function (global) {
  var prefetched = Object.create(null);
  function prefetch(absUrl) {
    if (!absUrl || prefetched[absUrl]) return;
    prefetched[absUrl] = true;
    try {
      var link = global.document.createElement("link");
      link.rel = "prefetch";
      link.href = absUrl;
      global.document.head.appendChild(link);
    } catch (e) {}
  }
  function maybePrefetchAnchor(a) {
    if (!a || a.target === "_blank" || a.getAttribute("download")) return;
    var raw = a.getAttribute("href");
    if (!raw || raw.charAt(0) === "#") return;
    if (/^(mailto:|tel:|javascript:)/i.test(raw)) return;
    var u;
    try {
      u = new URL(raw, global.location.href);
    } catch (err) {
      return;
    }
    if (u.origin !== global.location.origin) return;
    var path = u.pathname || "";
    if (
      !/\.html($|[?#])/i.test(path) &&
      path !== "/" &&
      !/\/index\.html$/i.test(path)
    ) {
      return;
    }
    prefetch(u.href);
  }
  global.addEventListener("DOMContentLoaded", function () {
    global.document.documentElement.addEventListener(
      "pointerdown",
      function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        var a = t.closest("a[href]");
        maybePrefetchAnchor(a);
      },
      true
    );
  });
})(typeof window !== "undefined" ? window : this);

$(function () {
  // 헤더: 가인지캠퍼스 바로가기 → 새 창(팝업)으로 열기
  var campusWinFeatures = "noopener,noreferrer,width=1200,height=800";
  $("[data-gainge-campus]").on("click", function () {
    window.open("https://gainge.com/", "_blank", campusWinFeatures);
  });

  // 헤더: 로그인/회원가입 → 별도 팝업 페이지 열기
  var authPopupFeatures = "noopener,noreferrer,width=1000,height=860";
  $(".header-auth-button").on("click", function () {
    window.open("login-popup.html", "_blank", authPopupFeatures);
  });

  // 헤더: 기업 진단하기 → 메인페이지 진단 타이틀로 이동
  $("[data-header-diagnosis]").on("click", function () {
    // index.html 내부에서는 앵커 이동, 다른 페이지에서는 index.html#home-diagnosis-heading으로 이동
    var isIndex =
      /(^|\/)index\.html$/i.test(window.location.pathname) ||
      window.location.pathname === "/" ||
      window.location.pathname === "";
    if (isIndex) {
      window.location.hash = "#home-diagnosis-heading";
    } else {
      window.location.href = "index.html#home-diagnosis-heading";
    }
  });

  // 간증 영상 팝업 공통: 상대 경로 표준화(슬래시) 후 절대 URL; file:// / http:// 모두 동일 API 사용
  function resolveMediaUrlForPopup(url) {
    var s = (url || "").trim().replace(/\\/g, "/");
    if (!s) return "";
    if (s.indexOf("://") < 0 && s.indexOf("//") !== 0) s = s.replace(/^\.\//, "");
    if (!/^https?:/i.test(s) && s.indexOf("//") !== 0) {
      if (s.indexOf("data:") === 0 || s.indexOf("blob:") === 0) {
        return s;
      }
    }
    try {
      return new URL(s, window.location.href).href;
    } catch (e) {
      if (window.console && console.debug) {
        console.debug("[media] new URL 실패, 원문 반환", s, e);
      }
      return s;
    }
  }

  function isNativeVideoPopupUrl(url) {
    return /\.(mp4|webm|ogg)(\?|$)/i.test(url || "");
  }

  /** youtube.com / youtu.be 일반 링크 → iframe용 embed URL */
  function embedFriendlyVideoUrl(url) {
    var s = (url || "").trim();
    if (!s) return s;
    if (/^(https?:)?\/\/(www\.)?youtube\.com\/embed\//i.test(s)) return s.split("&")[0] || s;
    var m = s.match(/youtu\.be\/([^?&#]+)/i);
    if (m) return "https://www.youtube.com/embed/" + m[1] + "?rel=0&modestbranding=1&playsinline=1";
    m = s.match(/[?&]v=([^?&#]+)/i);
    if (m) return "https://www.youtube.com/embed/" + m[1] + "?rel=0&modestbranding=1&playsinline=1";
    return s;
  }

  function withAutoplay(url) {
    var s = (url || "").trim();
    if (!s) return s;
    if (/([?&])autoplay=/.test(s)) return s;
    return s + (s.indexOf("?") >= 0 ? "&" : "?") + "autoplay=1";
  }

  window.GaingeMedia = {
    resolveMediaUrlForPopup: resolveMediaUrlForPopup,
    isNativeVideoPopupUrl: isNativeVideoPopupUrl,
    embedFriendlyVideoUrl: embedFriendlyVideoUrl,
  };

  // 메인: data/home.json → #home-page-data → 기본값 (page-init-home.js)
  if ($(".home-main").length && window.SiteData && window.GaingeSite) {
    window.SiteData.resolvePayload({
      url: "data/home.json",
      inlineId: "home-page-data",
      validate: window.SiteData.validateHomePayload,
      defaults: window.GaingeSite.DEFAULT_HOME_JSON,
    }).then(function (data) {
      var cfg = $.extend(true, {}, window.GaingeSite.DEFAULT_HOME_JSON, data || {});
      window.HOME_HERO_ROTATION_IMAGES = cfg.heroRotationImages;
      window.HOME_LOGO_SLOT_IMAGES = cfg.logoSlotImages;
      window.HOME_TESTIMONIAL_VIDEO_URLS = cfg.homeTestimonialVideoUrls;
      window.HOME_STORY_PAGE_URLS = cfg.homeStoryPageUrls;
      window.GaingeSite.applyHomePageConfig($);
    });
  } else if ($(".home-main").length && window.GaingeSite) {
    var hdef = window.GaingeSite.DEFAULT_HOME_JSON;
    window.HOME_HERO_ROTATION_IMAGES = hdef.heroRotationImages;
    window.HOME_LOGO_SLOT_IMAGES = hdef.logoSlotImages;
    window.HOME_TESTIMONIAL_VIDEO_URLS = hdef.homeTestimonialVideoUrls;
    window.HOME_STORY_PAGE_URLS = hdef.homeStoryPageUrls;
    window.GaingeSite.applyHomePageConfig($);
  }

  // 메인페이지 고객 스토리(VOC) 이미지 셀: <video> 레이어 전환 · 닫기(×) / Esc / 딤 클릭 시 썸네일로 복귀
  (function initHomeVocInlineMedia() {
    var $stacks = $(".home-voc-section .home-voc-media-stack");
    if (!$stacks.length) return;
    var $dim = $("#home-voc-dim");
    var $activeStack = $();

    function setVocOverlayPosition($stack) {
      if (!$stack.length) return;
      var stackEl = $stack[0];
      var frameEl = $stack.find("[data-home-voc-inline-frame]").get(0);
      var cellEl = $stack.closest(".home-voc-cell--image").get(0);
      if (!frameEl || !cellEl) return;

      var cellRect = cellEl.getBoundingClientRect();
      var frameRect = frameEl.getBoundingClientRect();
      var frameW = frameRect.width;
      var frameH = frameRect.height;
      if (!frameW || !frameH) return;

      var anchorX = cellRect.left;
      var anchorY = cellRect.top;
      var shiftX = "0px";
      var shiftY = "0px";

      if ($(cellEl).hasClass("home-voc-cell--pair2-image")) {
        var pair2OffsetX = 60;
        anchorX = cellRect.right;
        anchorY = cellRect.top + cellRect.height / 2;
        shiftX = -Math.round(frameW) + pair2OffsetX + "px";
        shiftY = -Math.round(frameH / 2) + "px";
      } else if ($(cellEl).hasClass("home-voc-cell--pair3-image")) {
        anchorX = cellRect.left;
        anchorY = cellRect.bottom;
        shiftX = "0px";
        shiftY = -Math.round(frameH) + "px";
      }

      stackEl.style.setProperty("--home-voc-frame-left", Math.round(anchorX) + "px");
      stackEl.style.setProperty("--home-voc-frame-top", Math.round(anchorY) + "px");
      stackEl.style.setProperty("--home-voc-frame-shift-x", shiftX);
      stackEl.style.setProperty("--home-voc-frame-shift-y", shiftY);
    }

    function rafSetVocOverlayPosition($stack) {
      window.requestAnimationFrame(function () {
        setVocOverlayPosition($stack);
        window.requestAnimationFrame(function () {
          setVocOverlayPosition($stack);
        });
      });
    }

    function onVocOverlayViewportChange() {
      $stacks.each(function () {
        rafSetVocOverlayPosition($(this));
      });
    }

    $(window).on("resize.vocOverlayPosition scroll.vocOverlayPosition", onVocOverlayViewportChange);

    function showDim() {
      if ($dim.length) {
        $dim.removeAttr("hidden");
        $dim.attr("aria-hidden", "false");
      }
    }

    function hideDim() {
      if ($dim.length) {
        $dim.attr("hidden", "true");
        $dim.attr("aria-hidden", "true");
      }
    }

    function goThumb($stack) {
      var v = $stack.find("video.home-voc-inline-video").get(0);
      var iframe = $stack.find("iframe.home-voc-inline-iframe").get(0);
      if (!$stack.hasClass("is-home-voc-playing")) return;
      var $vLayer = $stack.find("[data-home-voc-video-layer]");
      $stack.find("[data-home-voc-inline-frame]").css({ width: "", height: "", transform: "", marginLeft: "" });
      $stack.removeClass("is-home-voc-playing");
      if ($vLayer.length) $vLayer.attr("aria-hidden", "true");
      if ($activeStack.length && $activeStack[0] === $stack[0]) {
        $activeStack = $();
      }
      if ($(".home-voc-section .is-home-voc-playing").length === 0) {
        hideDim();
      }
      if (v) {
        try {
          v.pause();
          v.currentTime = 0;
        } catch (err) {
          if (window.console && console.debug) {
            console.debug("[VOC inline] pause/seek", err);
          }
        }
      }
      if (iframe) {
        try {
          iframe.setAttribute("src", "");
        } catch (err) {
          if (window.console && console.debug) {
            console.debug("[VOC inline] iframe clear", err);
          }
        }
      }
    }

    $stacks.each(function () {
      var $stack = $(this);
      var $vLayer = $stack.find("[data-home-voc-video-layer]");
      var $play = $stack.find("[data-home-voc-play]");
      var $close = $stack.find("[data-home-voc-close]");
      var video = $stack.find("video.home-voc-inline-video").get(0);
      var iframe = $stack.find("iframe.home-voc-inline-iframe").get(0);
      var youtubeWatchUrl = (iframe && iframe.getAttribute("data-home-voc-youtube-url")) || "";
      if ((!video && !(iframe && youtubeWatchUrl)) || !$play.length) return;

      if (video) {
        video.addEventListener("loadedmetadata", function () {
          if (!video.videoWidth || !video.videoHeight) return;
          $stack[0].style.setProperty("--home-voc-video-ar", video.videoWidth + " / " + video.videoHeight);
          rafSetVocOverlayPosition($stack);
        });
      } else if (iframe) {
        $stack[0].style.setProperty("--home-voc-video-ar", "16 / 9");
      }

      $play.on("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if ($activeStack.length && $activeStack[0] !== $stack[0]) {
          goThumb($activeStack);
        }
        if ($stack.hasClass("is-home-voc-playing")) return;
        setVocOverlayPosition($stack);
        $stack.addClass("is-home-voc-playing");
        if ($vLayer.length) $vLayer.attr("aria-hidden", "false");
        $activeStack = $stack;
        showDim();
        rafSetVocOverlayPosition($stack);
        if (video) {
          var p = video.play();
          if (p && p.catch) {
            p.catch(function () {
              video.muted = true;
              return video.play();
            });
          }
        } else if (iframe && youtubeWatchUrl) {
          var emb = embedFriendlyVideoUrl(youtubeWatchUrl);
          if (emb.indexOf("?") >= 0) {
            emb += "&autoplay=1";
          } else {
            emb += "?autoplay=1";
          }
          iframe.setAttribute("src", emb);
        }
      });

      if ($close.length) {
        $close.on("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          goThumb($stack);
        });
      }

      if (video) {
        video.addEventListener("ended", function () {
          goThumb($stack);
        });
      }

      rafSetVocOverlayPosition($stack);
    });

    if ($dim.length) {
      $dim.on("click", function (e) {
        if (e.target !== e.currentTarget) return;
        if ($activeStack.length) goThumb($activeStack);
      });
    }

    $(document).on("keydown.vocDimClose", function (e) {
      if (e.key !== "Escape") return;
      if (!$activeStack.length) return;
      e.preventDefault();
      goThumb($activeStack);
    });
  })();

  // 메인페이지 VOC: 텍스트 카드( data-home-voc-story-url ) 클릭·Enter 시 스토리 새 창 (이미지 셀은 제외)
  var homeVocStoryPopupFeatures = "noopener,noreferrer,width=1080,height=860,scrollbars=yes,resizable=yes";
  function openHomeVocStoryFromCell(url) {
    var href = (url || "").trim();
    if (!href) return;
    window.open(href, "testimonialsStoryPopup", homeVocStoryPopupFeatures);
  }
  $("[data-home-voc-story-url]").on("click", function (e) {
    if ($(e.target).closest(".home-voc-text-btn").length) return;
    e.preventDefault();
    openHomeVocStoryFromCell($(this).attr("data-home-voc-story-url"));
  });
  $("[data-home-voc-story-url]").on("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    openHomeVocStoryFromCell($(this).attr("data-home-voc-story-url"));
  });

  var DEFAULT_TESTIMONIALS_PAGE = {
    updatedAt: "2026-04-29T00:00:00.000Z",
    pageVideoUrls: {
      1: "https://youtu.be/uNRDkKpbWQs",
      2: "https://youtu.be/ZxaHLlL2ESg",
      3: "https://youtu.be/Dz3ya3PD9eU",
    },
    storyPageUrls: { 1: "", 2: "", 3: "" },
  };

  /** 고객사례 VOC: JSON 키가 문자열 "1" 또는 숫자 1 일 때 모두 매칭 (컨설팅 VOC와 동일 패턴) */
  function testimonialsPageVideoUrlForId(id) {
    var raw =
      typeof window.TESTIMONIALS_PAGE_VIDEO_URLS === "object" && window.TESTIMONIALS_PAGE_VIDEO_URLS
        ? window.TESTIMONIALS_PAGE_VIDEO_URLS
        : {};
    var key = String(id == null ? "" : id).trim();
    if (!key) return "";
    var v = raw[key];
    if (v == null || v === "") v = raw[Number(key)];
    return String(v != null ? v : "").trim();
  }

  function initTestimonialsPageVideoPopupUI() {
    var $testimonialsPagePopup = $("#testimonials-page-video-popup");
    if (!$testimonialsPagePopup.length) return;
    var $testimonialsPageIframe = $testimonialsPagePopup.find(".community-video-popup-iframe");
    var $testimonialsPageNative = $testimonialsPagePopup.find(".testimonial-popup-video-native");
    var testimonialsPageNativeEl = $testimonialsPageNative[0];
    var $testimonialsPagePlaceholder = $testimonialsPagePopup.find(".home-testimonial-video-placeholder");
    var testimonialsPageScrollTop = 0;
    var testimonialsPageBodyLockPrev = null;

    function lockBodyForTestimonialsPagePopup() {
      if (testimonialsPageBodyLockPrev) return;
      testimonialsPageScrollTop =
        global.pageYOffset ||
        global.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      testimonialsPageBodyLockPrev = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
      };
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = -testimonialsPageScrollTop + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }

    function unlockBodyForTestimonialsPagePopup() {
      if (!testimonialsPageBodyLockPrev) return;
      document.body.style.overflow = testimonialsPageBodyLockPrev.overflow;
      document.body.style.position = testimonialsPageBodyLockPrev.position;
      document.body.style.top = testimonialsPageBodyLockPrev.top;
      document.body.style.left = testimonialsPageBodyLockPrev.left;
      document.body.style.right = testimonialsPageBodyLockPrev.right;
      document.body.style.width = testimonialsPageBodyLockPrev.width;
      global.scrollTo(0, testimonialsPageScrollTop);
      testimonialsPageBodyLockPrev = null;
    }

    function closeTestimonialsPagePopup() {
      $testimonialsPagePopup.attr("hidden", true);
      unlockBodyForTestimonialsPagePopup();
      $testimonialsPageIframe.attr("src", "").attr("hidden", true);
      if (testimonialsPageNativeEl) {
        testimonialsPageNativeEl.pause();
        testimonialsPageNativeEl.removeAttribute("src");
        testimonialsPageNativeEl.load();
      }
      $testimonialsPageNative.attr("hidden", true);
      $testimonialsPagePlaceholder.removeAttr("hidden");
      var $tpPh = $testimonialsPagePlaceholder.find("p");
      if ($tpPh.length) $tpPh.text("영상이 준비 중입니다.");
    }

    function openTestimonialsPageVideoPopup(id) {
      var urlRaw = testimonialsPageVideoUrlForId(id);
      var url = resolveMediaUrlForPopup(urlRaw);
      if (url) {
        if (isNativeVideoPopupUrl(urlRaw)) {
          $testimonialsPageIframe.attr("src", "").attr("hidden", true);
          $testimonialsPagePlaceholder.attr("hidden", true);
          $testimonialsPageNative.removeAttr("hidden");
          if (testimonialsPageNativeEl) {
            testimonialsPageNativeEl.src = url;
            testimonialsPageNativeEl.load();
            testimonialsPageNativeEl.play().catch(function () {});
          }
        } else {
          if (testimonialsPageNativeEl) {
            testimonialsPageNativeEl.pause();
            testimonialsPageNativeEl.removeAttribute("src");
            testimonialsPageNativeEl.load();
          }
          $testimonialsPageNative.attr("hidden", true);
          $testimonialsPageIframe.removeAttr("hidden").attr("src", withAutoplay(embedFriendlyVideoUrl(url)));
          $testimonialsPagePlaceholder.attr("hidden", true);
        }
      } else {
        $testimonialsPageIframe.attr("src", "").attr("hidden", true);
        if (testimonialsPageNativeEl) {
          testimonialsPageNativeEl.pause();
          testimonialsPageNativeEl.removeAttribute("src");
          testimonialsPageNativeEl.load();
        }
        $testimonialsPageNative.attr("hidden", true);
        $testimonialsPagePlaceholder.removeAttr("hidden");
      }
      $testimonialsPagePopup.removeAttr("hidden");
      lockBodyForTestimonialsPagePopup();
    }

    if (testimonialsPageNativeEl) {
      testimonialsPageNativeEl.addEventListener("error", function () {
        if ($testimonialsPagePopup[0].hasAttribute("hidden")) return;
        if (!testimonialsPageNativeEl.getAttribute("src")) return;
        testimonialsPageNativeEl.setAttribute("hidden", "");
        $testimonialsPagePlaceholder.removeAttr("hidden");
        var $p = $testimonialsPagePlaceholder.find("p");
        if ($p.length)
          $p.text("영상을 불러올 수 없습니다. assets 폴더에 파일이 있는지 확인해 주세요.");
      });
    }

    $(document)
      .off("click.tpPageVideo", "[data-testimonials-page-video]")
      .on("click.tpPageVideo", "[data-testimonials-page-video]", function (e) {
        e.preventDefault();
        var id = String($(this).attr("data-testimonials-page-video") || "").trim();
        openTestimonialsPageVideoPopup(id);
      });

    $testimonialsPagePopup
      .find(".community-video-popup-backdrop")
      .on("click", closeTestimonialsPagePopup);
    $testimonialsPagePopup
      .find(".community-video-popup-close")
      .on("click", closeTestimonialsPagePopup);

    $(document).on("keydown.testimonialsPageVideoPopup", function (e) {
      if (e.key !== "Escape") return;
      if (!$testimonialsPagePopup.length || $testimonialsPagePopup[0].hasAttribute("hidden")) return;
      e.preventDefault();
      closeTestimonialsPagePopup();
    });
  }

  function initTestimonialsStoryPagePopupUI() {
    var testimonialsStoryPopupFeatures = "noopener,noreferrer,width=1210,height=800";
    var testimonialsStoryPageUrls = $.extend(
      { 1: "", 2: "", 3: "" },
      typeof window.TESTIMONIALS_STORY_PAGE_URLS === "object" &&
        window.TESTIMONIALS_STORY_PAGE_URLS
        ? window.TESTIMONIALS_STORY_PAGE_URLS
        : {}
    );
    var $testimonialsStoryPopup = $("#testimonials-story-page-popup");
    if (!$testimonialsStoryPopup.length) return;
    var $storyIframe = $testimonialsStoryPopup.find(".community-video-popup-iframe");
    var $storyPlaceholder = $testimonialsStoryPopup.find(".testimonials-story-popup-placeholder");

    function closeTestimonialsStoryPopup() {
      $testimonialsStoryPopup.attr("hidden", true);
      $("body").css("overflow", "");
      $storyIframe.attr("src", "").attr("hidden", true);
      $storyPlaceholder.removeAttr("hidden");
    }

    $("[data-testimonials-story]").on("click", function () {
      var id = String($(this).attr("data-testimonials-story"));
      var url = (testimonialsStoryPageUrls[id] || "").trim();
      if (url) {
        if (!/^https?:\/\//i.test(url)) {
          window.open(url, "_blank", testimonialsStoryPopupFeatures);
          return;
        }
        $storyIframe.removeAttr("hidden").attr("src", embedFriendlyVideoUrl(url));
        $storyPlaceholder.attr("hidden", true);
      } else {
        $storyIframe.attr("src", "").attr("hidden", true);
        $storyPlaceholder.removeAttr("hidden");
      }
      $testimonialsStoryPopup.removeAttr("hidden");
      $("body").css("overflow", "hidden");
    });

    $testimonialsStoryPopup
      .find(".community-video-popup-backdrop")
      .on("click", closeTestimonialsStoryPopup);
    $testimonialsStoryPopup
      .find(".community-video-popup-close")
      .on("click", closeTestimonialsStoryPopup);

    $(document).on("keydown.testimonialsStoryPagePopup", function (e) {
      if (e.key !== "Escape") return;
      if (!$testimonialsStoryPopup.length || $testimonialsStoryPopup[0].hasAttribute("hidden")) return;
      e.preventDefault();
      closeTestimonialsStoryPopup();
    });
  }

  if ($(".testimonials-main").length && window.SiteData) {
    window.SiteData.resolvePayload({
      url: "data/testimonials-page.json",
      inlineId: "testimonials-page-data",
      validate: window.SiteData.validateTestimonialsPagePayload,
      defaults: DEFAULT_TESTIMONIALS_PAGE,
    }).then(function (data) {
      var cfg = $.extend(true, {}, DEFAULT_TESTIMONIALS_PAGE, data || {});
      window.TESTIMONIALS_PAGE_VIDEO_URLS = cfg.pageVideoUrls;
      window.TESTIMONIALS_STORY_PAGE_URLS = cfg.storyPageUrls;
      initTestimonialsPageVideoPopupUI();
      initTestimonialsStoryPagePopupUI();
    });
  } else if ($(".testimonials-main").length) {
    window.TESTIMONIALS_PAGE_VIDEO_URLS = DEFAULT_TESTIMONIALS_PAGE.pageVideoUrls;
    window.TESTIMONIALS_STORY_PAGE_URLS = DEFAULT_TESTIMONIALS_PAGE.storyPageUrls;
    initTestimonialsPageVideoPopupUI();
    initTestimonialsStoryPagePopupUI();
  }

  var DEFAULT_CONSULTING_PAGE = {
    updatedAt: "2026-04-29T00:00:00.000Z",
    vocVideoUrls: {
      1: "https://youtu.be/uNRDkKpbWQs",
      2: "https://youtu.be/ZxaHLlL2ESg",
      3: "https://youtu.be/Dz3ya3PD9eU",
    },
    businessRoadmapPdfUrl: "assets/비즈니스 로드맵.pdf",
    businessRoadmapAspectRatio: 0.57,
  };

  function consultingVocGetUrlForId(id) {
    var raw =
      typeof window.CONSULTING_VOC_VIDEO_URLS === "object" && window.CONSULTING_VOC_VIDEO_URLS
        ? window.CONSULTING_VOC_VIDEO_URLS
        : {};
    var key = String(id == null ? "" : id).trim();
    if (!key) return "";
    var v = raw[key];
    if (v == null || v === "") v = raw[Number(key)];
    return String(v != null ? v : "").trim();
  }

  function initConsultingVocModalUI() {
    var $consultingVocPopup = $("#consulting-voc-video-popup");
    if (!$consultingVocPopup.length) return;
    var $consultingVocIframe = $consultingVocPopup.find(".community-video-popup-iframe");
    var $consultingVocNative = $consultingVocPopup.find(".consulting-voc-video-native");
    var consultingVocNativeEl = $consultingVocNative[0];
    var $consultingVocPlaceholder = $consultingVocPopup.find(".home-testimonial-video-placeholder");
    var consultingVocScrollTop = 0;
    var consultingVocBodyLockPrev = null;

    function lockBodyForConsultingVocPopup() {
      if (consultingVocBodyLockPrev) return;
      consultingVocScrollTop =
        global.pageYOffset ||
        global.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      consultingVocBodyLockPrev = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
      };
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = -consultingVocScrollTop + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }

    function unlockBodyForConsultingVocPopup() {
      if (!consultingVocBodyLockPrev) return;
      document.body.style.overflow = consultingVocBodyLockPrev.overflow;
      document.body.style.position = consultingVocBodyLockPrev.position;
      document.body.style.top = consultingVocBodyLockPrev.top;
      document.body.style.left = consultingVocBodyLockPrev.left;
      document.body.style.right = consultingVocBodyLockPrev.right;
      document.body.style.width = consultingVocBodyLockPrev.width;
      global.scrollTo(0, consultingVocScrollTop);
      consultingVocBodyLockPrev = null;
    }

    function closeConsultingVocPopup() {
      $consultingVocPopup.attr("hidden", true);
      unlockBodyForConsultingVocPopup();
      $consultingVocIframe.attr("src", "").attr("hidden", true);
      if (consultingVocNativeEl) {
        consultingVocNativeEl.pause();
        consultingVocNativeEl.removeAttribute("src");
        consultingVocNativeEl.load();
      }
      $consultingVocNative.attr("hidden", true);
      $consultingVocPlaceholder.removeAttr("hidden");
      var $phText = $consultingVocPlaceholder.find("p");
      if ($phText.length) $phText.text("영상이 준비 중입니다.");
    }

    function openConsultingVocPopup(id) {
      var urlRaw = consultingVocGetUrlForId(id);
      var url = resolveMediaUrlForPopup(urlRaw);
      if (url) {
        if (isNativeVideoPopupUrl(urlRaw)) {
          $consultingVocIframe.attr("src", "").attr("hidden", true);
          $consultingVocPlaceholder.attr("hidden", true);
          $consultingVocNative.removeAttr("hidden");
          if (consultingVocNativeEl) {
            consultingVocNativeEl.src = url;
            consultingVocNativeEl.load();
            consultingVocNativeEl.play().catch(function () {});
          }
        } else {
          if (consultingVocNativeEl) {
            consultingVocNativeEl.pause();
            consultingVocNativeEl.removeAttribute("src");
            consultingVocNativeEl.load();
          }
          $consultingVocNative.attr("hidden", true);
          $consultingVocIframe.removeAttr("hidden").attr("src", withAutoplay(embedFriendlyVideoUrl(url)));
          $consultingVocPlaceholder.attr("hidden", true);
        }
      } else {
        $consultingVocIframe.attr("src", "").attr("hidden", true);
        if (consultingVocNativeEl) {
          consultingVocNativeEl.pause();
          consultingVocNativeEl.removeAttribute("src");
          consultingVocNativeEl.load();
        }
        $consultingVocNative.attr("hidden", true);
        $consultingVocPlaceholder.removeAttr("hidden");
      }
      $consultingVocPopup.removeAttr("hidden");
      lockBodyForConsultingVocPopup();
    }

    if (consultingVocNativeEl) {
      consultingVocNativeEl.addEventListener("error", function () {
        if ($consultingVocPopup[0].hasAttribute("hidden")) return;
        if (!consultingVocNativeEl.getAttribute("src")) return;
        consultingVocNativeEl.setAttribute("hidden", "");
        $consultingVocPlaceholder.removeAttr("hidden");
        var $p = $consultingVocPlaceholder.find("p");
        if ($p.length)
          $p.text("영상을 불러올 수 없습니다. assets 폴더에 파일이 있는지 확인해 주세요.");
      });
    }

    $(document)
      .off("click.consultingVocVideo", "[data-consulting-voc-video]")
      .on("click.consultingVocVideo", "[data-consulting-voc-video]", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var vid = String($(this).attr("data-consulting-voc-video") || "").trim();
        openConsultingVocPopup(vid);
      });

    $(document)
      .off("keydown.consultingVocVideo", "[data-consulting-voc-video]")
      .on("keydown.consultingVocVideo", "[data-consulting-voc-video]", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          var vid = String($(this).attr("data-consulting-voc-video") || "").trim();
          openConsultingVocPopup(vid);
        }
      });

    $consultingVocPopup
      .find(".community-video-popup-backdrop")
      .on("click", closeConsultingVocPopup);
    $consultingVocPopup
      .find(".community-video-popup-close")
      .on("click", closeConsultingVocPopup);

    $(document).on("keydown.consultingVocVideoPopup", function (e) {
      if (e.key !== "Escape") return;
      if (!$consultingVocPopup.length || $consultingVocPopup[0].hasAttribute("hidden")) return;
      e.preventDefault();
      closeConsultingVocPopup();
    });
  }

  // 컨설팅 VOC: 스토리 보기 → 새 창(팝업). target=_blank는 새 탭으로 열리는 경우가 많아 window.open 사용 (메인 간증 스토리와 동일 크기)
  var consultingVocStoryWinFeatures =
    "noopener,noreferrer,width=1210,height=800,scrollbars=yes,resizable=yes";
  $(document).on("click", "a[data-consulting-voc-story]", function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (typeof e.button === "number" && e.button !== 0) return;
    e.preventDefault();
    var url = $(this).attr("href");
    if (!url) return;
    window.open(url, "_blank", consultingVocStoryWinFeatures);
  });

  function openConsultingVocStoryFromBox(el) {
    var url = (el && el.getAttribute("data-consulting-voc-story-url")) || "";
    url = url.trim();
    if (!url) return;
    window.open(url, "_blank", consultingVocStoryWinFeatures);
  }

  // 컨설팅 VOC: 카드(이미지 포함) 자체 클릭/키보드로 스토리 열기
  // 영상보기/스토리보기 버튼 영역을 누른 경우엔 기존 버튼 동작을 우선한다.
  $(document).on("click", "[data-consulting-voc-story-url]", function (e) {
    var $target = $(e.target);
    if ($target.closest(".consulting-voc-actions").length) return;
    if ($target.closest("[data-consulting-voc-video], a[data-consulting-voc-story]").length) return;
    openConsultingVocStoryFromBox(this);
  });

  $(document).on("keydown", "[data-consulting-voc-story-url]", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    openConsultingVocStoryFromBox(this);
  });

  function initConsultingRoadmapPanelUI() {
    var $roadmapToggleBtn = $("[data-consulting-roadmap-toggle]");
    var $roadmapPanel = $("[data-consulting-roadmap-panel]");
    if (!$roadmapToggleBtn.length || !$roadmapPanel.length) return;
    var $roadmapWrap = $roadmapPanel.closest(".consulting-solution-grid-wrap");
    var $roadmapFrame = $roadmapPanel.find("[data-consulting-roadmap-frame]");
    var $roadmapEmpty = $roadmapPanel.find("[data-consulting-roadmap-empty]");
    var $roadmapCloseBtn = $roadmapPanel.find("[data-consulting-roadmap-close]");
    var roadmapPdfUrl =
      (typeof window.CONSULTING_BUSINESS_ROADMAP_PDF_URL === "string"
        ? window.CONSULTING_BUSINESS_ROADMAP_PDF_URL
        : ""
      ).trim();
    var roadmapAspectRatio =
      typeof window.CONSULTING_BUSINESS_ROADMAP_ASPECT_RATIO === "number" &&
      window.CONSULTING_BUSINESS_ROADMAP_ASPECT_RATIO > 0
        ? window.CONSULTING_BUSINESS_ROADMAP_ASPECT_RATIO
        : 1.414;
    var isRoadmapOpen = false;

    function roadmapViewerUrl(url) {
      if (!url) return "";
      var clean = String(url).trim();
      if (!clean) return "";
      var viewerParams = "toolbar=0&navpanes=0&scrollbar=0&page=1&zoom=page-fit&view=FitH";
      if (clean.indexOf("#") === -1) {
        return clean + "#" + viewerParams;
      }
      return clean + "&" + viewerParams;
    }

    function fitRoadmapFrame() {
      if (!$roadmapFrame.length) return;
      var frameWidth = $roadmapPanel.innerWidth() || $roadmapFrame.innerWidth() || 0;
      if (frameWidth <= 0) return;
      var targetHeight = Math.round(frameWidth * roadmapAspectRatio);
      var maxHeight = Math.round(window.innerHeight * 0.86);
      var minHeight = 420;
      var fittedHeight = Math.min(Math.max(targetHeight, minHeight), maxHeight);
      $roadmapPanel.css("--consulting-roadmap-frame-height", fittedHeight + "px");
    }

    function showRoadmap() {
      $roadmapToggleBtn.attr("aria-expanded", "true");
      $roadmapPanel
        .stop(true, true)
        .removeAttr("hidden")
        .hide()
        .fadeIn(260, function () {
          fitRoadmapFrame();
          if ($roadmapWrap.length) {
            var panelHeight = $roadmapPanel.outerHeight() || 0;
            var gridHeight = $roadmapWrap.outerHeight() || 0;
            if (panelHeight > gridHeight) {
              $roadmapWrap.css("min-height", panelHeight + "px");
            }
          }
          isRoadmapOpen = true;
        });
    }

    function hideRoadmap() {
      $roadmapToggleBtn.attr("aria-expanded", "false");
      $roadmapPanel.stop(true, true).fadeOut(240, function () {
        $roadmapPanel.attr("hidden", "hidden").css("display", "");
        $roadmapPanel.css("--consulting-roadmap-frame-height", "");
        if ($roadmapWrap.length) {
          $roadmapWrap.css("min-height", "");
        }
      });
      isRoadmapOpen = false;
    }

    if (roadmapPdfUrl) {
      $roadmapFrame.attr("src", roadmapViewerUrl(roadmapPdfUrl)).removeAttr("hidden");
      $roadmapEmpty.attr("hidden", "hidden");
    } else {
      $roadmapFrame.attr("src", "").attr("hidden", "hidden");
      $roadmapEmpty.removeAttr("hidden");
    }

    $roadmapToggleBtn.on("click", function () {
      if (isRoadmapOpen) {
        hideRoadmap();
      } else {
        showRoadmap();
      }
    });

    $roadmapCloseBtn.on("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      hideRoadmap();
    });

    $(document).on("keydown.consultingRoadmap", function (e) {
      if (!isRoadmapOpen) return;
      if (e.key !== "Escape") return;
      hideRoadmap();
    });

    $(document).on("click.consultingRoadmap", function (e) {
      if (!isRoadmapOpen) return;
      var $target = $(e.target);
      if ($target.closest("[data-consulting-roadmap-panel]").length) return;
      if ($target.closest("[data-consulting-roadmap-toggle]").length) return;
      hideRoadmap();
    });

    $(window).on("resize.consultingRoadmap", function () {
      if (!isRoadmapOpen) return;
      fitRoadmapFrame();
      if ($roadmapWrap.length) {
        var panelHeight = $roadmapPanel.outerHeight() || 0;
        $roadmapWrap.css("min-height", panelHeight ? panelHeight + "px" : "");
      }
    });
  }

  function bindConsultingPageFromJson() {
    initConsultingVocModalUI();
    initConsultingRoadmapPanelUI();
  }

  if ($(".consulting-main").length && window.SiteData) {
    window.SiteData.resolvePayload({
      url: "data/consulting-page.json",
      inlineId: "consulting-page-data",
      validate: window.SiteData.validateConsultingPagePayload,
      defaults: DEFAULT_CONSULTING_PAGE,
    }).then(function (data) {
      var cfg = $.extend(true, {}, DEFAULT_CONSULTING_PAGE, data || {});
      window.CONSULTING_VOC_VIDEO_URLS = cfg.vocVideoUrls;
      window.CONSULTING_BUSINESS_ROADMAP_PDF_URL = cfg.businessRoadmapPdfUrl;
      window.CONSULTING_BUSINESS_ROADMAP_ASPECT_RATIO =
        typeof cfg.businessRoadmapAspectRatio === "number" && cfg.businessRoadmapAspectRatio > 0
          ? cfg.businessRoadmapAspectRatio
          : DEFAULT_CONSULTING_PAGE.businessRoadmapAspectRatio;
      bindConsultingPageFromJson();
    });
  } else if ($(".consulting-main").length) {
    window.CONSULTING_VOC_VIDEO_URLS = DEFAULT_CONSULTING_PAGE.vocVideoUrls;
    window.CONSULTING_BUSINESS_ROADMAP_PDF_URL = DEFAULT_CONSULTING_PAGE.businessRoadmapPdfUrl;
    window.CONSULTING_BUSINESS_ROADMAP_ASPECT_RATIO = DEFAULT_CONSULTING_PAGE.businessRoadmapAspectRatio;
    bindConsultingPageFromJson();
  }

  // 컨설팅 페이지: 산업별 고객사 필터 (칩 data-industry-filter ↔ 카드 data-industry 일치)
  var $industrySection = $(".consulting-extra-section");
  var $industryChips = $industrySection.find("[data-industry-filter]");
  var $industryGrid = $industrySection.find("[data-industry-grid]");
  var $allGridCards = $industryGrid.find(".industry-logo-card");
  var $industryCards = $industryGrid.find(".industry-logo-card[data-industry]");
  var $allShowcaseCards = $industryGrid.find("[data-industry-all-showcase]");
  var $industryPrompt = $industrySection.find("[data-industry-select-prompt]");
  var $industryEmpty = $industrySection.find("[data-industry-empty]");
  var $industryTotal = $("[data-industry-total]");
  var $industryVisible = $("[data-industry-visible]");
  if ($industryChips.length && $industryGrid.length) {
    var totalCount = $industryCards.length;
    if ($industryTotal.length) {
      $industryTotal.text(totalCount);
    }

    function setVisibleCount() {
      var visibleCount = $industryGrid.find(".industry-logo-card:visible").length;
      if ($industryVisible.length) {
        $industryVisible.text(visibleCount);
      }
    }

    function applyIndustryFilter(targetIndustry) {
      $allGridCards.removeClass("industry-logo-card--in industry-logo-card--appear").css("animation-delay", "").hide();

      function revealCards($cards) {
        $cards.each(function () {
          $(this)
            .show()
            .addClass("industry-logo-card--appear")
            .css("animation-delay", "");
        });
      }

      if (targetIndustry === "all") {
        if ($industryPrompt.length) {
          $industryPrompt.removeAttr("hidden");
        }
        if ($industryEmpty.length) {
          $industryEmpty.attr("hidden", "hidden");
        }
        if ($allShowcaseCards.length) {
          revealCards($allShowcaseCards);
        } else {
          revealCards($industryCards);
        }
      } else {
        var visibleInCategory = 0;
        var $matched = $();
        $industryCards.each(function () {
          var $c = $(this);
          var ind = ($c.attr("data-industry") || "").trim();
          if (ind === targetIndustry) {
            $matched = $matched.add($c);
            visibleInCategory += 1;
          }
        });
        revealCards($matched);
        if ($industryPrompt.length) {
          $industryPrompt.removeAttr("hidden");
        }
        if ($industryEmpty.length) {
          if (visibleInCategory === 0) {
            $industryEmpty.removeAttr("hidden");
          } else {
            $industryEmpty.attr("hidden", "hidden");
          }
        }
      }
      setVisibleCount();
    }

    function collapseIndustryGrid() {
      $industryChips.removeClass("is-active").attr("aria-pressed", "false");
      $allGridCards.hide();
      $industryGrid.addClass("industry-logo-grid--collapsed");
      if ($industryPrompt.length) {
        $industryPrompt.removeAttr("hidden");
      }
      if ($industryEmpty.length) {
        $industryEmpty.attr("hidden", "hidden");
      }
      setVisibleCount();
    }

    $industryChips.on("click", function () {
      var $btn = $(this);
      var target = ($btn.attr("data-industry-filter") || "").trim();
      var wasActive = $btn.hasClass("is-active");
      if (wasActive) {
        collapseIndustryGrid();
        return;
      }
      $industryChips.removeClass("is-active").attr("aria-pressed", "false");
      $btn.addClass("is-active").attr("aria-pressed", "true");
      $industryGrid.removeClass("industry-logo-grid--collapsed");
      applyIndustryFilter(target);
    });

    var industryInitParam = "";
    try {
      industryInitParam = new URLSearchParams(window.location.search).get("industry") || "";
    } catch (e) {
      industryInitParam = "";
    }
    if (industryInitParam.toLowerCase() === "all") {
      var $allChip = $industryChips.filter('[data-industry-filter="all"]').first();
      if ($allChip.length) {
        $industryChips.removeClass("is-active").attr("aria-pressed", "false");
        $allChip.addClass("is-active").attr("aria-pressed", "true");
      }
      $industryGrid.removeClass("industry-logo-grid--collapsed");
      applyIndustryFilter("all");
    } else {
      collapseIndustryGrid();
    }
  }

  // 컨설팅: 고객사 로고 — assets/customer-logos/{기업명}.png 우선, 없으면 .svg, 둘 다 없으면 비움
  if ($industrySection.length) {
    function industryLogoIsPlaceholderLabel(name) {
      return /^대표 고객사\s*\d+$/.test(name) || /^기업명\s*\d+$/.test(name);
    }
    function industryLogoUrl(companyName, ext) {
      return "assets/customer-logos/" + encodeURIComponent(companyName) + ext;
    }
    function industryLogoTryThenAppend($mark, url, onFail) {
      var probe = new Image();
      probe.onload = function () {
        var img = document.createElement("img");
        img.className = "industry-logo-img";
        img.setAttribute("alt", "");
        img.setAttribute("decoding", "async");
        img.setAttribute("loading", "lazy");
        img.src = url;
        $mark.append(img);
        $mark.find(".industry-logo-placeholder").attr("hidden", "hidden");
      };
      probe.onerror = onFail;
      probe.src = url;
    }
    $industrySection.find(".industry-logo-mark--brand").each(function () {
      var $mark = $(this);
      var $card = $mark.closest(".industry-logo-card");
      if ($card.is(".industry-logo-card--all-rest, .industry-logo-card--ellipsis")) return;
      var nameFromAttr = ($card.attr("data-company-logo-name") || "").trim();
      var nameFromText = ($card.find(".industry-logo-name").first().text() || "").trim();
      var companyName = nameFromAttr || nameFromText;
      if (!companyName || industryLogoIsPlaceholderLabel(companyName)) return;

      industryLogoTryThenAppend($mark, industryLogoUrl(companyName, ".png"), function () {
        industryLogoTryThenAppend($mark, industryLogoUrl(companyName, ".svg"), function () {});
      });
    });
  }

  /** 성공 사례 게시판: 페이지당 게시글 수(향후 페이지네이션 구현 시 동일 값 사용) */
  var TESTIMONIALS_BOARD_PAGE_SIZE = 10;
  window.TESTIMONIALS_BOARD_PAGE_SIZE = TESTIMONIALS_BOARD_PAGE_SIZE;
  var TESTIMONIALS_CASES_CACHE_KEY = "testimonials.board.cases.cache.v2";
  var TESTIMONIALS_SCHEMA_LIST = "cases-list.v1";
  var TESTIMONIALS_SCHEMA_DETAIL = "cases-detail.v1";
  var TESTIMONIALS_HIDDEN_MESSAGE = "해당 게시글은 숨김 처리되었습니다.";
  var boardCasesListMode = "legacy";
  var boardCaseDetailCache = {};

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stripHtmlToText(s) {
    return String(s == null ? "" : s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  function renderTestimonialsBoardSkeleton(count) {
    var $list = $(".testimonials-board .board-list");
    if (!$list.length) return;
    if ($list.children().length) return;
    var n = Math.max(2, Number(count) || 3);
    var html = "";
    for (var i = 0; i < n; i += 1) {
      html +=
        '<li class="board-item" aria-hidden="true">' +
        '<div style="display:flex;gap:1.1rem;align-items:stretch;width:100%;">' +
        '<span class="board-thumb-link" style="background:rgba(255,255,255,0.08);"></span>' +
        '<span class="board-meta">' +
        '<span style="display:block;width:68%;height:16px;border-radius:6px;background:rgba(255,255,255,0.12);"></span>' +
        '<span style="display:block;width:44%;height:14px;border-radius:6px;background:rgba(255,255,255,0.08);"></span>' +
        "</span>" +
        "</div>" +
        "</li>";
    }
    $list.html(html);
  }

  function readTestimonialsCasesCache() {
    try {
      var raw = localStorage.getItem(TESTIMONIALS_CASES_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeTestimonialsCasesCache(payload) {
    try {
      if (!payload || !Array.isArray(payload.items)) return;
      localStorage.setItem(TESTIMONIALS_CASES_CACHE_KEY, JSON.stringify(payload));
    } catch (e) {}
  }

  function clearTestimonialsCasesCache() {
    try {
      localStorage.removeItem(TESTIMONIALS_CASES_CACHE_KEY);
    } catch (e) {}
  }

  function buildTestimonialsBoardFromCasesPayload(raw) {
    var $list = $(".testimonials-board .board-list");
    if (!$list.length) return;
    var arr = raw && Array.isArray(raw.items) ? raw.items : [];
    boardCasesListMode = raw && raw.schema === TESTIMONIALS_SCHEMA_LIST ? "split" : "legacy";
    if (!arr.length) {
      $list.empty();
      return;
    }
    var html = arr
      .map(function (item, idx) {
        var title = item && item.title ? item.title : "고객 사례";
        var author = item && item.authorName ? item.authorName : "-";
        var thumb = (item && (item.thumbnailUrl || item.imageUrl || item.featuredImageUrl)) || "";
        var contentHtml = (item && (item.contentHtml || item.content)) || "";
        var contentPlain =
          boardCasesListMode === "split"
            ? String((item && item.searchText) || "").trim() || stripHtmlToText(contentHtml)
            : stripHtmlToText(contentHtml);
        var industry = Array.isArray(item && item.industryTags) ? item.industryTags.join("|") : "";
        var scale = (item && item.companySize) || "";
        var consulting = Array.isArray(item && item.consultingTypeTags) ? item.consultingTypeTags.join("|") : "";
        var caseId = (item && item.id) || "case-" + (idx + 1);
        var shareHref = "testimonials.html?id=" + encodeURIComponent(caseId);
        var modeAttr =
          boardCasesListMode === "split"
            ? ' data-board-case-split="1"'
            : ' data-board-popup-content-html="' + escapeHtml(contentHtml) + '"';
        return (
          '<li class="board-item" data-admin-item-key="' +
          escapeHtml(caseId) +
          '" data-testimonial-industry="' +
          escapeHtml(industry) +
          '" data-testimonial-scale="' +
          escapeHtml(scale) +
          '" data-testimonial-consulting="' +
          escapeHtml(consulting) +
          '" data-board-popup-title="' +
          escapeHtml(title) +
          '"' +
          modeAttr +
          ' data-board-search-text="' +
          escapeHtml(contentPlain) +
          '" data-board-link-href="' +
          escapeHtml(shareHref) +
          '">' +
          '<a class="board-link" href="' +
          escapeHtml(shareHref) +
          '" style="display:flex;gap:1.1rem;align-items:stretch;width:100%;text-decoration:none;color:inherit;">' +
          '<span class="board-thumb-link">' +
          (thumb
            ? '<img class="board-thumb-image" src="' + escapeHtml(thumb) + '" alt="' + escapeHtml(title) + '" loading="lazy" decoding="async" />'
            : '<span class="board-thumb-image" aria-hidden="true"></span>') +
          "</span>" +
          '<span class="board-meta">' +
          '<strong class="board-title">' +
          escapeHtml(title) +
          "</strong>" +
          '<span class="board-author">' +
          escapeHtml(author) +
          "</span>" +
          "</span>" +
          "</a>" +
          "</li>"
        );
      })
      .join("");
    $list.html(html);
  }

  function fetchTestimonialsCasesBoardPayload() {
    if (!window.SiteData) return Promise.resolve({ mode: "legacy", payload: { items: [] } });
    if (window.SiteData.isFileProtocol && window.SiteData.isFileProtocol()) {
      return window.SiteData.resolveSettingPayload({
        settingKey: "admin.local.cases.v1",
        url: "data/cases.json",
        inlineId: "",
        validate: function (d) {
          return !!(d && Array.isArray(d.items));
        },
        defaults: { items: [] },
      }).then(function (leg) {
        return { mode: "legacy", payload: leg || { items: [] } };
      });
    }
    return fetch("data/cases-list.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (d) {
        // items가 비어 있으면 split으로 채택하지 않음 → Supabase·cases.json 폴백 (빈 placeholder JSON 배포 대응)
        if (
          d &&
          d.schema === TESTIMONIALS_SCHEMA_LIST &&
          Array.isArray(d.items) &&
          d.items.length > 0
        ) {
          return { mode: "split", payload: d };
        }
        return null;
      })
      .then(function (got) {
        if (got) return got;
        return window.SiteData.resolveSettingPayload({
          settingKey: "admin.local.cases.v1",
          url: "data/cases.json",
          inlineId: "",
          validate: function (d2) {
            return !!(d2 && Array.isArray(d2.items));
          },
          defaults: { items: [] },
        }).then(function (leg) {
          return { mode: "legacy", payload: leg || { items: [] } };
        });
      });
  }

  if ($(".testimonials-board .board-list").length && window.SiteData) {
    renderTestimonialsBoardSkeleton(3);
    var cachedCasesPayload = readTestimonialsCasesCache();
    if (cachedCasesPayload && cachedCasesPayload.items && cachedCasesPayload.items.length) {
      boardCasesListMode = cachedCasesPayload.schema === TESTIMONIALS_SCHEMA_LIST ? "split" : "legacy";
      buildTestimonialsBoardFromCasesPayload(cachedCasesPayload);
      applyTestimonialsBoardFilter();
    }
    fetchTestimonialsCasesBoardPayload().then(function (res) {
      var next = (res && res.payload) || { items: [] };
      if (res && res.mode === "split") next.schema = TESTIMONIALS_SCHEMA_LIST;
      if (next.items && next.items.length) {
        buildTestimonialsBoardFromCasesPayload(next);
        applyTestimonialsBoardFilter();
        writeTestimonialsCasesCache(next);
      } else {
        buildTestimonialsBoardFromCasesPayload(next);
        applyTestimonialsBoardFilter();
        clearTestimonialsCasesCache();
      }
      if (typeof window.__applyTestimonialsUrlCase === "function") {
        window.__applyTestimonialsUrlCase();
      }
    });
  }

  // 고객 사례 페이지: 상세분류 + 검색어로 게시글 필터
  // 게시글 data-testimonial-* 는 Admin 체크박스 분류와 동일 문자열; 복수 선택 시 "|" 구분(예: ICT·전자|금융)
  function applyTestimonialsBoardFilter() {
    var $boardList = $(".testimonials-board .board-list");
    if (!$boardList.length) return;

    var totalPosts = $boardList.find(".board-item").length;

    var $q = $("#successSearchInput");
    var q = ($q.length ? String($q.val() || "") : "").trim().toLowerCase();

    function selectedValues(group) {
      return $(".testimonials-filters .filter-chip[data-filter-group='" + group + "'][aria-pressed='true']")
        .map(function () {
          var v = $(this).attr("data-filter-value");
          if (v == null || v === "") v = $(this).text().trim();
          return v.trim();
        })
        .get();
    }

    function splitCategoryAttr(raw) {
      if (!raw || !String(raw).trim()) return [];
      return String(raw)
        .split("|")
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
    }

    /** 선택된 칩이 없으면 통과. 있으면 게시글 해당 축 값(단일 또는 |분리) 중 하나라도 선택값과 겹치면 통과 */
    function dimMatches(postAttr, selected) {
      if (!selected.length) return true;
      var postVals = splitCategoryAttr(postAttr);
      if (!postVals.length) return false;
      return selected.some(function (sel) {
        return postVals.indexOf(sel) !== -1;
      });
    }

    var industries = selectedValues("industry");
    var scales = selectedValues("scale");
    var consultings = selectedValues("consulting");

    function matchesFilters($item) {
      var ind = $item.attr("data-testimonial-industry");
      var sc = $item.attr("data-testimonial-scale");
      var co = $item.attr("data-testimonial-consulting");
      if (!dimMatches(ind, industries)) return false;
      if (!dimMatches(sc, scales)) return false;
      if (!dimMatches(co, consultings)) return false;
      return true;
    }

    function matchesQuery($item) {
      if (!q) return true;
      var hay =
        $item.find(".board-title").text() +
        " " +
        $item.find(".board-author").text() +
        " " +
        String($item.attr("data-board-search-text") || "");
      return hay.toLowerCase().indexOf(q) !== -1;
    }

    var visible = 0;
    $boardList.find(".board-item").each(function () {
      var $item = $(this);
      var ok = matchesFilters($item) && matchesQuery($item);
      if (ok) {
        $item.removeAttr("hidden");
        visible++;
      } else {
        $item.attr("hidden", "hidden");
      }
    });

    var $empty = $("#boardEmptyMessage");
    if ($empty.length) {
      if (visible === 0) {
        if (totalPosts === 0) {
          $empty.text("등록된 성공 사례가 없습니다.");
        } else {
          $empty.text("검색 조건에 맞는 성공 사례가 없습니다.");
        }
        $empty.removeAttr("hidden");
      } else {
        $empty.attr("hidden", "hidden");
      }
    }

    var hasFilter =
      q !== "" ||
      industries.length > 0 ||
      scales.length > 0 ||
      consultings.length > 0;
    var showPagination = !hasFilter && totalPosts > TESTIMONIALS_BOARD_PAGE_SIZE;
    var $pag = $(".testimonials-board .board-pagination");
    if ($pag.length) {
      if (showPagination) {
        $pag.removeAttr("hidden");
      } else {
        $pag.attr("hidden", "hidden");
      }
    }
  }

  if ($(".testimonials-board .board-list").length) {
    applyTestimonialsBoardFilter();
  }

  $(document).on("click", ".testimonials-filters .filter-chip", function () {
    var $btn = $(this);
    var on = $btn.attr("aria-pressed") === "true";
    $btn.attr("aria-pressed", on ? "false" : "true");
    applyTestimonialsBoardFilter();
  });

  $(".testimonials-search-form").on("submit", function (e) {
    e.preventDefault();
    applyTestimonialsBoardFilter();
  });

  // 현재 연도 표시
  $("#footer-year").text(new Date().getFullYear());

  // 스무스 스크롤
  $(".nav-menu a[href^='#'], .hero-actions a[href^='#']").on(
    "click",
    function (event) {
      const targetId = $(this).attr("href");
      const $target = $(targetId);
      if ($target.length) {
        event.preventDefault();
        const headerHeight = $(".site-header").outerHeight() || 0;
        const targetOffset = $target.offset().top - headerHeight - 12;

        $("html, body").animate(
          {
            scrollTop: targetOffset,
          },
          500
        );
      }
    }
  );

  // 모바일 내비게이션 토글
  $(".nav-toggle").on("click", function () {
    $(".nav-menu").toggleClass("open");
  });

  $(".nav-menu a").on("click", function () {
    $(".nav-menu").removeClass("open");
  });

  // Testimonials 슬라이더
  const $testimonials = $(".testimonial");
  let currentIndex = 0;

  function showTestimonial(index) {
    $testimonials.removeClass("active");
    $testimonials.eq(index).addClass("active");
  }

  $(".testimonials-slider .next").on("click", function () {
    currentIndex = (currentIndex + 1) % $testimonials.length;
    showTestimonial(currentIndex);
  });

  $(".testimonials-slider .prev").on("click", function () {
    currentIndex = (currentIndex - 1 + $testimonials.length) % $testimonials.length;
    showTestimonial(currentIndex);
  });

  // 문의 폼 유효성 검사
  $("#contact-form").on("submit", function (event) {
    event.preventDefault();

    const $form = $(this);
    const $message = $("#form-message");

    const name = $.trim($("#name").val());
    const email = $.trim($("#email").val());
    const text = $.trim($("#message").val());

    if (!name || !email || !text) {
      $message
        .text("필수 항목(*)을 모두 입력해 주세요.")
        .removeClass("success")
        .addClass("error");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      $message
        .text("이메일 형식이 올바르지 않습니다.")
        .removeClass("success")
        .addClass("error");
      return;
    }

    // 실제 전송은 하지 않고, 전송이 완료된 것처럼 표시
    $message
      .text("문의가 정상적으로 접수되었습니다. 빠른 시일 내에 연락드리겠습니다.")
      .removeClass("error")
      .addClass("success");

    // 추후 API 연동을 위해 여기서만 폼 데이터 처리
    console.log("Contact form data (mock submit):", $form.serialize());
  });

  // 성공 사례 게시판: 게시글 블록 클릭 시 본문 팝업 + URL 동기화(?id=)
  var $boardOverlay = $("#boardArticleOverlay");
  var $boardClose = $("#boardArticleClose");
  var AUTHOR_POSTS_STORAGE_KEY = "testimonialsBoardPosts";
  var boardModalScrollTop = 0;
  var boardModalBodyLockPrev = null;
  var boardCaseModalPushed = false;
  var boardCaseClosingByScriptBack = false;

  function testimonialsBoardReadCaseIdParam() {
    try {
      return (new URLSearchParams(window.location.search).get("id") || "").trim();
    } catch (e) {
      return "";
    }
  }

  function testimonialsBoardUrlWithId(id) {
    var u = new URL(window.location.href);
    if (id) u.searchParams.set("id", id);
    else u.searchParams.delete("id");
    return u.pathname + u.search + u.hash;
  }

  function testimonialsCaseDetailUrl(caseId) {
    if (!/^[a-zA-Z0-9_-]+$/.test(caseId)) return "";
    try {
      return new URL("data/cases/" + encodeURIComponent(caseId) + ".json", window.location.href).href;
    } catch (e) {
      return "";
    }
  }

  function fetchTestimonialsCaseDetail(caseId) {
    if (boardCaseDetailCache[caseId]) return Promise.resolve(boardCaseDetailCache[caseId]);
    var url = testimonialsCaseDetailUrl(caseId);
    if (!url) return Promise.reject(new Error("bad id"));
    return fetch(url, { cache: "default" })
      .then(function (r) {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(function (d) {
        if (!d || d.schema !== TESTIMONIALS_SCHEMA_DETAIL) throw new Error("bad detail");
        boardCaseDetailCache[caseId] = d;
        return d;
      });
  }

  function collectBoardPosts() {
    var posts = [];
    $(".board-list .board-item").each(function (idx) {
      var $item = $(this);
      var $thumb = $item.find(".board-thumb-image").first();
      var $title = $item.find(".board-title").first();
      var $author = $item.find(".board-author").first();
      var $content = $item.find("[data-admin-field='content']").first();
      posts.push({
        id: $item.attr("data-admin-item-key") || "board-post-" + String(idx + 1),
        thumbnail: ($thumb.attr("src") || "").trim(),
        title: $title.text().trim(),
        author: $author.text().trim(),
        content: $content.text().trim(),
        industry: ($item.attr("data-testimonial-industry") || "").trim(),
        scale: ($item.attr("data-testimonial-scale") || "").trim(),
        consulting: ($item.attr("data-testimonial-consulting") || "").trim(),
      });
    });
    return posts;
  }

  function openAuthorPostsPopup(authorName) {
    var posts = collectBoardPosts();
    try {
      localStorage.setItem(AUTHOR_POSTS_STORAGE_KEY, JSON.stringify(posts));
    } catch (err) {
      console.warn("testimonials board cache save failed:", err);
    }

    var popupUrl = "testimonials-author-posts.html?author=" + encodeURIComponent(authorName || "");
    var popupFeatures = "noopener,noreferrer,width=1100,height=860";
    window.open(popupUrl, "_blank", popupFeatures);
  }

  function closeBoardArticleVisualOnly() {
    $boardOverlay.addClass("hidden").attr("aria-hidden", "true");
    if (boardModalBodyLockPrev) {
      document.documentElement.style.overflow = boardModalBodyLockPrev.htmlOverflow;
      document.body.style.overflow = boardModalBodyLockPrev.overflow;
      document.body.style.position = boardModalBodyLockPrev.position;
      document.body.style.top = boardModalBodyLockPrev.top;
      document.body.style.left = boardModalBodyLockPrev.left;
      document.body.style.right = boardModalBodyLockPrev.right;
      document.body.style.width = boardModalBodyLockPrev.width;
      window.scrollTo(0, boardModalScrollTop);
      boardModalBodyLockPrev = null;
    }
    $boardClose.off("keydown.boardArticle");
    $(document).off("keydown.boardArticle");
  }

  function closeBoardArticle() {
    if (!$boardOverlay.length) return;
    if (boardCaseModalPushed) {
      boardCaseModalPushed = false;
      boardCaseClosingByScriptBack = true;
      history.back();
      return;
    }
    if ($(".testimonials-board .board-list").length && testimonialsBoardReadCaseIdParam()) {
      try {
        history.replaceState(history.state || {}, "", testimonialsBoardUrlWithId(""));
      } catch (e2) {}
    }
    closeBoardArticleVisualOnly();
  }

  function openBoardArticle(title, contentHtml) {
    var $articleTitle = $("#boardArticleTitle");
    var $articleContent = $("#boardArticleContent");
    if ($articleTitle.length) $articleTitle.text(String(title || ""));
    if ($articleContent.length) $articleContent.html(String(contentHtml || ""));
    $boardOverlay.removeClass("hidden").attr("aria-hidden", "false");
    if (!boardModalBodyLockPrev) {
      boardModalScrollTop =
        window.pageYOffset ||
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      boardModalBodyLockPrev = {
        htmlOverflow: document.documentElement.style.overflow,
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
      };
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = -boardModalScrollTop + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }
    $boardClose.focus();
    $(document).off("keydown.boardArticle").on("keydown.boardArticle", function (e) {
      if (e.key === "Escape") {
        closeBoardArticle();
      }
    });
  }

  function openBoardArticleHiddenNotice() {
    openBoardArticle("알림", '<p class="board-article-hidden-msg">' + escapeHtml(TESTIMONIALS_HIDDEN_MESSAGE) + "</p>");
  }

  function openBoardByCaseId(caseId, opts) {
    var o = opts || {};
    if (!$boardOverlay.length) return;
    if (!caseId || !/^[a-zA-Z0-9_-]+$/.test(caseId)) {
      openBoardArticleHiddenNotice();
      return;
    }
    if (o.pushUrl) {
      try {
        var openNow = !$boardOverlay.hasClass("hidden");
        if (openNow) {
          history.replaceState({ testimonialsCase: caseId }, "", testimonialsBoardUrlWithId(caseId));
        } else {
          history.pushState({ testimonialsCase: caseId }, "", testimonialsBoardUrlWithId(caseId));
          boardCaseModalPushed = true;
        }
      } catch (e1) {
        boardCaseModalPushed = false;
      }
    } else {
      boardCaseModalPushed = false;
    }
    var $row = $(".board-list .board-item").filter(function () {
      return String($(this).attr("data-admin-item-key") || "") === caseId;
    });
    var titleFromDom = $row.find(".board-title").first().text().trim();
    var useSplit = boardCasesListMode === "split" || $row.attr("data-board-case-split") === "1";
    if (useSplit) {
      var t = titleFromDom || caseId;
      openBoardArticle(t, '<p class="board-article-loading">불러오는 중…</p>');
      fetchTestimonialsCaseDetail(caseId)
        .then(function (d) {
          openBoardArticle(d.title || t, d.contentHtml || "");
        })
        .catch(function () {
          openBoardArticleHiddenNotice();
        });
      return;
    }
    var inlineHtml = $row.attr("data-board-popup-content-html") || "";
    var title = $row.attr("data-board-popup-title") || titleFromDom || caseId;
    if (!inlineHtml) {
      openBoardArticleHiddenNotice();
      return;
    }
    openBoardArticle(title, inlineHtml);
  }

  window.__applyTestimonialsUrlCase = function () {
    if (!$(".testimonials-board .board-list").length || !$boardOverlay.length) return;
    var id = testimonialsBoardReadCaseIdParam();
    if (!id) return;
    openBoardByCaseId(id, { pushUrl: false });
  };

  window.addEventListener("popstate", function () {
    if (!$boardOverlay.length || $boardOverlay.hasClass("hidden")) return;
    if (boardCaseClosingByScriptBack) {
      boardCaseClosingByScriptBack = false;
      closeBoardArticleVisualOnly();
      return;
    }
    closeBoardArticleVisualOnly();
    boardCaseModalPushed = false;
  });

  $(document).on("click", ".testimonials-board .board-item", function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== 0) return;
    if ($(e.target).closest(".board-author").length) return;
    e.preventDefault();
    var $item = $(this);
    var caseId = ($item.attr("data-admin-item-key") || "").trim();
    if (!caseId) return;
    var popupUrl;
    try {
      popupUrl = new URL("testimonials.html?id=" + encodeURIComponent(caseId), window.location.href).href;
    } catch (err) {
      return;
    }
    var popupFeatures = "noopener,noreferrer,width=1080,height=900";
    window.open(popupUrl, "_blank", popupFeatures);
  });

  $(document).on("click", ".board-author", function (e) {
    e.preventDefault();
    openAuthorPostsPopup($(this).text().trim());
  });

  $boardClose.on("click", function () {
    closeBoardArticle();
  });

  $boardOverlay.on("click", function (e) {
    if (e.target === $boardOverlay[0]) {
      closeBoardArticle();
    }
  });

  $boardOverlay.find(".board-article-modal").on("click", function (e) {
    e.stopPropagation();
  });

  // 가인지 경영: 비전 본문 추가 펼침(열어보기)
  var $gaingeVisionExpand = $("#gainge-vision-expand");
  var $gaingeVisionToggle = $("#gainge-vision-toggle");
  if ($gaingeVisionExpand.length && $gaingeVisionToggle.length) {
    $gaingeVisionToggle.on("click", function () {
      var open = $gaingeVisionExpand.hasClass("is-open");
      if (open) {
        $gaingeVisionExpand.removeClass("is-open").attr("aria-hidden", "true");
        $gaingeVisionToggle.attr("aria-expanded", "false").text("열어보기");
      } else {
        $gaingeVisionExpand.addClass("is-open").attr("aria-hidden", "false");
        $gaingeVisionToggle.attr("aria-expanded", "true").text("접기");
      }
    });
  }

  // 가인지 경영: 선언 본문 추가 펼침(비전·가인지 경영 소개와 동일 패턴)
  var $gaingeDeclarationExpand = $("#gainge-declaration-expand");
  var $gaingeDeclarationToggle = $("#gainge-declaration-toggle");
  if ($gaingeDeclarationExpand.length && $gaingeDeclarationToggle.length) {
    $gaingeDeclarationToggle.on("click", function () {
      var open = $gaingeDeclarationExpand.hasClass("is-open");
      if (open) {
        $gaingeDeclarationExpand.removeClass("is-open").attr("aria-hidden", "true");
        $gaingeDeclarationToggle.attr("aria-expanded", "false").text("열어보기");
      } else {
        $gaingeDeclarationExpand.addClass("is-open").attr("aria-hidden", "false");
        $gaingeDeclarationToggle.attr("aria-expanded", "true").text("접기");
      }
    });
  }

  // 가인지 경영: 인사말 본문 추가 펼침(열어보기)
  var $gaingeGreetingExpand = $("#gainge-greeting-expand");
  var $gaingeGreetingToggle = $("#gainge-greeting-toggle");
  if ($gaingeGreetingExpand.length && $gaingeGreetingToggle.length) {
    var $gaingeGreetingSection = $gaingeGreetingExpand.closest(".gainge-greeting-section");
    var gaingeGreetingCollapseFallbackTimer = null;
    var gaingeGreetingCollapseTransitionHandler = null;

    function gaingeGreetingAbortPendingCollapse() {
      if (gaingeGreetingCollapseFallbackTimer) {
        clearTimeout(gaingeGreetingCollapseFallbackTimer);
        gaingeGreetingCollapseFallbackTimer = null;
      }
      var expandElAbort = $gaingeGreetingExpand.get(0);
      if (expandElAbort && gaingeGreetingCollapseTransitionHandler) {
        expandElAbort.removeEventListener("transitionend", gaingeGreetingCollapseTransitionHandler);
        gaingeGreetingCollapseTransitionHandler = null;
      }
    }

    $gaingeGreetingToggle.on("click", function () {
      var open = $gaingeGreetingExpand.hasClass("is-open");
      if (open) {
        $gaingeGreetingExpand.removeClass("is-open").attr("aria-hidden", "true");
        $gaingeGreetingToggle.attr("aria-expanded", "false").text("열어보기");

        var expandEl = $gaingeGreetingExpand.get(0);
        var sectionElClose = $gaingeGreetingSection.get(0);
        var collapseDone = false;

        function gaingeGreetingApplyCollapsedLayout() {
          if (collapseDone) return;
          collapseDone = true;
          gaingeGreetingAbortPendingCollapse();
          $gaingeGreetingSection.removeClass("is-greeting-expanded");
          if (sectionElClose) sectionElClose.style.removeProperty("--gainge-greeting-spacer-lock");
        }

        gaingeGreetingCollapseTransitionHandler = function (ev) {
          if (!expandEl || ev.target !== expandEl) return;
          if (ev.propertyName !== "grid-template-rows") return;
          gaingeGreetingApplyCollapsedLayout();
        };

        expandEl.addEventListener("transitionend", gaingeGreetingCollapseTransitionHandler);
        gaingeGreetingCollapseFallbackTimer = setTimeout(gaingeGreetingApplyCollapsedLayout, 500);

      } else {
        gaingeGreetingAbortPendingCollapse();

        var spacerEl = $gaingeGreetingSection.find(".gainge-greeting-flex-spacer").get(0);
        var sectionElOpen = $gaingeGreetingSection.get(0);
        if (spacerEl && sectionElOpen) {
          sectionElOpen.style.setProperty(
            "--gainge-greeting-spacer-lock",
            spacerEl.offsetHeight + "px"
          );
        }
        $gaingeGreetingExpand.addClass("is-open").attr("aria-hidden", "false");
        $gaingeGreetingToggle.attr("aria-expanded", "true").text("닫기");
        $gaingeGreetingSection.addClass("is-greeting-expanded");
      }
    });
  }

  // 가인지 경영 소개: 첫째~끝 펼침(열어보기)
  var $gaingeMgmtAboutExpand = $("#gainge-mgmt-about-expand");
  var $gaingeMgmtAboutToggle = $("#gainge-mgmt-about-toggle");
  if ($gaingeMgmtAboutExpand.length && $gaingeMgmtAboutToggle.length) {
    $gaingeMgmtAboutToggle.on("click", function () {
      var open = $gaingeMgmtAboutExpand.hasClass("is-open");
      if (open) {
        $gaingeMgmtAboutExpand.removeClass("is-open").attr("aria-hidden", "true");
        $gaingeMgmtAboutToggle.attr("aria-expanded", "false").text("열어보기");
      } else {
        $gaingeMgmtAboutExpand.addClass("is-open").attr("aria-hidden", "false");
        $gaingeMgmtAboutToggle.attr("aria-expanded", "true").text("접기");
      }
    });
  }

  // 가인지 사업: 상세는 항상 첫 줄 아래(두 줄 사이) 같은 위치에 펼침
  var $gaingeBusinessDetail = $("#gainge-business-detail");
  var $gaingeBusinessCircles = $(".gainge-business-circle");
  if ($gaingeBusinessDetail.length && $gaingeBusinessCircles.length) {
    var $gaingeBusinessRowsWrap = $(".gainge-business-rows");
    var $gaingeBusinessPanel = $gaingeBusinessDetail.find(".gainge-business-detail-panel");
    var gaingeBusinessDescriptions = {
      consulting:
        "가인지컨설팅그룹은 기업의 고유한 사명과 사업 운영, 그리고 조직문화가 하나의 방향으로 정렬되도록 돕습니다. 우리는 단순히 전략적인 제안을 내놓는 데 그치지 않고, <strong>현장에서의 변화가 이뤄지도록 실행 과정을 밀착 지원</strong>합니다. 이를 통해 고객사가 목표로 하는 실질적인 변화를 기업 내부에 안착시키며, 요청하신 경영상의 변화와 성과를 현실로 만들어내는 실행 중심의 파트너십을 제공합니다.",
      coaching:
        "경영자의 고립된 결단의 순간을 함께하는 가인지의 코칭은 리더의 머릿속에만 머무는 지식을 조직의 공용 언어로 바꾸는 지적 파트너십입니다. <strong>질문을 던지는 방식에서 벗어나, 필요한 경영 도구와 방법론을 직접 전수</strong>하는 과정을 병행하여 경영자가 직면한 난제를 정밀하게 해결하도록 돕습니다. 이는 리더십이 구성원의 몰입과 실질적인 실행으로 이어지게 만드는 과정이며, 의사결정의 불확실성을 낮추고 경영의 확신을 더하는 데 기여합니다.",
      "edu-platform":
        "가인지캠퍼스는 <strong>현장의 생생한 성공 사례를 지식 자산으로 바꾸어 시공간의 제약 없이 제공</strong>함으로써 기업의 상시 학습 체계를 구축합니다. 수많은 컨설팅 경험을 바탕으로 제작된 콘텐츠는 이론보다 즉각 활용 가능한 도구와 템플릿을 포함하여 학습과 실행 사이의 간극을 획기적으로 줄여줍니다. 단순한 교육을 넘어 조직 내 지식 공유 문화를 만들고, 구성원 모두의 역량을 상향 평준화하여 변화에 강한 조직을 만드는 경영 지식의 중심지 역할을 수행합니다.",
      "corporate-education":
        "가인지의 기업 교육은 철저하게 현장의 목소리에 기반하여 설계된 실무 중심의 역량 강화 과정입니다. 이론적인 담론보다는 <strong>교육 이후 기업으로 돌아가 즉시 성과를 낼 수 있는 구체적인 실무 도구와 방법론을 제공</strong>하는 데 집중합니다. 현장에서 마주하는 페인 포인트를 해결할 수 있는 맞춤형 구성을 통해, 교육생이 현업에 복귀한 직후 교육의 효과를 실무 결과로 즉각 경험할 수 있도록 돕습니다.",
      community:
        "가인지 커뮤니티는 경영계의 검증된 리더와 탁월한 전문가들로부터 압도적인 인사이트를 얻고, 이를 실무에 적용할 도구를 익히는 학습과 성장의 장입니다. 컨퍼런스와 성장클럽 등을 통해 엄선된 연사의 지혜를 배우는 것은 물론, 동료 경영자들과의 생생한 사례 나눔을 통해 살아있는 지식을 습득합니다. 이는 단순한 친목을 넘어 현장의 문제를 해결할 <strong>실질적인 방법을 공유하며 경영자로서의 실무적 역량을 함께 키워나가는 고차원적 학습 생태계</strong>입니다.",
      headhunting:
        "가인지의 헤드헌팅은 기업의 성장 단계와 미래 과제를 분석하여 해당 전략을 완수할 최적의 인재를 연결하는 채용 지원 서비스입니다. 단순히 조건에 맞는 사람을 찾는 수준을 넘어 후보자의 리더십 스타일이 기업 고유의 문화와 정합성을 이루는지 엄격히 검증하여 채용 리스크를 최소화합니다. 인재 영입이 단기적 충원에 그치지 않고 <strong>조직 내 기존 자산과 시너지를 낼 수 있도록 채용 이후의 적응 과정까지 살피며</strong> 기업의 중장기 경쟁력을 공고히 합니다.",
      investment:
        "투자조합을 통해 진행되는 가인지의 투자는 <strong>자금 공급을 넘어 컨설팅과 코칭 역량을 결합해 기업의 질적 성장을 끌어내는 보육 중심의 동반 성장</strong>을 지향합니다. 기업의 특성에 맞춰 실행 가능한 성장 전략을 함께 검토하고, 기업이 스스로 운영 체계를 세우고 리더를 키워낼 수 있도록 밀착 지원합니다. 우리는 재무적 수익을 넘어 경영자의 철학이 실질적인 기업 가치로 변모하도록 돕고, 투자가 기업의 지속 가능한 도약을 위한 든든한 토대가 되게 합니다.",
      publishing:
        "사례뉴스는 실제 기업의 사례를 집대성하여 경영자가 필요한 순간 즉시 꺼내 쓸 수 있는 살아있는 ‘경영 사례 백과사전’입니다. 단순한 기록을 넘어 당장의 경영 성과를 창출할 수 있도록 현장에서 바로 참고할 수 있는 실천적 지식을 사례 도서관처럼 체계적으로 모아두었습니다. <strong>다양한 기업의 성공과 실패 맥락을 담은 이 지식 모음집</strong>은 경영자가 당면한 과제에 대해 가장 직접적이고 빠른 판단 근거를 제공하는 지식 아카이브 역할을 합니다. 가인지북스는 가인지의 컨설팅 및 연구 성과를 집약한 연구 결과물을 책의 형태로 경영자에게 제공합니다.",
    };

    function renderGaingeBusinessDescription(key) {
      if (!$gaingeBusinessPanel.length) return;
      var desc = gaingeBusinessDescriptions[key] || "";
      $gaingeBusinessPanel.empty().append(
        $("<p>", {
          class: "gainge-business-detail-body",
          html: desc,
        })
      );
    }

    $gaingeBusinessCircles.on("click", function () {
      var $btn = $(this);
      var key = $btn.attr("data-gainge-business") || "";
      var isOpen = $gaingeBusinessDetail.hasClass("is-open");
      var selectedKey = $gaingeBusinessDetail.attr("data-gainge-business-selected") || "";
      var isSameBusiness = selectedKey === key;

      if (isOpen && isSameBusiness) {
        $gaingeBusinessDetail.removeClass("is-open").attr("aria-hidden", "true").removeAttr("data-gainge-business-selected");
        $gaingeBusinessCircles.removeClass("is-active").attr("aria-expanded", "false");
        return;
      }

      $gaingeBusinessCircles.removeClass("is-active").attr("aria-expanded", "false");
      $btn.addClass("is-active").attr("aria-expanded", "true");

      if ($gaingeBusinessRowsWrap.length) {
        // 상세는 항상 첫 줄 동그라미 바로 아래(두 줄 사이)에 배치 — 아랫줄을 눌러도 같은 위치
        var $firstBusinessRow = $gaingeBusinessRowsWrap
          .children(".gainge-business-row")
          .first();
        $gaingeBusinessDetail.detach();
        $firstBusinessRow.after($gaingeBusinessDetail);
      }

      renderGaingeBusinessDescription(key);
      $gaingeBusinessDetail.addClass("is-open").attr("aria-hidden", "false").attr("data-gainge-business-selected", key);
    });
  }

  // 가인지 더 알아보기: 순환 스트립(15칸) + translateX, 마지막 책일 때 1·2번이 양옆
  // 데이터: data/books.json(Admin 스키마) → label/src/href 매핑. file:// 은 #books-data 폴백
  (function initGaingeBooksCarousel() {
    var $root = $("#gainge-books-carousel");
    if (!$root.length) return;

    var defaultItems = [
      {
        src: "assets/images/책 표지 샘플 이미지 1.webp",
        href: "https://gainge.com/contents/products/216",
        label: "대표 도서 1",
      },
      {
        src: "assets/images/책 표지 샘플 이미지 2.webp",
        href: "https://gainge.com/contents/products/693",
        label: "대표 도서 2",
      },
      {
        src: "assets/images/책 표지 샘플 이미지 7.webp",
        href: "https://gainge.com/contents/products/536",
        label: "대표 도서 3",
      },
      {
        src: "assets/images/책 표지 샘플 이미지 3.webp",
        href: "https://gainge.com/contents/products/996",
        label: "대표 도서 4",
      },
      {
        src: "assets/images/책 표지 샘플 이미지 4.webp",
        href: "https://gainge.com/contents/products/995",
        label: "대표 도서 5",
      },
      {
        src: "assets/images/책 표지 샘플 이미지 8.webp",
        href: "https://gainge.com/contents/products/998",
        label: "대표 도서 6",
      },
    ];

    var DEFAULT_BOOKS_PAYLOAD = {
      updatedAt: "2026-04-29T00:00:00.000Z",
      items: [
        {
          id: "book-1",
          title: "가인지 경영",
          imageUrl: "assets/images/책 표지 샘플 이미지 1.webp",
          link: "https://gainge.com/contents/products/216",
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
        },
        {
          id: "book-2",
          title: "비즈니스는 사랑입니다",
          imageUrl: "assets/images/책 표지 샘플 이미지 2.webp",
          link: "https://gainge.com/contents/products/693",
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
        },
        {
          id: "book-3",
          title: "조직 역동성",
          imageUrl: "assets/images/책 표지 샘플 이미지 7.webp",
          link: "https://gainge.com/contents/products/536",
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
        },
        {
          id: "book-4",
          title: "OKR 파",
          imageUrl: "assets/images/책 표지 샘플 이미지 3.webp",
          link: "https://gainge.com/contents/products/996",
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
        },
        {
          id: "book-5",
          title: "언더백 경영 인사이드 아웃",
          imageUrl: "assets/images/책 표지 샘플 이미지 4.webp",
          link: "https://gainge.com/contents/products/995",
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
        },
        {
          id: "book-6",
          title: "메시지의 품격",
          imageUrl: "assets/images/책 표지 샘플 이미지 8.webp",
          link: "https://gainge.com/contents/products/998",
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
        },
      ],
    };

    function mapAdminRow(r) {
      if (!r || typeof r !== "object") return null;
      var label =
        r.label != null
          ? String(r.label)
          : r.title != null
            ? String(r.title)
            : "";
      var src =
        r.src != null
          ? String(r.src)
          : r.imageUrl != null
            ? String(r.imageUrl)
            : "";
      var href =
        r.href != null
          ? String(r.href)
          : r.link != null
            ? String(r.link)
            : "";
      if (!src) return null;
      if (!href) href = "#";
      if (!label) label = "도서";
      return { label: label, src: src, href: href };
    }

    function mapItemsFromPayload(data) {
      var out = [];
      if (!data) return out;
      var arr = data.items;
      if (!Array.isArray(arr) && Array.isArray(data)) arr = data;
      if (!Array.isArray(arr)) return out;
      for (var i = 0; i < arr.length; i += 1) {
        var m = mapAdminRow(arr[i]);
        if (m) out.push(m);
      }
      return out;
    }

    function parseInlineBooks() {
      var el = document.getElementById("books-data");
      if (!el || !el.textContent) return null;
      try {
        return JSON.parse(el.textContent);
      } catch (e) {
        return null;
      }
    }

    function buildCarousel(items) {
    var n = items.length;
    function wrap(i) {
      return ((i % n) + n) % n;
    }

    // 0~5를 여러 번 반복한 긴 스트립으로, 끝/처음에서도 한 칸씩 자연스럽게 순환
    var STRIP_ORDER = [];
    var REPEAT_COUNT = 8;
    for (var r = 0; r < REPEAT_COUNT; r += 1) {
      for (var bi = 0; bi < n; bi += 1) STRIP_ORDER.push(bi);
    }
    var STRIP_LEN = STRIP_ORDER.length;

    var $dots = $root.find(".gainge-books-carousel-dots");
    var $track = $root.find("#gainge-books-carousel-track");
    var $btnPrev = $root.find("#gainge-books-carousel-prev");
    var $btnNext = $root.find("#gainge-books-carousel-next");

    var centerIndex = 0;
    // 왼쪽 슬롯의 스트립 인덱스(가운데 = leftStart + 1)
    // 5,0,1 형태(1번이 가운데)로 시작하도록 5번 경계에서 시작
    var leftStart = n * 3 - 1;
    var timer = null;
    var intervalMs = 5200;
    var reducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* 화살표 클릭 시 한 번에 이동하는 칸 수(자동 재생·도트는 1칸 유지) — 기존 대비 약 2.3배 */
    var BOOK_ARROW_NAV_STEP = 2.3;

    $.each(STRIP_ORDER, function (si, bookIdx) {
      var it = items[bookIdx];
      var $a = $("<a>", {
        class: "gainge-books-slide",
        href: it.href,
        target: "_blank",
        rel: "noopener noreferrer",
        "data-book-index": String(bookIdx),
      });
      $a.append(
        $("<span>", { class: "gainge-books-slide-frame" }).append(
          $("<img>", {
            class: "gainge-books-slide-img",
            src: it.src,
            alt: it.label + " 표지",
            decoding: "async",
          })
        )
      );
      $track.append($a);
    });

    function syncTrack() {
      $track.css(
        "transform",
        "translateX(calc(-" + leftStart + " * 100% / " + STRIP_LEN + "))"
      );
    }

    function syncTrackNoTransition() {
      var prevTransition = $track.css("transition");
      $track.css("transition", "none");
      syncTrack();
      // reflow로 즉시 반영 후 transition 원복
      if ($track.length && $track[0]) void $track[0].offsetHeight;
      $track.css("transition", prevTransition);
    }

    function normalizeLeftStart() {
      // 같은 모양이 6칸마다 반복되므로, 너무 끝으로 가면 가운데 영역으로 재배치
      var minSafe = n;
      var maxSafe = STRIP_LEN - n - 3;
      if (leftStart >= minSafe && leftStart <= maxSafe) return;
      var rawMod = ((leftStart % n) + n) % n;
      var mod = Math.round(rawMod);
      mod = ((mod % n) + n) % n;
      leftStart = n * 3 + mod;
      syncTrackNoTransition();
    }

    function render() {
      syncTrack();
      $dots.children(".gainge-books-dot").each(function (dotIdx) {
        var $btn = $(this);
        var active = dotIdx === centerIndex;
        $btn.toggleClass("is-active", active);
        $btn.attr("aria-selected", active ? "true" : "false");
        $btn.attr("tabindex", active ? "0" : "-1");
      });
    }

    function goTo(i) {
      centerIndex = wrap(i);
      // 점(dot) 클릭은 해당 번호로 즉시 정렬(연속 이동은 prev/next에서 처리)
      leftStart = n * 3 + centerIndex - 1;
      normalizeLeftStart();
      render();
    }

    function nextSlide() {
      leftStart += 1;
      centerIndex = wrap(centerIndex + 1);
      normalizeLeftStart();
      render();
    }

    function prevSlide() {
      leftStart -= 1;
      centerIndex = wrap(centerIndex - 1);
      normalizeLeftStart();
      render();
    }

    function nextSlideArrow() {
      leftStart += BOOK_ARROW_NAV_STEP;
      centerIndex = wrap(centerIndex + Math.round(BOOK_ARROW_NAV_STEP));
      normalizeLeftStart();
      render();
    }

    function prevSlideArrow() {
      leftStart -= BOOK_ARROW_NAV_STEP;
      centerIndex = wrap(centerIndex - Math.round(BOOK_ARROW_NAV_STEP));
      normalizeLeftStart();
      render();
    }

    function startTimer() {
      if (reducedMotion || timer) return;
      timer = window.setInterval(nextSlide, intervalMs);
    }

    function stopTimer() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    $.each(items, function (idx) {
      var $btn = $("<button>", {
        type: "button",
        class: "gainge-books-dot",
        "aria-label": "도서 " + (idx + 1) + "번, 가운데에 표시",
        role: "tab",
      });
      $btn.on("click", function () {
        stopTimer();
        goTo(idx);
        startTimer();
      });
      $dots.append($btn);
    });

    $btnPrev.on("click", function () {
      stopTimer();
      prevSlideArrow();
      startTimer();
    });

    $btnNext.on("click", function () {
      stopTimer();
      nextSlideArrow();
      startTimer();
    });

    $root.on("mouseenter", stopTimer);
    $root.on("mouseleave", startTimer);
    $root.on("focusin", function (e) {
      var $t = $(e.target);
      if (
        $t.closest(".gainge-books-dot").length ||
        $t.closest(".gainge-books-carousel-arrow").length
      ) {
        stopTimer();
      }
    });
    $root.on("focusout", function () {
      window.setTimeout(function () {
        if (!$root.find(":focus").length) startTimer();
      }, 0);
    });

    render();
    startTimer();
    }

    function startCarouselWithResolvedItems(resolved) {
      var items = resolved && resolved.length ? resolved : defaultItems;
      buildCarousel(items);
    }

    function applyBooksPayload(rawPayload) {
      var mapped = mapItemsFromPayload(rawPayload);
      startCarouselWithResolvedItems(mapped.length ? mapped : null);
    }

    if (window.SiteData) {
      window.SiteData.resolveSettingPayload({
        settingKey: "admin.local.books.v1",
        url: "data/books.json",
        inlineId: "books-data",
        validate: window.SiteData.validateBooksPayload,
        defaults: DEFAULT_BOOKS_PAYLOAD,
      }).then(function (data) {
        applyBooksPayload(data);
      });
    } else {
      applyBooksPayload(parseInlineBooks() || DEFAULT_BOOKS_PAYLOAD);
    }
  })();

  (function initCorporateEducationFromRemote() {
    if (!$(".corporate-education-intro-section").length || !window.SiteData) return;
    window.SiteData.resolveSettingPayload({
      settingKey: "admin.local.education-programs.v1",
      url: "data/corporate-education-programs.json",
      inlineId: "corporate-education-programs-data",
      validate: function (d) {
        return !!(d && Array.isArray(d.items));
      },
      defaults: { items: [] },
    }).then(function (payload) {
      var items = payload && Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) return;
      var byGroup = {
        "자격증 과정": items.filter(function (x) { return x && x.group === "자격증 과정"; }),
        "직급별 교육": items.filter(function (x) { return x && x.group === "직급별 교육"; }),
        "직무별 교육": items.filter(function (x) { return x && x.group === "직무별 교육"; }),
      };
      var groups = [
        { name: "자격증 과정", key: "intro-block-certification" },
        { name: "직급별 교육", key: "intro-block-onboarding" },
        { name: "직무별 교육", key: "intro-block-workshop" },
      ];
      groups.forEach(function (g) {
        var $block = $('.corporate-education-intro-block[data-admin-item-key="' + g.key + '"]');
        var $list = $block.find(".corporate-education-intro-items--workshop").first();
        if (!$block.length || !$list.length) return;
        var $tpl = $list.find(".corporate-education-intro-item").first();
        if (!$tpl.length) return;
        var html = "";
        (byGroup[g.name] || []).forEach(function (it) {
          var $n = $tpl.clone();
          $n.attr("data-admin-item-key", it.id || "");
          $n.find(".corporate-education-intro-card-title").text(it.title || "");
          $n.find(".corporate-education-intro-image").attr("src", it.imageUrl || "");
          var tags = Array.isArray(it.hashtags) ? it.hashtags : [];
          var $tagsWrap = $n.find(".corporate-education-intro-tags").first();
          tags.forEach(function (t, i) {
            var $span = $tagsWrap.find(".corporate-education-intro-tag").eq(i);
            if ($span.length) {
              $span.text(t || "");
            } else {
              $tagsWrap.append($("<span>").addClass("corporate-education-intro-tag").text(t || ""));
            }
          });
          while ($tagsWrap.find(".corporate-education-intro-tag").length > tags.length) {
            $tagsWrap.find(".corporate-education-intro-tag").last().remove();
          }
          $n.find(".corporate-education-intro-overlay-text").text(it.overview || "");
          var targets = Array.isArray(it.targets) ? it.targets : [];
          var $targetsWrap = $n.find(".corporate-education-intro-target-container").first();
          targets.forEach(function (t, i) {
            var $tp = $targetsWrap.find(".corporate-education-intro-target").eq(i);
            if ($tp.length) {
              $tp.text(t || "");
            } else {
              $targetsWrap.append(
                $("<p>").addClass("corporate-education-intro-target").attr("data-admin-field", "target").text(t || "")
              );
            }
          });
          while ($targetsWrap.find(".corporate-education-intro-target").length > targets.length) {
            $targetsWrap.find(".corporate-education-intro-target").last().remove();
          }
          $n.find(".corporate-education-intro-meta").text(it.schedule || "");
          $n.find(".corporate-education-intro-link").attr("href", it.link || "#");
          $n.removeClass("corporate-education-intro-item--ended").removeAttr("aria-label");
          $n.find(".corporate-education-intro-ended-panel").remove();
          if (it.ended === true) {
            $n.addClass("corporate-education-intro-item--ended").attr("aria-label", "이 교육은 종료되었습니다.");
            var $media = $n.find(".corporate-education-intro-media").first();
            if ($media.length) {
              $media.append(
                '<div class="corporate-education-intro-ended-panel" role="presentation" aria-hidden="true">' +
                  '<div class="corporate-education-intro-ended-shade" aria-hidden="true"></div>' +
                  '<p class="corporate-education-intro-ended-text">이 교육은 종료되었습니다.</p>' +
                "</div>"
              );
            }
          }
          html += $("<div>").append($n).html();
        });
        if (html) $list.html(html);
      });
      if (typeof window.initCorporateEducationWorkshopCarousel === "function") {
        window.initCorporateEducationWorkshopCarousel();
      }
    });
  })();

  (function initEducationCalendarFromRemote() {
    if (!$(".corporate-education-calendar-section").length || !window.SiteData) return;
    window.SiteData.resolveSettingPayload({
      settingKey: "admin.local.education-calendar.v1",
      url: "data/corporate-education-calendar.json",
      inlineId: "",
      validate: function (d) {
        return !!(d && Array.isArray(d.rows));
      },
      defaults: { rows: [] },
    }).then(function (payload) {
      var rows = payload && Array.isArray(payload.rows) ? payload.rows : [];
      if (!rows.length) return;
      var $section = $(".corporate-education-calendar-section");
      $section.find(".community-calendar-title").text(payload.title || "기업교육 캘린더");
      $section.find(".community-calendar-guide").text(payload.guide || "");
      var $grid = $section.find(".community-calendar-grid");
      var $head = $grid.find(".community-calendar-row--head").first();
      $grid.find(".community-calendar-row").not(".community-calendar-row--head").remove();
      rows.forEach(function (r) {
        var $row = $('<div class="community-calendar-row" role="row"></div>');
        var $program = $('<div class="community-calendar-cell community-calendar-cell--program" role="rowheader"></div>');
        $program.append($("<strong>").addClass("community-calendar-program-title").text(r.program || ""));
        $row.append($program);
        for (var m = 1; m <= 12; m += 1) {
          var entries = (r.monthEntries && r.monthEntries[String(m)]) || [];
          var $cell = $('<div class="community-calendar-cell"></div>');
          if (!entries.length) {
            $cell.append('<span class="community-calendar-dash">-</span>');
          } else {
            entries.forEach(function (e) {
              if (e && e.link) {
                $cell.append(
                  $('<a class="community-calendar-pill community-calendar-pill--btn" target="_blank" rel="noopener noreferrer"></a>')
                    .attr("href", e.link)
                    .text(e.label || "")
                );
              } else {
                $cell.append($('<span class="community-calendar-pill"></span>').text((e && e.label) || ""));
              }
            });
          }
          $row.append($cell);
        }
        $head.after($row);
      });
    });
  })();

  (function initCommunityCalendarFromRemote() {
    if (!$(".community-main").length || !window.SiteData) return;
    window.SiteData.resolveSettingPayload({
      settingKey: "admin.local.community-calendar.v1",
      url: "data/community-calendar.json",
      inlineId: "",
      validate: function (d) {
        return !!(d && Array.isArray(d.rows));
      },
      defaults: { rows: [] },
    }).then(function (payload) {
      var rows = payload && Array.isArray(payload.rows) ? payload.rows : [];
      if (!rows.length) return;
      $(".community-calendar-title").text(payload.title || "커뮤니티 캘린더");
      $(".community-calendar-guide").text(payload.guide || "");
      if (payload.ctaLinks) {
        if (payload.ctaLinks.conference) $('[data-community-link="conferenceField"]').attr("href", payload.ctaLinks.conference);
        if (payload.ctaLinks.growthClub) $('[data-community-link="growthClub"]').attr("href", payload.ctaLinks.growthClub);
        if (payload.ctaLinks.ccClass) $('[data-community-link="ccClass"]').attr("href", payload.ctaLinks.ccClass);
      }
      var $grid = $(".community-calendar-grid").first();
      var $head = $grid.find(".community-calendar-row--head").first();
      $grid.find(".community-calendar-row").not(".community-calendar-row--head").remove();
      rows.forEach(function (r) {
        var $row = $('<div class="community-calendar-row" role="row"></div>');
        var $program = $('<div class="community-calendar-cell community-calendar-cell--program" role="rowheader"></div>');
        $program.append($("<strong>").addClass("community-calendar-program-title").text(r.program || ""));
        if (r.programMeta) $program.append($("<span>").addClass("community-calendar-program-meta").text(r.programMeta));
        if (r.place) {
          var $place = $('<span class="community-calendar-program-place"><em>장소</em> </span>');
          $place.append(document.createTextNode(r.place));
          $program.append($place);
        }
        $row.append($program);
        for (var m = 1; m <= 12; m += 1) {
          var entries = (r.monthEntries && r.monthEntries[String(m)]) || [];
          var $cell = $('<div class="community-calendar-cell"></div>');
          if (!entries.length) {
            $cell.append('<span class="community-calendar-dash">-</span>');
          } else {
            entries.forEach(function (e) {
              var hasLink = !!(e && e.link);
              var $pill = hasLink
                ? $('<a class="community-calendar-pill community-calendar-pill--btn" target="_blank" rel="noopener noreferrer"></a>').attr("href", e.link)
                : $('<span class="community-calendar-pill"></span>');
              $pill.text((e && e.label) || "");
              $cell.append($pill);
              if (e && e.note) $cell.append($('<span class="community-calendar-note"></span>').text(e.note));
            });
          }
          $row.append($cell);
        }
        $head.after($row);
      });
    });
  })();
});

