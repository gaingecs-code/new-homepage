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
      "assets/컨퍼런스 1.jpg",
      "assets/컨퍼런스 2.JPG",
      "assets/컨퍼런스 3.JPG",
      "assets/컨퍼런스 4.JPG",
      "assets/컨퍼런스 5.JPG",
      "assets/컨퍼런스 6.JPG",
      "assets/컨퍼런스 7.jpg",
      "assets/컨퍼런스 8.JPG"
    ],
    growthClub: [
      "assets/성장클럽 1.jpg",
      "assets/성장클럽 2.jpg",
      "assets/성장클럽 3.jpg",
      "assets/성장클럽 4.jpg",
      "assets/성장클럽 5.jpg",
      "assets/성장클럽 6.jpg",
      "assets/성장클럽 7.jpg",
      "assets/성장클럽 8.jpg",
      "assets/성장클럽 9.jpg"
    ],
    ccClass: [
      "assets/클래스 1.jpg",
      "assets/클래스 2.jpg",
      "assets/클래스 3.jpg",
      "assets/클래스 4.jpg",
      "assets/클래스 5.jpg",
      "assets/클래스 6.jpg",
      "assets/클래스 7.jpg",
      "assets/클래스 8.jpg"
    ]
  };

  roots.forEach(function (root) {
    var imgs = root.querySelectorAll(".community-testimony-photo-img");
    if (!imgs.length) return;
    var autoplayEnabled = root.getAttribute("data-testimony-autoplay") === "true";
    var autoplayMs = Number(root.getAttribute("data-testimony-autoplay-ms")) || 2500;
    var autoplayTimer = null;
    var currentCount = imgs.length;

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

    function bindDots(count) {
      dots.forEach(function (dot) {
        dot.addEventListener("click", function () {
          var i = Number(dot.getAttribute("data-testimony-photo-index"), 10);
          if (Number.isNaN(i)) return;
          show(i, count);
        });
      });
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
      }

      tabs.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var nextCategory = btn.getAttribute("data-testimony-category");
          if (!photoSets[nextCategory]) return;
          currentCategory = nextCategory;
          idx = 0;
          setCategoryTabs(nextCategory);
          renderCategoryPhotos();
        });
      });

      if (prevBtn) {
        prevBtn.addEventListener("click", function () {
          show(idx - 1, Math.min(imgs.length, (photoSets[currentCategory] || []).length));
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", function () {
          show(idx + 1, Math.min(imgs.length, (photoSets[currentCategory] || []).length));
        });
      }

      function stopAutoplay() {
        if (autoplayTimer !== null) {
          window.clearInterval(autoplayTimer);
          autoplayTimer = null;
        }
      }

      function startAutoplay() {
        if (!autoplayEnabled || currentCount <= 1) return;
        stopAutoplay();
        autoplayTimer = window.setInterval(function () {
          show(idx + 1, currentCount);
        }, autoplayMs);
      }

      if (autoplayEnabled) {
        if (typeof window.IntersectionObserver === "function") {
          var observer = new IntersectionObserver(
            function (entries) {
              entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                  startAutoplay();
                } else {
                  stopAutoplay();
                }
              });
            },
            { threshold: 0.35 }
          );
          observer.observe(root);
        } else {
          startAutoplay();
        }
      }

      setCategoryTabs(currentCategory);
      renderCategoryPhotos();
      return;
    }

    bindDots(imgs.length);

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        show(idx - 1, imgs.length);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        show(idx + 1, imgs.length);
      });
    }

    function stopAutoplay() {
      if (autoplayTimer !== null) {
        window.clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function startAutoplay() {
      if (!autoplayEnabled || currentCount <= 1) return;
      stopAutoplay();
      autoplayTimer = window.setInterval(function () {
        show(idx + 1, currentCount);
      }, autoplayMs);
    }

    show(idx, imgs.length);

    if (autoplayEnabled) {
      if (typeof window.IntersectionObserver === "function") {
        var observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                startAutoplay();
              } else {
                stopAutoplay();
              }
            });
          },
          { threshold: 0.35 }
        );
        observer.observe(root);
      } else {
        startAutoplay();
      }
    }
  });
})();
