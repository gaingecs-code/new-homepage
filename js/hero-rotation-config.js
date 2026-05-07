/**
 * 히어로 이미지 로테이션 타이밍 — 모든 공통 히어로(GaingeHeroRotation) 동일.
 * 기본 전환(crossfade)은 페이드 인·아웃 동일 ms·ease-in-out(css)으로 대칭 처리.
 * 첫 장(초기 진입)만 firstFadeInMs를 별도로 줄여 첫 화면이 더 빨리 보이도록 설정.
 */
(function (global) {
  var HR = {
    /** 한 장 전환 완료 후 다음 전환까지(ms) */
    holdMs: 2500,
    /** 첫 장만: hold의 90% — 첫 자동 전환 전 정지 구간 */
    firstHoldMs: Math.round(2500 * 0.9),
    /** 이중 레이어 크로스페이드(ms). 페이드 인·아웃 동일; 첫 장 페이드인도 동일 값 사용 */
    crossfadeMs: 750,
    /** 첫 장 초기 페이드인(ms): 기본 전환 대비 70% */
    firstFadeInMs: Math.round(750 * 0.7),
    /** 첫 자동 전환 전 대기 = 첫 페이드 완료에 가깝게 맞춘 정지 + firstFadeInMs + firstHoldMs */
    initialDelayMs: function () {
      return HR.firstFadeInMs + HR.firstHoldMs;
    },
    reduceMotionHoldMs: 5000,
  };
  global.HERO_ROTATION = HR;
})(typeof window !== "undefined" ? window : this);
