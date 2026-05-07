/**
 * 히어로 배경 로테이션: 첫 1장만 대기 후 즉시 시작 · 나머지는 지연 프리로드 · 다음 장 선로드
 * 첫 배치·다음 장 요청은 fetchPriority high, 나머지 순차 로드는 low(GaingeHeroRotation 에서 사용).
 */
(function (global) {
  function loadImageOnce(src, cb, opts) {
    opts = opts || {};
    var img = new global.Image();
    img.decoding = "async";
    if ("fetchPriority" in img && opts.fetchPriority) {
      img.fetchPriority = opts.fetchPriority;
    }
    img.onload = function () {
      cb(true);
    };
    img.onerror = function () {
      cb(false);
    };
    img.src = src;
  }

  var GaingeHeroPreload = {
    /**
     * 초기 표시에 필요한 첫 count장만 로드 완료를 기다린 뒤 콜백 (동시 요청 수 최소화)
     */
    startWhenFirstReady: function (photoUrls, firstCount, onReady) {
      var n = photoUrls.length;
      if (n === 0 || typeof onReady !== "function") {
        if (typeof onReady === "function") onReady();
        return;
      }
      var need = Math.min(firstCount, n);
      var done = 0;
      function check() {
        done += 1;
        if (done >= need) onReady();
      }
      for (var i = 0; i < need; i++) {
        loadImageOnce(photoUrls[i], check, { fetchPriority: "high" });
      }
    },

    /**
     * fromIndex부터 끝까지 stagger로 프리로드 (메인 스레드·네트워크 혼잡 완화)
     */
    loadRestStaggered: function (photoUrls, fromIndex, gapMs) {
      gapMs = gapMs == null ? 140 : gapMs;
      var n = photoUrls.length;
      if (fromIndex >= n) return;
      for (var j = fromIndex; j < n; j++) {
        (function (idx) {
          global.setTimeout(function () {
            var im = new global.Image();
            im.decoding = "async";
            if ("fetchPriority" in im) im.fetchPriority = "low";
            im.src = photoUrls[idx];
          }, (idx - fromIndex) * gapMs);
        })(j);
      }
    },

    /** 다음 전환에 나올 한 장만 미리 받기 */
    prefetchIndex: function (photoUrls, idx) {
      if (!photoUrls || !photoUrls.length) return;
      var n = photoUrls.length;
      var i = ((idx % n) + n) % n;
      var src = photoUrls[i];
      if (!src) return;
      var im = new global.Image();
      im.decoding = "async";
      if ("fetchPriority" in im) im.fetchPriority = "high";
      im.src = src;
    },
  };

  global.GaingeHeroPreload = GaingeHeroPreload;
})(typeof window !== "undefined" ? window : this);
