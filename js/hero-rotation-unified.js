/**
 * 히어로 이미지 로테이션 — 공통 규칙 (hero-rotation-config.js 의 HERO_ROTATION + 이중 레이어 크로스페이드)
 * 메인·컨설팅·교육·커뮤니티·고객사례 등 동일 엔진 사용.
 */
(function (global) {
  "use strict";

  /**
   * @typedef {Object} HeroRotationOptions
   * @property {HTMLElement|string} root — 히어로 섹션(내부에 `.consulting-group-photo-bg` 2개)
   * @property {string[]} photoUrls
   * @property {string} dotsSelector — document 기준 `querySelectorAll`
   * @property {string} dotIndexAttr — 도트 버튼의 인덱스 data 속성명
   * @property {'dual-fill'|'main-only'} [layerMode='dual-fill'] — dual-fill: 컨설팅형 fill/main+블러; main-only: 메인 배경만(기업교육)
   * @property {number} [blurFillFromIndex=1] — layerMode dual-fill일 때 이 인덱스 이상에서 블러 fill
   * @property {boolean} [useDotIsCurrentClass=true] — 도트에 `is-current` 토글
   * @property {Object<number|string,string>} [mainBgSizeByPhotoIndex] — `.consulting-group-photo-bg-main` 의 background-size (예: { 0: "90% auto" }); 미설정 인덱스는 CSS 기본(인라인 제거)
   */

  function init(opts) {
    if (!opts || !opts.photoUrls || !opts.photoUrls.length) return;

    var root = opts.root;
    if (typeof root === "string") {
      root = document.querySelector(root);
    }
    if (!root || !root.querySelectorAll) return;

    var R = global.HERO_ROTATION;
    if (!R) return;

    if (
      global.document &&
      global.document.documentElement &&
      typeof R.crossfadeMs === "number"
    ) {
      global.document.documentElement.style.setProperty(
        "--hero-crossfade-duration",
        R.crossfadeMs / 1000 + "s"
      );
    }

    var layers = root.querySelectorAll(".consulting-group-photo-bg");
    if (!layers || layers.length < 2) return;

    var dots = document.querySelectorAll(opts.dotsSelector || "");
    var dotIndexAttr = opts.dotIndexAttr || "data-hero-index";
    var layerMode = opts.layerMode === "main-only" ? "main-only" : "dual-fill";
    var blurFillFromIndex =
      typeof opts.blurFillFromIndex === "number" ? opts.blurFillFromIndex : 1;
    var useIsCurrent = opts.useDotIsCurrentClass !== false;

    var photos = opts.photoUrls.filter(function (s) {
      return typeof s === "string" && s.trim() !== "";
    });
    var n = photos.length;
    if (!n) return;

    var currentPhotoIdx = 0;
    var activeLayerIdx = 0;
    var timer = null;
    var firstTimer = null;
    var awaitingFirstAuto = true;
    var reduceMotion =
      typeof global.matchMedia === "function" &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var holdMs = reduceMotion ? R.reduceMotionHoldMs : R.holdMs;

    var mainBgSizeMap = opts.mainBgSizeByPhotoIndex;

    function applyMainBgSize(layer, photoIndex) {
      var main = layer.querySelector(".consulting-group-photo-bg-main");
      if (!main) return;
      if (
        !mainBgSizeMap ||
        typeof photoIndex !== "number" ||
        (typeof global.matchMedia === "function" &&
          global.matchMedia("(max-width: 768px)").matches)
      ) {
        main.style.backgroundSize = "";
        return;
      }
      var sz = mainBgSizeMap[photoIndex];
      if (sz == null) sz = mainBgSizeMap[String(photoIndex)];
      if (sz != null && sz !== "") main.style.backgroundSize = sz;
      else main.style.backgroundSize = "";
    }

    function setLayerBg(layer, url, photoIndex) {
      var safe = encodeURI(url).replace(/'/g, "%27");
      var u = 'url("' + safe + '")';
      var fill = layer.querySelector(".consulting-group-photo-bg-fill");
      var main = layer.querySelector(".consulting-group-photo-bg-main");

      if (layerMode === "main-only") {
        if (main) main.style.backgroundImage = u;
        layer.classList.remove("consulting-group-photo-bg--blur-fill");
        applyMainBgSize(layer, photoIndex);
        return;
      }

      if (fill) fill.style.backgroundImage = u;
      if (main) main.style.backgroundImage = u;
      var useBlurFill =
        typeof photoIndex === "number" && photoIndex >= blurFillFromIndex;
      layer.classList.toggle("consulting-group-photo-bg--blur-fill", useBlurFill);
      applyMainBgSize(layer, photoIndex);
    }

    function updateDots() {
      if (!dots || !dots.length) return;
      dots.forEach(function (dot) {
        var i = parseInt(dot.getAttribute(dotIndexAttr), 10);
        var on = i === currentPhotoIdx;
        if (useIsCurrent) {
          dot.classList.toggle("is-current", on);
        }
        dot.setAttribute("aria-selected", on ? "true" : "false");
      });
    }

    function schedule() {
      if (timer !== null) {
        global.clearInterval(timer);
        timer = null;
      }
      if (firstTimer !== null) {
        global.clearTimeout(firstTimer);
        firstTimer = null;
      }
      var firstDelay = awaitingFirstAuto ? R.initialDelayMs() : holdMs;
      firstTimer = global.setTimeout(function () {
        next();
        awaitingFirstAuto = false;
        timer = global.setInterval(next, holdMs);
        firstTimer = null;
      }, firstDelay);
    }

    function clearTimers() {
      if (firstTimer !== null) {
        global.clearTimeout(firstTimer);
        firstTimer = null;
      }
      if (timer !== null) {
        global.clearInterval(timer);
        timer = null;
      }
    }

    function goTo(targetIdx) {
      targetIdx = ((targetIdx % n) + n) % n;
      if (targetIdx === currentPhotoIdx) {
        schedule();
        return;
      }

      awaitingFirstAuto = false;

      var incomingLayerIdx = activeLayerIdx === 0 ? 1 : 0;
      var outgoingLayerIdx = activeLayerIdx;

      setLayerBg(layers[incomingLayerIdx], photos[targetIdx], targetIdx);
      layers[incomingLayerIdx].classList.add("is-active");
      layers[outgoingLayerIdx].classList.remove("is-active");

      currentPhotoIdx = targetIdx;
      activeLayerIdx = incomingLayerIdx;
      updateDots();
      if (global.GaingeHeroPreload) {
        global.GaingeHeroPreload.prefetchIndex(photos, currentPhotoIdx + 1);
      }
      schedule();
    }

    function next() {
      var nextPhotoIdx = (currentPhotoIdx + 1) % n;
      var incomingLayerIdx = activeLayerIdx === 0 ? 1 : 0;
      var outgoingLayerIdx = activeLayerIdx;

      setLayerBg(layers[incomingLayerIdx], photos[nextPhotoIdx], nextPhotoIdx);
      layers[incomingLayerIdx].classList.add("is-active");
      layers[outgoingLayerIdx].classList.remove("is-active");

      currentPhotoIdx = nextPhotoIdx;
      activeLayerIdx = incomingLayerIdx;

      updateDots();
      if (global.GaingeHeroPreload) {
        global.GaingeHeroPreload.prefetchIndex(photos, currentPhotoIdx + 1);
      }
    }

    function showInitial() {
      var first = layers[0];
      var fadeInMs =
        typeof R.firstFadeInMs === "number" && R.firstFadeInMs > 0
          ? R.firstFadeInMs
          : R.crossfadeMs;
      setLayerBg(first, photos[0], 0);
      setLayerBg(layers[1], photos[1 % n], 1 % n);
      layers[1].classList.remove("is-active");
      if (!reduceMotion) {
        first.style.transitionDuration = fadeInMs / 1000 + "s";
      }
      global.requestAnimationFrame(function () {
        first.classList.add("is-active");
        if (!reduceMotion) {
          function clearFirstFadeDuration(e) {
            if (e && e.propertyName !== "opacity") return;
            first.removeEventListener("transitionend", clearFirstFadeDuration);
            first.style.transitionDuration = "";
          }
          first.addEventListener("transitionend", clearFirstFadeDuration);
          global.setTimeout(clearFirstFadeDuration, fadeInMs + 120);
        }
      });
    }

    function pause() {
      clearTimers();
    }

    function resume() {
      schedule();
    }

    function bootHero() {
      awaitingFirstAuto = true;
      showInitial();
      updateDots();
      schedule();
      if (global.GaingeHeroPreload) {
        global.GaingeHeroPreload.prefetchIndex(photos, 1);
        global.GaingeHeroPreload.loadRestStaggered(photos, 2, 140);
      }
    }

    if (global.GaingeHeroPreload) {
      // 첫 장 1개만 준비되면 즉시 시작(나머지는 백그라운드 프리로드)
      global.GaingeHeroPreload.startWhenFirstReady(photos, 1, bootHero);
    } else {
      bootHero();
    }

    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        var i = parseInt(dot.getAttribute(dotIndexAttr), 10);
        if (Number.isNaN(i)) return;
        goTo(i);
      });
    });

    root.addEventListener("focusin", pause);
    root.addEventListener("focusout", function (e) {
      if (!root.contains(e.relatedTarget)) resume();
    });
  }

  global.GaingeHeroRotation = {
    init: init,
  };
})(typeof window !== "undefined" ? window : this);
