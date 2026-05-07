/**
 * 소개 섹션 상단 — 컬럼별 VOC 카드 텍스트 순환 (3초, 효과 없이 교체만)
 * 실제 문구는 페이지에서 window.COMMUNITY_INTRO_VOC 로 덮어쓸 수 있습니다.
 * 예: window.COMMUNITY_INTRO_VOC = { conference: ["문장1", ...], growthClub: [...], ccClass: [...] };
 */
(function () {
  var ROTATE_MS = 3000;
  var DEFAULT_LIST = ["VOC1", "VOC2", "VOC3", "VOC4", "VOC5"];

  function getList(key) {
    var custom =
      typeof window !== "undefined" && window.COMMUNITY_INTRO_VOC
        ? window.COMMUNITY_INTRO_VOC
        : null;
    if (custom && custom[key] && custom[key].length) return custom[key];
    return DEFAULT_LIST.slice();
  }

  function startRotator(root) {
    var key = root.getAttribute("data-community-intro-voc");
    if (!key) return;
    var list = getList(key);
    var el = root.querySelector("[data-community-intro-voc-text]");
    var card = root.querySelector(".community-intro-voc-card");
    if (!el) return;

    var i = 0;
    var timer = null;
    var isHoverPaused = false;
    var isDotPaused = false;
    var isClickStopped = false;
    el.textContent = list[0];
    var dots = [];

    function setActiveDot(index) {
      dots.forEach(function (dot, dotIndex) {
        var isActive = dotIndex === index;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }

    function pulseCard() {
      if (!card) return;
      card.classList.remove("is-voc-flashing");
      void card.offsetWidth;
      card.classList.add("is-voc-flashing");
    }

    function createDots() {
      var dotsWrap = document.createElement("div");
      dotsWrap.className = "community-intro-voc-dots";
      dotsWrap.setAttribute("role", "tablist");
      dotsWrap.setAttribute("aria-label", "VOC 카드 선택");

      list.forEach(function (_, idx) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "community-intro-voc-dot";
        dot.setAttribute("role", "tab");
        dot.setAttribute("aria-label", "VOC " + (idx + 1));
        dot.setAttribute("aria-selected", idx === 0 ? "true" : "false");
        dot.addEventListener("click", function () {
          i = idx;
          el.textContent = list[i];
          setActiveDot(i);
          pulseCard();
        });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      });

      dotsWrap.addEventListener("mouseenter", function () {
        isDotPaused = true;
      });
      dotsWrap.addEventListener("mouseleave", function () {
        isDotPaused = false;
      });
      dotsWrap.addEventListener("focusin", function () {
        isDotPaused = true;
      });
      dotsWrap.addEventListener("focusout", function (event) {
        if (!dotsWrap.contains(event.relatedTarget)) {
          isDotPaused = false;
        }
      });

      root.appendChild(dotsWrap);
      setActiveDot(0);
    }

    createDots();

    function tick() {
      if (isHoverPaused || isDotPaused || isClickStopped) return;
      i = (i + 1) % list.length;
      el.textContent = list[i];
      setActiveDot(i);
      pulseCard();
    }

    function startTimer() {
      if (timer !== null || isClickStopped) return;
      timer = window.setInterval(tick, ROTATE_MS);
    }

    function stopTimer() {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    }

    startTimer();

    if (card) {
      card.addEventListener("mouseenter", function () {
        isHoverPaused = true;
      });
      card.addEventListener("mouseleave", function () {
        isHoverPaused = false;
      });
      card.addEventListener("click", function () {
        isClickStopped = true;
        stopTimer();
      });
    }
  }

  document.querySelectorAll("[data-community-intro-voc]").forEach(startRotator);
})();
