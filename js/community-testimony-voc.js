/**
 * 간증 섹션 — 3줄 VOC 타자기 (줄마다 문장 인덱스 독립)
 * - 1번(첫 줄) 90% → 2번 작성 시작
 * - 2번 90% → 3번 작성 시작
 * - 3번 90% → 1번을 다음 문장으로 다시 작성
 * - 대상 줄이 아직 타이핑 중이면, 완료될 때까지 대기(pending) — 문장 중간 절단 없음
 */
(function () {
  var root = document.querySelector("[data-community-testimony-voc]");
  if (!root) return;

  var LINES = [
    [
      "경영에 불안감이 있었는데 다른 경영자의 얘기를 들으며 안심 됐어요.",
      "같은 고민을 하는 이들이 있다는 점이 위로가 되었습니다.",
      "내 편이 생긴 것 같은 느낌이 참 좋아요. 왠지 든든합니다.",
      "경영에 진지하고 성장하려는 분들이 모인 것 같아서 좋았어요.",
      "이 모임에 나오는 것이 저에게는 약간 자랑스러운 일이 된 것 같아요."
    ],
    [
      "그저 가르쳐주는 것이 아니라, 실행 도구를 주셔서 좋았어요.",
      "사례를 말씀해주셔서 현장에서 어떻게 해야할지 손에 잡히는 것 같아요.",
      "여기에서 배운 것을 현장에서 시도하고 결과를 볼 때 보람을 느낍니다.",
      "경영에는 역시 사례가 최고인 것 같아요.",
      "컨설팅에 기반한 기업에서 운영하는 모임이어서 확실히 실무적이네요."
    ],
    [
      "다른 대표님들에게도 추천하고 싶은 모임이에요.",
      "여기에서 좋은 대표님들을 만나서 좋았습니다. 식사 모임도 만들었어요.",
      "왠지 전반적으로 착한 분들이 모인다는 느낌이 있어요.",
      "모임에 한 번 다녀가면 한 달을 보낼 에너지가 채워지는 것 같습니다.",
      "사실 오기가 쉽지는 않아요. 그래도 계속 참여하게 됩니다."
    ]
  ];

  var ROUNDS = LINES[0].length;
  var textEls = root.querySelectorAll(".community-testimony-voc-text");
  var carets = root.querySelectorAll(".community-testimony-caret");

  var CHAR_MS = 54;

  var idx = [0, 0, 0];
  var active = [true, false, false];
  var pos = [0, 0, 0];
  var full = ["", "", ""];
  var fired90 = [false, false, false];

  var pendingTryRow1 = false;
  var pendingTryRow2 = false;
  var pendingRestartRow0 = false;
  var pendingIdx0 = 0;

  full[0] = LINES[0][idx[0]];

  function setCaret(lineIdx, on) {
    var c = carets[lineIdx];
    if (!c) return;
    c.classList.toggle("is-active", !!on);
  }

  function thresholdFor(f) {
    if (!f || !f.length) return 1;
    return Math.max(1, Math.ceil(f.length * 0.9));
  }

  function tryStartRow(rowIdx) {
    if (rowIdx !== 1 && rowIdx !== 2) return;
    if (!active[rowIdx]) {
      active[rowIdx] = true;
      pos[rowIdx] = 0;
      full[rowIdx] = LINES[rowIdx][idx[rowIdx]];
      fired90[rowIdx] = false;
      textEls[rowIdx].textContent = "";
    } else if (rowIdx === 1) {
      pendingTryRow1 = true;
    } else {
      pendingTryRow2 = true;
    }
  }

  function tryRestartRow0() {
    var nextIdx = (idx[0] + 1) % ROUNDS;
    if (!active[0]) {
      idx[0] = nextIdx;
      active[0] = true;
      pos[0] = 0;
      full[0] = LINES[0][idx[0]];
      fired90[0] = false;
      textEls[0].textContent = "";
    } else {
      pendingRestartRow0 = true;
      pendingIdx0 = nextIdx;
    }
  }

  function onComplete(rowIdx) {
    active[rowIdx] = false;
    setCaret(rowIdx, false);

    if (rowIdx === 0) {
      if (pendingRestartRow0) {
        pendingRestartRow0 = false;
        idx[0] = pendingIdx0;
        active[0] = true;
        pos[0] = 0;
        full[0] = LINES[0][idx[0]];
        fired90[0] = false;
        textEls[0].textContent = "";
      }
      return;
    }

    if (rowIdx === 1) {
      idx[1] = (idx[1] + 1) % ROUNDS;
      if (pendingTryRow1) {
        pendingTryRow1 = false;
        tryStartRow(1);
      }
      return;
    }

    if (rowIdx === 2) {
      idx[2] = (idx[2] + 1) % ROUNDS;
      if (pendingTryRow2) {
        pendingTryRow2 = false;
        tryStartRow(2);
      }
    }
  }

  function check90(rowIdx) {
    var f = full[rowIdx];
    if (!f.length) return;
    if (pos[rowIdx] < thresholdFor(f)) return;
    if (fired90[rowIdx]) return;
    fired90[rowIdx] = true;
    if (rowIdx === 0) tryStartRow(1);
    else if (rowIdx === 1) tryStartRow(2);
    else tryRestartRow0();
  }

  function tick() {
    for (var i = 0; i < 3; i++) {
      if (!active[i]) continue;
      var f = full[i];
      if (pos[i] < f.length) {
        pos[i]++;
        textEls[i].textContent = f.slice(0, pos[i]);
        setCaret(i, true);
        check90(i);
        if (pos[i] >= f.length) {
          onComplete(i);
        }
      }
    }
  }

  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    var ri = [0, 0, 0];
    function showReduced() {
      for (var line = 0; line < 3; line++) {
        textEls[line].textContent = LINES[line][ri[line]];
      }
    }
    showReduced();
    setInterval(function () {
      ri[0] = (ri[0] + 1) % ROUNDS;
      ri[1] = (ri[1] + 1) % ROUNDS;
      ri[2] = (ri[2] + 1) % ROUNDS;
      showReduced();
    }, 4500);
    return;
  }

  setInterval(tick, CHAR_MS);
})();
