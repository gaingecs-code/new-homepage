/**
 * 기업교육 — 교육 소개 가로 캐러셀(자격증 과정·직급별 교육·직무별 교육) + 자동 로테이션
 * 루트: [data-corporate-education-workshop-carousel]. 카드는 data-admin-collection="introCards" 하위에 추가·삭제 가능.
 */
(function () {
  var mqMobile = window.matchMedia("(max-width: 900px)");
  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function parseGapPx(el) {
    var g = window.getComputedStyle(el).gap || window.getComputedStyle(el).columnGap;
    var n = parseFloat(g);
    return Number.isFinite(n) ? n : 14;
  }

  function initCarousel(root) {
    var viewport = root.querySelector("[data-workshop-carousel-viewport]");
    var track = root.querySelector(".corporate-education-intro-items--workshop");
    var prevBtn = root.querySelector(".corporate-education-workshop-nav--prev");
    var nextBtn = root.querySelector(".corporate-education-workshop-nav--next");
    if (!viewport || !track) return;

    var items = track.querySelectorAll(".corporate-education-intro-item");
    var autoTimer = null;
    var AUTO_MS = reduceMotion ? 5400 : 4000;

    function slideStep() {
      var gap = parseGapPx(track);
      var w = viewport.clientWidth;
      var mobile = mqMobile.matches;
      var slideW = mobile ? w : (w - gap) / 2;
      return { gap: gap, slideW: slideW, mobile: mobile };
    }

    function applyWidths() {
      var s = slideStep();
      for (var i = 0; i < items.length; i++) {
        items[i].style.flex = "0 0 " + Math.round(s.slideW) + "px";
        items[i].style.maxWidth = "none";
      }
    }

    function maxScroll() {
      return Math.max(0, viewport.scrollWidth - viewport.clientWidth - 1);
    }

    function updateNavState() {
      var ms = maxScroll();
      var atStart = viewport.scrollLeft <= 1;
      var atEnd = viewport.scrollLeft >= ms - 1;
      var showArrows = items.length >= 2;
      var canScroll = ms > 2;

      if (prevBtn) {
        prevBtn.hidden = !showArrows;
        prevBtn.disabled = canScroll ? atStart : true;
        prevBtn.setAttribute("aria-disabled", prevBtn.disabled ? "true" : "false");
      }
      if (nextBtn) {
        nextBtn.hidden = !showArrows;
        nextBtn.disabled = canScroll ? atEnd : true;
        nextBtn.setAttribute("aria-disabled", nextBtn.disabled ? "true" : "false");
      }
    }

    function scrollByDir(dir) {
      var s = slideStep();
      var delta = s.slideW + s.gap;
      viewport.scrollBy({ left: dir * delta, behavior: "smooth" });
      window.setTimeout(updateNavState, 360);
    }

    function scrollNextAuto() {
      var ms = maxScroll();
      if (ms <= 2) return;
      var atEnd = viewport.scrollLeft >= ms - 1;
      if (atEnd) {
        viewport.scrollTo({ left: 0, behavior: reduceMotion ? "auto" : "smooth" });
      } else {
        scrollByDir(1);
      }
      window.setTimeout(updateNavState, reduceMotion ? 50 : 400);
    }

    function clearAuto() {
      if (autoTimer !== null) {
        window.clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    function scheduleAuto() {
      clearAuto();
      if (maxScroll() <= 2) return;
      autoTimer = window.setInterval(scrollNextAuto, AUTO_MS);
    }

    function pause() {
      clearAuto();
    }

    function resume() {
      scheduleAuto();
    }

    function onScroll() {
      updateNavState();
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        scrollByDir(-1);
        pause();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        scrollByDir(1);
        pause();
      });
    }

    root.addEventListener("mouseenter", pause);
    root.addEventListener("mouseleave", resume);
    root.addEventListener("focusin", pause);
    root.addEventListener("focusout", function (e) {
      if (!root.contains(e.relatedTarget)) resume();
    });

    viewport.addEventListener("scroll", onScroll, { passive: true });

    viewport.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollByDir(-1);
        pause();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollByDir(1);
        pause();
      }
    });

    function relayout() {
      applyWidths();
      updateNavState();
      clearAuto();
      scheduleAuto();
    }

    relayout();

    if (typeof window.ResizeObserver === "function") {
      var ro = new ResizeObserver(function () {
        relayout();
      });
      ro.observe(viewport);
    } else {
      window.addEventListener("resize", relayout);
    }

    mqMobile.addEventListener("change", relayout);

    if (typeof window.MutationObserver === "function") {
      var mo = new MutationObserver(function () {
        items = track.querySelectorAll(".corporate-education-intro-item");
        relayout();
      });
      mo.observe(track, { childList: true, subtree: false });
    }
  }

  function run() {
    document.querySelectorAll("[data-corporate-education-workshop-carousel]").forEach(initCarousel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  window.initCorporateEducationWorkshopCarousel = run;
})();
