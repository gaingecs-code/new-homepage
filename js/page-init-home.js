/**
 * 메인(index) — data/home.json + #home-page-data 반영 후 호출 (main.js에서 window.HOME_* 세팅 뒤)
 */
(function (global) {
  var GaingeSite = (global.GaingeSite = global.GaingeSite || {});

  GaingeSite.DEFAULT_HOME_JSON = {
    updatedAt: "2026-04-29T00:00:00.000Z",
    heroRotationImages: [
      "assets/images/메인페이지1.webp",
      "assets/images/메인페이지2.webp",
      "assets/images/메인페이지3.webp",
      "assets/images/메인페이지4.webp",
      "assets/images/메인페이지5.webp",
    ],
    logoSlotImages: {
      1: [
        "assets/customer-logos/삼성전자.png",
        "assets/customer-logos/폭스바겐그룹코리아.png",
        "assets/customer-logos/포스코.png",
        "assets/customer-logos/신한은행.png",
        "assets/customer-logos/농심.png",
      ],
      2: [
        "assets/customer-logos/대웅제약.png",
        "assets/customer-logos/코스메카코리아.png",
        "assets/customer-logos/서울재활병원.png",
        "assets/customer-logos/웅비메디텍.png",
        "assets/customer-logos/바이오세라.png",
      ],
      3: [
        "assets/customer-logos/다비치안경.png",
        "assets/customer-logos/꿈비.png",
        "assets/customer-logos/헤세드코리아.png",
        "assets/customer-logos/실란트로.png",
        "assets/customer-logos/벨라코리아.png",
      ],
      4: [
        "assets/customer-logos/엔씨소프트.png",
        "assets/customer-logos/대원미디어.png",
        "assets/customer-logos/아소비교육.png",
        "assets/customer-logos/어셔어학원.png",
        "assets/customer-logos/프라미스에듀.png",
      ],
      5: [
        "assets/customer-logos/한국수자원공사.png",
        "assets/customer-logos/대한무역투자진흥공사.png",
        "assets/customer-logos/굿피플인터네셔널.png",
        "assets/customer-logos/유니세프.png",
        "assets/customer-logos/금호건설.png",
      ],
      6: [
        "assets/customer-logos/태향.png",
        "assets/customer-logos/끌리메.png",
        "assets/customer-logos/준오헤어.png",
        "assets/customer-logos/청밀.png",
        "assets/customer-logos/한성산기.png",
        "assets/customer-logos/명신.png",
      ],
    },
    homeTestimonialVideoUrls: {
      1: "https://youtu.be/uNRDkKpbWQs",
      2: "https://youtu.be/ZxaHLlL2ESg",
      3: "https://youtu.be/Dz3ya3PD9eU",
    },
    homeStoryPageUrls: { 1: "", 2: "", 3: "" },
  };

  GaingeSite.applyHomePageConfig = function ($) {
    var resolveMediaUrlForPopup =
      global.GaingeMedia && global.GaingeMedia.resolveMediaUrlForPopup
        ? global.GaingeMedia.resolveMediaUrlForPopup
        : function (url) {
            return (url || "").trim();
          };
    var isNativeVideoPopupUrl =
      global.GaingeMedia && global.GaingeMedia.isNativeVideoPopupUrl
        ? global.GaingeMedia.isNativeVideoPopupUrl
        : function (url) {
            return /\.(mp4|webm|ogg)(\?|$)/i.test(url || "");
          };
    var embedFriendlyVideoUrl =
      global.GaingeMedia && global.GaingeMedia.embedFriendlyVideoUrl
        ? global.GaingeMedia.embedFriendlyVideoUrl
        : function (u) {
            return u;
          };

    var $homeHeroSection = $(".home-hero-section");
    if ($homeHeroSection.length) {
      var homeHeroRotationSource =
        Array.isArray(global.HOME_HERO_ROTATION_IMAGES) && global.HOME_HERO_ROTATION_IMAGES.length
          ? global.HOME_HERO_ROTATION_IMAGES
          : GaingeSite.DEFAULT_HOME_JSON.heroRotationImages;
      var homeHeroImages = $.grep(homeHeroRotationSource, function (src) {
        return typeof src === "string" && src.trim() !== "";
      });
      if (
        homeHeroImages.length &&
        global.GaingeHeroRotation &&
        typeof global.GaingeHeroRotation.init === "function"
      ) {
        global.GaingeHeroRotation.init({
          root: $homeHeroSection[0],
          photoUrls: homeHeroImages,
          dotsSelector: ".home-main [data-home-hero-dot-index]",
          dotIndexAttr: "data-home-hero-dot-index",
          layerMode: "dual-fill",
          blurFillFromIndex: 1,
          useDotIsCurrentClass: false,
        });
      }
    }

    (function initHomeLogoRotation() {
      var slotMapRaw =
        typeof global.HOME_LOGO_SLOT_IMAGES === "object" && global.HOME_LOGO_SLOT_IMAGES
          ? global.HOME_LOGO_SLOT_IMAGES
          : {};
      var $slots = $(".home-logo-slot");
      if (!$slots.length) return;

      var slotCount = 6;
      var logoIndexBySlot = {};
      var slotBusy = {};
      var maxConcurrentLogos = 3;
      var slotCycleMs = Math.round(900 / 1.15);
      var logoFadeOutMs = 1500;
      var logoFadeInMs = 1500;

      for (var i = 1; i <= slotCount; i++) {
        logoIndexBySlot[i] = 0;
      }

      function getSlotLogos(slotNo) {
        var list = slotMapRaw[String(slotNo)];
        if (!Array.isArray(list)) list = slotMapRaw[slotNo];
        if (!Array.isArray(list)) return [];
        return list.filter(function (v) {
          return typeof v === "string" && v.trim() !== "";
        });
      }

      function countBusy() {
        var c = 0;
        for (var s = 1; s <= slotCount; s++) {
          if (slotBusy[s]) c += 1;
        }
        return c;
      }

      function getAvailableShuffled() {
        var a = [];
        for (var s = 1; s <= slotCount; s++) {
          if (slotBusy[s]) continue;
          if (!getSlotLogos(s).length) continue;
          a.push(s);
        }
        for (var j = a.length - 1; j > 0; j--) {
          var k = Math.floor(Math.random() * (j + 1));
          var t = a[j];
          a[j] = a[k];
          a[k] = t;
        }
        return a;
      }

      function startOneSlotTransition(currentSlot) {
        if (slotBusy[currentSlot]) return;
        var $slot = $('.home-logo-slot[data-logo-slot="' + currentSlot + '"]');
        if (!$slot.length) return;

        var logos = getSlotLogos(currentSlot);
        if (!logos.length) return;

        slotBusy[currentSlot] = true;
        var $img = $slot.find(".home-logo-slot-image");

        $slot.removeClass("is-logo-fading-in").addClass("is-logo-swapping");
        global.setTimeout(function () {
          if (logos.length) {
            var idx = logoIndexBySlot[currentSlot] % logos.length;
            var src = logos[idx];
            $img.attr("src", src).attr("alt", "로고 " + currentSlot + "-" + (idx + 1));
            logoIndexBySlot[currentSlot] = idx + 1;
          } else {
            $img.removeAttr("src").attr("alt", "");
          }

          $slot.removeClass("is-logo-swapping").addClass("is-logo-fading-in");
          global.setTimeout(function () {
            $slot.removeClass("is-logo-fading-in");
            delete slotBusy[currentSlot];
          }, logoFadeInMs);
        }, logoFadeOutMs);
      }

      function tick() {
        var room = maxConcurrentLogos - countBusy();
        if (room < 1) return;

        var available = getAvailableShuffled();
        if (!available.length) return;

        var maxN = Math.min(3, room, available.length);
        var n = 1 + Math.floor(Math.random() * maxN);

        for (var q = 0; q < n; q++) {
          startOneSlotTransition(available[q]);
        }
      }

      for (var seedSlot = 1; seedSlot <= slotCount; seedSlot++) {
        var $seed = $('.home-logo-slot[data-logo-slot="' + seedSlot + '"]');
        if (!$seed.length) continue;
        var seedLogos = getSlotLogos(seedSlot);
        var $seedImg = $seed.find(".home-logo-slot-image");
        if (seedLogos.length) {
          $seedImg.attr("src", seedLogos[0]).attr("alt", "로고 " + seedSlot + "-1");
          logoIndexBySlot[seedSlot] = 1;
          $seed.addClass("is-blinking");
        } else {
          $seedImg.removeAttr("src").attr("alt", "");
        }
      }

      tick();
      global.setInterval(tick, slotCycleMs);
    })();

    var homeTestimonialUrls = $.extend(
      { 1: "", 2: "", 3: "" },
      typeof global.HOME_TESTIMONIAL_VIDEO_URLS === "object" && global.HOME_TESTIMONIAL_VIDEO_URLS
        ? global.HOME_TESTIMONIAL_VIDEO_URLS
        : {}
    );
    var $homeTestimonialPopup = $("#home-testimonial-video-popup");
    if ($homeTestimonialPopup.length) {
      var $homeIframe = $homeTestimonialPopup.find(".community-video-popup-iframe");
      var $homeNative = $homeTestimonialPopup.find(".testimonial-popup-video-native");
      var homeNativeEl = $homeNative[0];
      var $homePlaceholder = $homeTestimonialPopup.find(".home-testimonial-video-placeholder");

      function closeHomeTestimonialPopup() {
        $homeTestimonialPopup.attr("hidden", true);
        $("body").css("overflow", "");
        $homeIframe.attr("src", "").attr("hidden", true);
        if (homeNativeEl) {
          homeNativeEl.pause();
          homeNativeEl.removeAttribute("src");
          homeNativeEl.load();
        }
        $homeNative.attr("hidden", true);
        $homePlaceholder.removeAttr("hidden");
        var $phText = $homePlaceholder.find("p");
        if ($phText.length) $phText.text("영상이 준비 중입니다.");
      }

      function openHomeTestimonialPopup(id) {
        var urlRaw = (homeTestimonialUrls[id] || "").trim();
        var url = resolveMediaUrlForPopup(urlRaw);
        if (url) {
          if (isNativeVideoPopupUrl(urlRaw)) {
            $homeIframe.attr("src", "").attr("hidden", true);
            $homePlaceholder.attr("hidden", true);
            $homeNative.removeAttr("hidden");
            if (homeNativeEl) {
              homeNativeEl.src = url;
              homeNativeEl.load();
              homeNativeEl.play().catch(function () {});
            }
          } else {
            if (homeNativeEl) {
              homeNativeEl.pause();
              homeNativeEl.removeAttribute("src");
              homeNativeEl.load();
            }
            $homeNative.attr("hidden", true);
            $homeIframe.removeAttr("hidden").attr("src", embedFriendlyVideoUrl(url));
            $homePlaceholder.attr("hidden", true);
          }
        } else {
          $homeIframe.attr("src", "").attr("hidden", true);
          if (homeNativeEl) {
            homeNativeEl.pause();
            homeNativeEl.removeAttribute("src");
            homeNativeEl.load();
          }
          $homeNative.attr("hidden", true);
          $homePlaceholder.removeAttr("hidden");
        }
        $homeTestimonialPopup.removeAttr("hidden");
        $("body").css("overflow", "hidden");
      }

      if (homeNativeEl) {
        homeNativeEl.addEventListener("error", function () {
          if ($homeTestimonialPopup[0].hasAttribute("hidden")) return;
          if (!homeNativeEl.getAttribute("src")) return;
          homeNativeEl.setAttribute("hidden", "");
          $homePlaceholder.removeAttr("hidden");
          var $p = $homePlaceholder.find("p");
          if ($p.length)
            $p.text("영상을 불러올 수 없습니다. assets 폴더에 파일이 있는지 확인해 주세요.");
        });
      }

      $("[data-home-testimonial-video]").on("click", function () {
        var id = String($(this).data("home-testimonial-video"));
        openHomeTestimonialPopup(id);
      });

      $homeTestimonialPopup
        .find(".community-video-popup-backdrop")
        .on("click", closeHomeTestimonialPopup);
      $homeTestimonialPopup
        .find(".community-video-popup-close")
        .on("click", closeHomeTestimonialPopup);

      $(document).on("keydown.homeTestimonialVideoPopup", function (e) {
        if (e.key !== "Escape") return;
        if (!$homeTestimonialPopup.length || $homeTestimonialPopup[0].hasAttribute("hidden")) return;
        e.preventDefault();
        closeHomeTestimonialPopup();
      });
    }

    var homeStoryPopupFeatures = "noopener,noreferrer,width=1100,height=800";
    var homeStoryPageUrls = $.extend(
      { 1: "", 2: "", 3: "" },
      typeof global.HOME_STORY_PAGE_URLS === "object" && global.HOME_STORY_PAGE_URLS
        ? global.HOME_STORY_PAGE_URLS
        : {}
    );
    var $homeStoryPopup = $("#home-story-page-popup");
    if ($homeStoryPopup.length) {
      var $homeStoryIframe = $homeStoryPopup.find(".community-video-popup-iframe");
      var $homeStoryPlaceholder = $homeStoryPopup.find(".testimonials-story-popup-placeholder");

      function closeHomeStoryPopup() {
        $homeStoryPopup.attr("hidden", true);
        $("body").css("overflow", "");
        $homeStoryIframe.attr("src", "").attr("hidden", true);
        $homeStoryPlaceholder.removeAttr("hidden");
      }

      $("[data-home-story]").on("click", function () {
        var id = String($(this).attr("data-home-story"));
        var url = (homeStoryPageUrls[id] || "").trim();
        if (url) {
          if (!/^https?:\/\//i.test(url)) {
            global.open(url, "_blank", homeStoryPopupFeatures);
            return;
          }
          $homeStoryIframe.removeAttr("hidden").attr("src", url);
          $homeStoryPlaceholder.attr("hidden", true);
        } else {
          $homeStoryIframe.attr("src", "").attr("hidden", true);
          $homeStoryPlaceholder.removeAttr("hidden");
        }
        $homeStoryPopup.removeAttr("hidden");
        $("body").css("overflow", "hidden");
      });

      $homeStoryPopup
        .find(".community-video-popup-backdrop")
        .on("click", closeHomeStoryPopup);
      $homeStoryPopup
        .find(".community-video-popup-close")
        .on("click", closeHomeStoryPopup);

      $(document).on("keydown.homeStoryPagePopup", function (e) {
        if (e.key !== "Escape") return;
        if (!$homeStoryPopup.length || $homeStoryPopup[0].hasAttribute("hidden")) return;
        e.preventDefault();
        closeHomeStoryPopup();
      });
    }
  };
})(typeof window !== "undefined" ? window : this);
