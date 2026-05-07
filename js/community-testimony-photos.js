/**
 * 커뮤니티 현장 모습 섹션
 * - 모임별 버튼(컨퍼런스/성장클럽/CC클래스) 전환
 * - 선택된 모임의 사진 수동 전환 + 하단 도트 네비게이션
 */
(function () {
  var roots = document.querySelectorAll("[data-community-testimony-photos]");
  if (!roots.length) return;

  var photoSets = {
    conference: [
      "assets/컨퍼런스 1.webp",
      "assets/컨퍼런스 2.webp",
      "assets/컨퍼런스 3.webp",
      "assets/컨퍼런스 4.webp",
      "assets/컨퍼런스 5.webp",
      "assets/컨퍼런스 6.webp",
      "assets/컨퍼런스 7.webp",
      "assets/컨퍼런스 8.webp"
    ],
    growthClub: [
      "assets/성장클럽 1.webp",
      "assets/성장클럽 2.webp",
      "assets/성장클럽 3.webp",
      "assets/성장클럽 4.webp",
      "assets/성장클럽 5.webp",
      "assets/성장클럽 6.webp",
      "assets/성장클럽 7.webp",
      "assets/성장클럽 8.webp",
      "assets/성장클럽 9.webp"
    ],
    ccClass: [
      "assets/클래스 1.webp",
      "assets/클래스 2.webp",
      "assets/클래스 3.webp",
      "assets/클래스 4.webp",
      "assets/클래스 5.webp",
      "assets/클래스 6.webp",
      "assets/클래스 7.webp",
      "assets/클래스 8.webp"
    ]
  };

  roots.forEach(function (root) {
    var imgs = root.querySelectorAll(".community-testimony-photo-img");
    if (!imgs.length) return;
    var autoplayEnabled = root.getAttribute("data-testimony-autoplay") === "true";
    var autoplayMs = Number(root.getAttribute("data-testimony-autoplay-ms")) || 2500;
    var autoplayTimer = null;
    var currentCount = imgs.length;
    var userPause = false;
    var rootInView = typeof window.IntersectionObserver !== "function";

    var dotsWrap = root.querySelector(".community-testimony-photo-dots");
    var prevBtn = root.querySelector(".community-testimony-nav--prev");
    var nextBtn = root.querySelector(".community-testimony-nav--next");
    var section = root.closest(".community-testimony-section");
    var tabs = section ? section.querySelectorAll("[data-testimony-category]") : [];
    var useCategoryMode = tabs.length > 0;
    var dots = Array.prototype.slice.call(root.querySelectorAll("[data-testimony-photo-index]"));
    var idx = 0;

    for (var start = 0; start < imgs.length; start++) {
      if (imgs[start].classList.contains("is-active")) {
        idx = start;
        break;
      }
    }

    function show(i, count) {
      var n = count || imgs.length;
      if (!n) return;
      currentCount = n;
      idx = ((i % n) + n) % n;

      for (var k = 0; k < imgs.length; k++) {
        imgs[k].classList.toggle("is-active", k === idx && k < n);
      }

      dots.forEach(function (dot) {
        var on = Number(dot.getAttribute("data-testimony-photo-index")) === idx;
        dot.classList.toggle("is-current", on);
        dot.setAttribute("aria-selected", on ? "true" : "false");
      });
    }

    function stopAutoplay() {
      if (autoplayTimer !== null) {
        window.clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function tryStartAutoplay() {
      if (!autoplayEnabled || currentCount <= 1 || !rootInView || userPause) return;
      stopAutoplay();
      autoplayTimer = window.setInterval(function () {
        show(idx + 1, currentCount);
      }, autoplayMs);
    }

    function pauseUser() {
      if (!autoplayEnabled) return;
      userPause = true;
      stopAutoplay();
    }

    function resumeUser() {
      if (!autoplayEnabled) return;
      userPause = false;
      tryStartAutoplay();
    }

    function attachAutoplayGuards() {
      if (!autoplayEnabled) return;
      root.addEventListener("mouseenter", pauseUser);
      root.addEventListener("mouseleave", function () {
        if (root.contains(document.activeElement)) return;
        resumeUser();
      });
      root.addEventListener("focusin", pauseUser);
      root.addEventListener("focusout", function (e) {
        if (!root.contains(e.relatedTarget)) resumeUser();
      });
    }

    function bindDots(count) {
      dots.forEach(function (dot) {
        dot.addEventListener("click", function () {
          var i = Number(dot.getAttribute("data-testimony-photo-index"), 10);
          if (Number.isNaN(i)) return;
          pauseUser();
          show(i, count);
        });
      });
    }

    function setupIntersectionObserver() {
      if (!autoplayEnabled || typeof window.IntersectionObserver !== "function") return;
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            rootInView = entry.isIntersecting;
            if (!entry.isIntersecting) {
              stopAutoplay();
            } else {
              tryStartAutoplay();
            }
          });
        },
        { threshold: 0.35 }
      );
      observer.observe(root);
    }

    if (useCategoryMode && dotsWrap) {
      var currentCategory = "conference";

      function setCategoryTabs(nextCategory) {
        tabs.forEach(function (btn) {
          var on = btn.getAttribute("data-testimony-category") === nextCategory;
          btn.classList.toggle("is-current", on);
          btn.setAttribute("aria-selected", on ? "true" : "false");
        });
      }

      function rebuildDots(photoCount) {
        dotsWrap.innerHTML = "";
        dots = [];

        for (var i = 0; i < photoCount; i++) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.className = "community-testimony-dot" + (i === idx ? " is-current" : "");
          dot.setAttribute("role", "tab");
          dot.setAttribute("aria-selected", i === idx ? "true" : "false");
          dot.setAttribute("aria-label", "사진 " + (i + 1));
          dot.setAttribute("data-testimony-photo-index", String(i));
          dotsWrap.appendChild(dot);
          dots.push(dot);
        }
      }

      function renderCategoryPhotos() {
        var photos = photoSets[currentCategory] || photoSets.conference;
        var n = Math.min(imgs.length, photos.length);
        if (!n) return;
        if (idx >= n) idx = 0;

        for (var k = 0; k < imgs.length; k++) {
          var img = imgs[k];
          if (k < n) {
            img.src = photos[k];
            img.loading = k === 0 ? "eager" : "lazy";
          }
        }

        rebuildDots(n);
        bindDots(n);
        show(idx, n);
        tryStartAutoplay();
      }

      tabs.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var nextCategory = btn.getAttribute("data-testimony-category");
          if (!photoSets[nextCategory]) return;
          pauseUser();
          currentCategory = nextCategory;
          idx = 0;
          setCategoryTabs(nextCategory);
          renderCategoryPhotos();
        });
      });

      if (prevBtn) {
        prevBtn.addEventListener("click", function () {
          pauseUser();
          show(idx - 1, Math.min(imgs.length, (photoSets[currentCategory] || []).length));
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", function () {
          pauseUser();
          show(idx + 1, Math.min(imgs.length, (photoSets[currentCategory] || []).length));
        });
      }

      if (autoplayEnabled) {
        if (typeof window.IntersectionObserver === "function") {
          setupIntersectionObserver();
        } else {
          tryStartAutoplay();
        }
      }

      attachAutoplayGuards();
      setCategoryTabs(currentCategory);
      renderCategoryPhotos();
      return;
    }

    bindDots(imgs.length);

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        pauseUser();
        show(idx - 1, imgs.length);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        pauseUser();
        show(idx + 1, imgs.length);
      });
    }

    attachAutoplayGuards();
    show(idx, imgs.length);

    if (autoplayEnabled) {
      if (typeof window.IntersectionObserver === "function") {
        setupIntersectionObserver();
      } else {
        tryStartAutoplay();
      }
    }
  });
})();
