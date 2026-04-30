/**
 * 컨설팅 소개 페이지 맨 위 단체 사진 — 자동 로테이션 (간증 사진과 동일 패턴)
 * 첫 이미지의 자연 비율로 트랙 높이 고정, object-fit: contain + 검정 배경
 */
(function () {
  var root = document.querySelector("[data-consulting-group-photos]");
  if (!root) return;

  var track = root.querySelector(".consulting-group-photo-track");
  var imgs = root.querySelectorAll(".consulting-group-photo-img");
  var dots = root.querySelectorAll("[data-consulting-group-photo-index]");
  var n = imgs.length;
  if (!n || !track) return;

  var idx = 0;
  var timer = null;
  var AUTO_MS = 5000;
  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    AUTO_MS = 9000;
  }

  function applyAspectFromFirstImage() {
    var first = imgs[0];
    if (!first) return;
    function setRatio() {
      var w = first.naturalWidth;
      var h = first.naturalHeight;
      if (w > 0 && h > 0) {
        track.style.aspectRatio = w + " / " + h;
      }
    }
    if (first.complete && first.naturalWidth) {
      setRatio();
    } else {
      first.addEventListener("load", setRatio, { once: true });
      first.addEventListener("error", function () {
        track.style.aspectRatio = "16 / 9";
      }, { once: true });
    }
  }

  function show(i) {
    idx = ((i % n) + n) % n;
    for (var k = 0; k < n; k++) {
      imgs[k].classList.toggle("is-active", k === idx);
    }
    dots.forEach(function (dot) {
      var on = parseInt(dot.getAttribute("data-consulting-group-photo-index"), 10) === idx;
      dot.classList.toggle("is-current", on);
      dot.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function next() {
    show(idx + 1);
  }

  function schedule() {
    clear();
    timer = window.setInterval(next, AUTO_MS);
  }

  function clear() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function pause() {
    clear();
  }

  function resume() {
    schedule();
  }

  applyAspectFromFirstImage();

  root.addEventListener("mouseenter", pause);
  root.addEventListener("mouseleave", resume);
  root.addEventListener("focusin", pause);
  root.addEventListener("focusout", function (e) {
    if (!root.contains(e.relatedTarget)) resume();
  });

  dots.forEach(function (dot) {
    dot.addEventListener("click", function () {
      var i = parseInt(dot.getAttribute("data-consulting-group-photo-index"), 10);
      if (Number.isNaN(i)) return;
      show(i);
      pause();
      resume();
    });
  });

  show(0);
  schedule();
})();
