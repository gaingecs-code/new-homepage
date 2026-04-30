(function () {
  "use strict";

  var root = document.getElementById("diagnosis-app");
  if (!root) return;

  var diagnosisId = (root.getAttribute("data-diagnosis-id") || "").trim();
  if (!diagnosisId) return;

  var PAGE_SIZE = 6;
  var PAGE_NAV_HINT =
    "모든 문항에 응답하시면 다음 페이지로 진행할 수 있습니다.";
  var CSV_PATHS = {
    items: {
      leadership: "diagnosis-data/items_leadership.csv",
      dynamism: "diagnosis-data/items_dynamism.csv",
      gainge_mgmt: "diagnosis-data/items_gainge_mgmt.csv",
    },
    sectionScoring: {
      leadership: "diagnosis-data/section_scoring_leadership.csv",
      dynamism: "diagnosis-data/section_scoring_dynamism.csv",
      gainge_mgmt: "diagnosis-data/section_scoring_gainge_mgmt.csv",
    },
    typeRules: {
      leadership: "diagnosis-data/type_rules_leadership.csv",
      dynamism: "diagnosis-data/type_rules_dynamism.csv",
      gainge_mgmt: "diagnosis-data/type_rules_gainge_mgmt.csv",
    },
    sectionMap: {
      dynamism: "diagnosis-data/section_map_dynamism.csv",
    },
    typeAssets: "diagnosis-data/type_assets.csv",
  };

  var state = {
    items: [],
    answers: {},
    currentPage: 0,
    hasStarted: false,
    /** true이면 문항 대신 결과만 표시 */
    resultViewActive: false,
    /** 문항 영역으로 전환 직후 뷰 상단으로 스크롤 */
    scrollQuestionsTop: false,
    dataReady: false,
    sectionScoringRows: [],
    typeRulesRows: [],
    sectionMapRows: [],
    typeAssetRows: [],
    previewTypeId: "",
    previewMode: false,
  };

  var DIAGNOSIS_STATE_KEY = "diagnosis-engine-state-v1:" + diagnosisId;

  function pruneRestoredAnswers() {
    if (!state.items || !state.items.length) {
      state.answers = {};
      return;
    }
    var idSet = {};
    state.items.forEach(function (it) {
      idSet[it.itemId] = true;
    });
    var out = {};
    Object.keys(state.answers).forEach(function (k) {
      if (idSet[k]) {
        out[k] = state.answers[k];
      }
    });
    state.answers = out;
  }

  function validateRestoredSession() {
    var totalPages = Math.max(1, Math.ceil(state.items.length / PAGE_SIZE));
    if (state.currentPage > totalPages - 1) state.currentPage = totalPages - 1;
    if (state.currentPage < 0) state.currentPage = 0;
    if (state.resultViewActive) {
      if (getUnansweredCount() > 0) {
        state.resultViewActive = false;
      } else if (!computeResult()) {
        state.resultViewActive = false;
      }
    }
  }

  function loadSessionState() {
    if (!state.dataReady || !state.items.length) return;
    try {
      var raw = window.sessionStorage.getItem(DIAGNOSIS_STATE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data == null || data.v !== 1) return;
      if (typeof data.hasStarted === "boolean") state.hasStarted = data.hasStarted;
      if (data.answers && typeof data.answers === "object") {
        state.answers = data.answers;
      }
      if (typeof data.currentPage === "number" && !isNaN(data.currentPage)) {
        state.currentPage = data.currentPage;
      }
      if (typeof data.resultViewActive === "boolean") {
        state.resultViewActive = data.resultViewActive;
      }
    } catch (e) {
      if (window.console && console.debug) {
        console.debug("[diagnosis] loadSessionState", e);
      }
    }
    pruneRestoredAnswers();
    validateRestoredSession();
  }

  function persistState() {
    if (!state.dataReady) return;
    try {
      var payload = {
        v: 1,
        hasStarted: state.hasStarted,
        currentPage: state.currentPage,
        answers: state.answers,
        resultViewActive: state.resultViewActive,
      };
      window.sessionStorage.setItem(DIAGNOSIS_STATE_KEY, JSON.stringify(payload));
    } catch (e) {
      if (window.console && console.debug) {
        console.debug("[diagnosis] persistState", e);
      }
    }
  }

  root.addEventListener("click", function (ev) {
    var el = ev.target;
    /* 텍스트 등 비-요소 노드면 closest 없음 → 부모 Element 로 올림 */
    if (el && el.nodeType !== 1 && el.parentElement) {
      el = el.parentElement;
    }
    if (!el || typeof el.closest !== "function") return;
    var btn = el.closest("#diagnosis-start-btn");
    if (!btn || !root.contains(btn)) return;
    if (state.hasStarted) return;
    ev.preventDefault();
    state.hasStarted = true;
    state.scrollQuestionsTop = true;
    render();
  });

  root.addEventListener("change", function (ev) {
    var el = ev.target;
    if (!el || el.nodeType !== 1 || typeof el.matches !== "function") return;
    if (!el.matches("[data-diagnosis-preview-select]")) return;
    state.previewTypeId = String(el.value || "").trim();
  });

  root.addEventListener("click", function (ev) {
    var el = ev.target;
    if (el && el.nodeType !== 1 && el.parentElement) {
      el = el.parentElement;
    }
    if (!el || typeof el.closest !== "function") return;

    var applyBtn = el.closest("[data-diagnosis-preview-apply]");
    if (applyBtn && root.contains(applyBtn)) {
      ev.preventDefault();
      if (!state.previewTypeId) return;
      state.previewMode = true;
      state.hasStarted = true;
      state.resultViewActive = true;
      render();
      return;
    }

    var exitBtn = el.closest("[data-diagnosis-preview-exit]");
    if (exitBtn && root.contains(exitBtn)) {
      ev.preventDefault();
      state.previewMode = false;
      render();
    }
  });

  function getTypeRulesOrdered() {
    return (state.typeRulesRows || [])
      .slice()
      .sort(function (a, b) {
        var pa = toNumber(a.priority, Number.POSITIVE_INFINITY);
        var pb = toNumber(b.priority, Number.POSITIVE_INFINITY);
        if (pa !== pb) return pa - pb;
        return String(a.typeLabel || "").localeCompare(String(b.typeLabel || ""), "ko");
      });
  }

  function getRuleByTypeId(typeId) {
    var key = String(typeId || "").trim();
    if (!key) return null;
    for (var i = 0; i < state.typeRulesRows.length; i += 1) {
      if (state.typeRulesRows[i].typeId === key) return state.typeRulesRows[i];
    }
    return null;
  }

  function getPreviewPanelHtml() {
    var options = getTypeRulesOrdered();
    var optionHtml =
      '<option value="">결과 항목 선택</option>' +
      options
        .map(function (r) {
          var cleanLabel = formatResultCardLabel(r.typeLabel);
          var groupText = r.typeGroup === "STRENGTH" ? "강점" : "성장포인트";
          var selected = r.typeId === state.previewTypeId ? ' selected="selected"' : "";
          return (
            '<option value="' +
            escapeHtml(r.typeId) +
            '"' +
            selected +
            ">" +
            escapeHtml(cleanLabel + " - " + groupText) +
            "</option>"
          );
        })
        .join("");
    return (
      '<section class="diagnosis-preview-panel" aria-label="결과 미리보기">' +
      '<p class="diagnosis-preview-panel-title">임시 결과 미리보기</p>' +
      '<div class="diagnosis-preview-panel-controls">' +
      '<select class="diagnosis-preview-select" data-diagnosis-preview-select>' +
      optionHtml +
      "</select>" +
      '<button type="button" class="diagnosis-preview-apply-btn" data-diagnosis-preview-apply>미리보기</button>' +
      '<button type="button" class="diagnosis-preview-exit-btn" data-diagnosis-preview-exit>실제 결과로 보기</button>' +
      "</div>" +
      "</section>"
    );
  }

  /** 인트로는 각 diagnosis-*.html 에 정적 마크업으로 두고, 여기서는 표시·버튼 상태만 맞춥니다. */
  function renderIntro() {
    document.body.classList.remove("diagnosis-result-phase");
    var introPanel = root.querySelector("#diagnosis-intro-panel");
    var startBtn = root.querySelector("#diagnosis-start-btn");
    var questionsHost = root.querySelector("#diagnosis-questions-root");

    if (!introPanel || !startBtn || !questionsHost) {
      return;
    }

    introPanel.hidden = false;
    questionsHost.hidden = true;
    questionsHost.innerHTML = "";

    startBtn.disabled = false;
    startBtn.removeAttribute("aria-disabled");

    var oldPanel = introPanel.querySelector(".diagnosis-preview-panel");
    if (oldPanel) oldPanel.remove();
    startBtn.insertAdjacentHTML("beforebegin", getPreviewPanelHtml());
  }

  function parseCsv(text) {
    var lines = String(text || "")
      .replace(/\uFEFF/g, "")
      .split(/\r?\n/)
      .filter(function (line) {
        return line.trim().length > 0;
      });
    if (!lines.length) return [];

    function parseLine(line) {
      var out = [];
      var current = "";
      var inQuotes = false;
      for (var i = 0; i < line.length; i += 1) {
        var ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          out.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
      out.push(current);
      return out;
    }

    var headers = parseLine(lines[0]).map(function (h) {
      return (h || "").trim();
    });
    var rows = [];

    for (var li = 1; li < lines.length; li += 1) {
      var cols = parseLine(lines[li]);
      var row = {};
      for (var hi = 0; hi < headers.length; hi += 1) {
        var key = headers[hi];
        if (!key) continue;
        row[key] = (cols[hi] || "").trim();
      }
      rows.push(row);
    }
    return rows;
  }

  function fetchCsv(path) {
    var normalized = String(path || "").replace(/\\/g, "/");
    var candidates = [normalized];
    if (normalized.indexOf("./") !== 0) candidates.push("./" + normalized);
    if (normalized.indexOf("/") !== 0) candidates.push("/" + normalized);
    // 일부 로컬/서버 환경에서 한글/공백 경로 처리 차이 대응
    var segmentEncoded = normalized
      .split("/")
      .map(function (seg) {
        return encodeURIComponent(seg);
      })
      .join("/");
    candidates.push(segmentEncoded);
    if (segmentEncoded.indexOf("./") !== 0) candidates.push("./" + segmentEncoded);

    var tried = [];
    function tryAt(index) {
      if (index >= candidates.length) {
        return Promise.reject(
          new Error("CSV 로드 실패: " + path + " | 시도 경로: " + tried.join(" , "))
        );
      }
      var url = candidates[index];
      tried.push(url);
      return fetch(url, { cache: "no-store" })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status + " @ " + url);
          return res.text();
        })
        .catch(function () {
          return tryAt(index + 1);
        });
    }
    return tryAt(0);
  }

  function loadCsvText(path) {
    var inline = window.DIAGNOSIS_INLINE_CSV || null;
    if (inline && Object.prototype.hasOwnProperty.call(inline, path)) {
      return Promise.resolve(String(inline[path] || ""));
    }
    return fetchCsv(path);
  }

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function getUnansweredCount() {
    return state.items.reduce(function (count, item) {
      return state.answers[item.itemId] == null ? count + 1 : count;
    }, 0);
  }

  function getPageItems() {
    var start = state.currentPage * PAGE_SIZE;
    return state.items.slice(start, start + PAGE_SIZE);
  }

  function isCurrentPageComplete(pageItems) {
    if (!pageItems || !pageItems.length) return true;
    return pageItems.every(function (item) {
      return state.answers[item.itemId] != null;
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getRandomIndex(maxExclusive) {
    if (maxExclusive <= 1) return 0;
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return arr[0] % maxExclusive;
    }
    if (typeof Math.random === "function") {
      return Math.floor(Math.random() * maxExclusive);
    }
    return -1;
  }

  function stdDev(values) {
    if (!values || !values.length) return 0;
    var mean = values.reduce(function (a, b) {
      return a + b;
    }, 0) / values.length;
    var variance =
      values.reduce(function (sum, v) {
        var d = v - mean;
        return sum + d * d;
      }, 0) / values.length;
    return Math.sqrt(variance);
  }

  function byPriorityThenLabel(a, b) {
    var pa = toNumber(a.priority, Number.MAX_SAFE_INTEGER);
    var pb = toNumber(b.priority, Number.MAX_SAFE_INTEGER);
    if (pa !== pb) return pa - pb;
    return String(a.typeId).localeCompare(String(b.typeId));
  }

  function computeSectionScores() {
    // 2차 섹션(기본 섹션) 점수
    var rowsBySection = {};
    state.sectionScoringRows.forEach(function (row) {
      rowsBySection[row.sectionId] = row;
    });

    var itemResponsesBySection = {};
    state.items.forEach(function (item) {
      var score = toNumber(state.answers[item.itemId], NaN);
      if (!Number.isFinite(score)) return;
      if (!itemResponsesBySection[item.sectionId]) itemResponsesBySection[item.sectionId] = [];
      itemResponsesBySection[item.sectionId].push(score);
    });

    var childSectionScores = {};
    Object.keys(itemResponsesBySection).forEach(function (sectionId) {
      var responses = itemResponsesBySection[sectionId];
      var agg =
        rowsBySection[sectionId] && rowsBySection[sectionId].aggregation
          ? rowsBySection[sectionId].aggregation
          : "mean";
      var raw;
      if (agg === "sum") {
        raw = responses.reduce(function (a, b) {
          return a + b;
        }, 0);
      } else {
        raw =
          responses.reduce(function (a, b) {
            return a + b;
          }, 0) / responses.length;
      }
      childSectionScores[sectionId] = {
        raw: raw,
        responses: responses.slice(),
      };
    });

    if (diagnosisId !== "dynamism") {
      return childSectionScores;
    }

    // 조직역동성: 1차 섹션 점수로 재집계(각 8문항)
    var childByParent = {};
    state.sectionMapRows.forEach(function (m) {
      if (!childByParent[m.parentSectionId]) childByParent[m.parentSectionId] = [];
      childByParent[m.parentSectionId].push(m.childSectionId);
    });

    var parentScores = {};
    Object.keys(childByParent).forEach(function (parentId) {
      var childIds = childByParent[parentId];
      var mergedResponses = [];
      childIds.forEach(function (cid) {
        var c = childSectionScores[cid];
        if (c && c.responses && c.responses.length) {
          mergedResponses = mergedResponses.concat(c.responses);
        }
      });
      if (!mergedResponses.length) return;
      var raw =
        mergedResponses.reduce(function (a, b) {
          return a + b;
        }, 0) / mergedResponses.length;
      parentScores[parentId] = { raw: raw, responses: mergedResponses };
    });
    return parentScores;
  }

  function pickSectionWithTieBreak(candidates, sectionScores, candidateRules) {
    if (candidates.length <= 1) return candidates[0];

    // 1순위: 랜덤
    var randomIndex = getRandomIndex(candidates.length);
    if (randomIndex >= 0) {
      return candidates[randomIndex];
    }

    // 2순위: 표준편차 작은 섹션
    var bestStd = Number.POSITIVE_INFINITY;
    var stdCandidates = [];
    candidates.forEach(function (sid) {
      var sd = stdDev((sectionScores[sid] && sectionScores[sid].responses) || []);
      if (sd < bestStd - 1e-12) {
        bestStd = sd;
        stdCandidates = [sid];
      } else if (Math.abs(sd - bestStd) <= 1e-12) {
        stdCandidates.push(sid);
      }
    });
    if (stdCandidates.length === 1) return stdCandidates[0];

    // 3순위: priority 작은 행
    var ruleMap = {};
    (candidateRules || []).forEach(function (r) {
      ruleMap[r.targetSectionId] = r;
    });
    stdCandidates.sort(function (a, b) {
      var ra = ruleMap[a] || {};
      var rb = ruleMap[b] || {};
      return byPriorityThenLabel(ra, rb);
    });
    return stdCandidates[0];
  }

  function computeResult() {
    var sectionScores = computeSectionScores();
    var sectionIds = Object.keys(sectionScores);
    if (!sectionIds.length) return null;

    var minRaw = Number.POSITIVE_INFINITY;
    var maxRaw = Number.NEGATIVE_INFINITY;
    sectionIds.forEach(function (sid) {
      var raw = sectionScores[sid].raw;
      if (raw > maxRaw) maxRaw = raw;
      if (raw < minRaw) minRaw = raw;
    });

    var strengthRules = state.typeRulesRows.filter(function (r) {
      return r.typeGroup === "STRENGTH";
    });
    var growthRules = state.typeRulesRows.filter(function (r) {
      return r.typeGroup === "GROWTH";
    });

    var strengthCandidates = sectionIds.filter(function (sid) {
      return Math.abs(sectionScores[sid].raw - maxRaw) <= 1e-12;
    });
    var growthCandidates = sectionIds.filter(function (sid) {
      return Math.abs(sectionScores[sid].raw - minRaw) <= 1e-12;
    });

    var selectedStrengthSection = pickSectionWithTieBreak(
      strengthCandidates,
      sectionScores,
      strengthRules
    );
    var selectedGrowthSection = pickSectionWithTieBreak(
      growthCandidates,
      sectionScores,
      growthRules
    );

    function pickRule(groupRows, sectionId) {
      var rows = groupRows
        .filter(function (r) {
          return r.targetSectionId === sectionId;
        })
        .sort(byPriorityThenLabel);
      return rows[0] || null;
    }

    var strengthRule = pickRule(strengthRules, selectedStrengthSection);
    var growthRule = pickRule(growthRules, selectedGrowthSection);
    if (!strengthRule || !growthRule) return null;

    var assetMap = {};
    state.typeAssetRows.forEach(function (a) {
      assetMap[a.diagnosisId + "::" + a.typeId] = a;
    });

    function withAsset(rule) {
      var key = rule.diagnosisId + "::" + rule.typeId;
      var asset = assetMap[key] || null;
      var imageFileName = asset && asset.imageFileName
        ? asset.imageFileName
        : "img_" + rule.diagnosisId + "_" + rule.typeId + ".png";
      return {
        diagnosisId: rule.diagnosisId,
        typeId: rule.typeId,
        label: rule.typeLabel,
        targetSectionId: rule.targetSectionId,
        roundedScore:
          Math.round(toNumber(sectionScores[rule.targetSectionId].raw, 0) * 10) / 10,
        imageSrc: "assets/diagnosis/" + imageFileName,
        imageFileName: imageFileName,
        altText: (asset && asset.altText) || rule.typeLabel,
        typeGroup: rule.typeGroup,
      };
    }

    return {
      strength: withAsset(strengthRule),
      growth: withAsset(growthRule),
    };
  }

  /** 결과 카드 표시용: typeLabel 끝의 「 강점」「 성장포인트」 제거 (CSV typeLabel 유지와 무관하게 화면에만 적용) */
  function formatResultCardLabel(typeLabel) {
    var s = String(typeLabel || "").trim();
    var sufGrowth = " 성장포인트";
    var sufStrength = " 강점";
    if (s.endsWith(sufGrowth)) return s.slice(0, s.length - sufGrowth.length).trim();
    if (s.endsWith(sufStrength)) return s.slice(0, s.length - sufStrength.length).trim();
    return s;
  }

  /** 진단 유형별 기본 결과 텍스트(미입력 typeId fallback) */
  var RESULT_TEXT_MAP = {
    leadership: {
      strength:
        "{label}은 현재 조직이 비교적 안정적으로 실행하고 있는 주제입니다. 지금의 방식을 팀 단위 표준으로 정리해 확산해보세요.",
      growth:
        "{label}은 다음 성장 단계에서 우선 보완하면 효과가 큰 주제입니다. 실행 기준을 한 가지로 단순화해 2~4주 단위로 점검해보세요.",
    },
    dynamism: {
      strength:
        "{label}은 조직의 역동성을 지지하는 핵심 축입니다. 현재의 강점을 유지하면서 다른 영역과의 연결 실행을 늘려보세요.",
      growth:
        "{label}은 팀의 에너지를 끌어올리기 위해 먼저 손봐야 할 주제입니다. 현장에서 바로 적용 가능한 행동 단위로 쪼개어 개선해보세요.",
    },
    gainge_mgmt: {
      strength:
        "{label}은 가인지 경영 관점에서 이미 좋은 기반이 갖춰진 주제입니다. 반복 운영 체계와 리더 피드백으로 강점을 고정해보세요.",
      growth:
        "{label}은 성과와 문화의 균형을 위해 보완이 필요한 주제입니다. 담당자, 기간, 체크 기준을 명확히 두고 실행 밀도를 높여보세요.",
    },
    default: {
      strength:
        "{label}은 현재 상대적으로 잘 하고 있는 영역입니다. 지금의 실행을 표준화하고 확산하면 전체 성과에 도움이 됩니다.",
      growth:
        "{label}은 우선 보완하면 개선 효과가 큰 영역입니다. 작게 시작해 주기적으로 점검하면 빠른 변화를 만들 수 있습니다.",
    },
  };

  /** typeId별 상세 텍스트 매핑(순차 입력 예정). dynamism은 1번 소주제가 「성과관리 프로파일」 */
  var RESULT_TEXT_BY_TYPE_ID = {
    leadership: {
      S_TIME:
        "1. 리더십 프로파일/\n" +
        "자신의 시간을 데이터 기반으로 관리하며, 전략적 우선순위에 따라 조직의 리듬을 주도하는 경영자/\n" +
        "/\n" +
        "2. 강점 핵심/\n" +
        ' "데이터 기반의 철저한 자기 통제와 전략적 시간 배분"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "귀하는 본인의 시간을 단순한 스케줄이 아닌 '경영 자원'으로 인식하고 있습니다. 정기적인 시간 분석을 통해 의사결정의 골든타임을 확보하고 있으며, 표준시간표를 유연하게 수정함으로써 급변하는 경영 환경 속에서도 조직의 핵심 과제에 집중할 수 있는 환경을 스스로 구축하고 있습니다./\n" +
        "/\n" +
        "4. 기대 효과/\n" +
        "이러한 철저한 시간 관리는 당신의 생산성을 높일 뿐만 아니라, 조직 전체에 '우선순위 중심의 업무 문화'를 전파하는 리더십의 본보기가 됩니다.",
      G_TIME:
        "1. 리더십 프로파일/\n" +
        "바쁜 일정에 매몰되어 전략적 사유 시간이 부족하고, 비효율적인 시간 누수가 발생하는 경영자/\n" +
        "/\n" +
        "2. 보완점 핵심/\n" +
        '"운영의 늪에서 벗어나기 위한 시간 구조화 필요"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "현재 당신은 가용 시간의 상당 부분을 사후 대응적 업무(Reactive tasks)에 할애하고 있을 가능성이 큽니다. 시간을 기록하고 분석하는 과정이 부재하면, 경영자로서 반드시 챙겨야 할 '미래 전략 구상'보다 '당장 급한 불끄기'에 에너지를 뺏기게 됩니다. 낭비 요인이 반복적으로 발생하여 조직의 의사결정 속도가 늦어질 위험이 있습니다./\n" +
        "/\n" +
        "4. 실행 제언/\n" +
        "- 시간 로그 기록/\n" +
        "일주일간 자신의 시간 사용처를 1시간 단위로 기록하여 '반드시 직접 해야 할 일'과 '위임할 일'을 구분해 보십시오./\n" +
        "- 시간표로 절대시간 확보/\n" +
        "방해받지 않는 '전략적 사고 시간'을 매주 고정 스케줄로 확보하십시오./\n" +
        "- 효율화 루틴 만들기/\n" +
        "업무 프로세스 중 불필요한 보고나 회의 등 시간 낭비 요인을 찾아 과감히 제거하거나 자동화하십시오.",
      S_CONT:
        "1. 리더십 프로파일/\n" +
        "자신의 노력을 조직의 최종 성과와 정렬시키며, 관계보다 가치를 우선시하는 성과 지향적 경영자/\n" +
        "/\n" +
        "2. 강점 핵심/\n" +
        '"목적 중심의 업무 몰입과 성과 지향적 네트워크 구축"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "귀하는 본인의 과업이 조직의 목표, 특히 고객 가치 창출과 인재 양성에 어떻게 기여하는지 명확히 인식하고 있습니다. 단순히 바쁘게 일하는 것에 함몰되지 않고 '무엇을 위해 이 일을 하는가'라는 목적 의식이 뚜렷합니다. 또한 사내외 인적 네트워크를 단순한 친목이 아닌 '공헌과 협력'을 중심으로 구축하여 조직의 실질적인 성과를 견인하고 있습니다./\n" +
        "/\n" +
        "4. 기대 효과/\n" +
        "이러한 태도는 구성원들에게 '우리가 왜 이 일을 해야 하는가'에 대한 명확한 이정표를 제시하며, 조직 전체가 불필요한 활동을 줄이고 핵심 성과에 집중하게 만드는 강력한 동력이 됩니다.",
      G_CONT:
        "1. 리더십 프로파일/\n" +
        "과업의 본질적 의미보다 실행 자체에 집중하며, 성과와 무관한 관계 유지에 에너지를 소모하는 경영자/\n" +
        "/\n" +
        "2. 보완점 핵심/\n" +
        '"수단(Activity) 중심에서 결과(Contribution) 중심으로의 관점 전환 필요"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "현재 당신은 열심히 일하고 있으나, 그 노력이 조직의 핵심 성과(고객 가치, 인재 성장)로 이어지는 연결 고리가 다소 느슨할 수 있습니다. 경영자가 공헌의 대상을 명확히 정의하지 못하면, 조직은 '성과 없는 바쁨'에 빠지게 됩니다. 특히 사내외 관계를 맺을 때 공헌보다는 친밀도나 관성적인 네트워크에 의존할 경우, 결정적인 순간에 조직의 목표를 달성하는 데 필요한 협력을 끌어내기 어려워질 위험이 있습니다./\n" +
        "/\n" +
        "4. 실행 제언/\n" +
        "- 질문으로 업무 재정의하기/\n" +
        '모든 보고를 받거나 업무를 지시할 때, "이 일이 고객 가치 창출이나 우리 인재의 성장에 어떤 직접적인 기여를 하는가?"를 먼저 자문하십시오./\n' +
        "- 공헌 중심의 인맥 지도 그리기/\n" +
        "현재 정기적으로 만나는 사내외 인사들의 명단을 적어보고, 이 관계가 조직의 성과 창출과 어떤 공헌을 주고받는지 냉정히 평가하여 우선순위를 재조정하십시오./\n" +
        "- 과업 집중 시간(Focus Time) 선언/\n" +
        "나의 강점이 조직 성과에 가장 크게 기여할 수 있는 특정 과업을 선정하고, 매일 최소 2시간은 그 본질적 과업에만 몰입할 수 있도록 환경을 통제하십시오.",
      S_STRG:
        "1. 리더십 프로파일/\n" +
        "자신과 조직의 강점 지도를 명확히 파악하여, 성과를 내는 '적재적소'의 원칙을 실현하는 경영자/\n" +
        "/\n" +
        "2. 강점 핵심/\n" +
        '"강점 기반의 최적 의사결정과 조직 에너지 극대화"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "귀하는 본인의 재능이 성과로 연결되는 메커니즘을 정확히 이해하고 있으며, 이를 직무에 투영하여 높은 몰입도를 유지하고 있습니다. 특히 자신뿐만 아니라 상사와 부하 직원의 강점 스타일까지 파악하여 협업의 시너지를 내는 능력이 탁월합니다. 정기적인 피드백을 통해 강점을 강화하는 학습 루틴을 보유하고 있어, 조직 전체의 생산성을 높이는 엔진 역할을 하고 있습니다./\n" +
        "/\n" +
        "4. 기대 효과/\n" +
        "리더가 강점에 집중할 때 조직원은 심리적 안전감과 효능감을 느끼며, 이는 곧 약점을 보완하느라 에너지를 낭비하지 않는 '고효율 성과 조직'으로 이어집니다.",
      G_STRG:
        "1. 리더십 프로파일/\n" +
        "강점보다는 결점 보완에 에너지를 쓰며, 구성원의 잠재력을 성과로 연결하는 전략적 배치가 부족한 경영자/\n" +
        "/\n" +
        "2. 보완점 핵심/\n" +
        '"약점 보완(Fixing)에서 강점 강화(Building)로의 경영 패러다임 전환 필요"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "현재 당신은 본인과 조직원의 '잘하는 점'보다는 '부족한 점'을 메우는 데 더 많은 에너지를 소모하고 있을 가능성이 큽니다. 경영자가 강점에 무관심하면 적재적소의 인력 배치가 불가능해지고, 구성원들은 자신의 재능이 발휘되지 못한다는 좌절감을 느끼게 됩니다. 특히 정기적인 피드백 과정이 부재할 경우, 과거의 성공 방식에만 안주하게 되어 급변하는 시장에서 조직의 유연한 대응력을 떨어뜨리는 결과를 초래할 수 있습니다./\n" +
        "/\n" +
        "4. 실행 제언/\n" +
        "- 리더십 강점 리포트 작성/\n" +
        "자신을 포함하여 핵심 보고 라인에 있는 상사와 부하 직원의 '상위 강점 3가지'와 '업무 스타일'을 표로 정리해 보십시오. 이를 바탕으로 현재의 업무 분장이 적절한지 재검토하십시오./\n" +
        "- '피드백 루프' 상시화/\n" +
        '분기별로 본인이 달성한 성과를 복기하며, 어떤 강점이 결정적 역할을 했는지 기록하십시오. 잘 안된 일에 대해서는 "어떤 약점 때문인가"보다 "어떤 강점을 활용했다면 더 나았을까"를 고민하십시오./\n' +
        "- 강점 중심의 업무 재설계/\n" +
        "자신의 일과 중 강점과 맞지 않아 에너지를 소모시키는 업무가 무엇인지 파악하고, 그 업무를 해당 분야에 강점이 있는 구성원에게 위임하거나 시스템으로 보완할 방법을 찾으십시오.",
      S_PRIO:
        "1. 리더십 프로파일/\n" +
        "본질적 가치에 집중하며, 과거의 성공에 안주하기보다 미래의 기회를 포착하여 에너지를 결집시키는 경영자/\n" +
        "/\n" +
        "2. 강점 핵심/\n" +
        '"선택과 집중을 통한 성과 극대화 및 미래 지향적 통찰"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "귀하는 조직의 성과를 결정짓는 '결정적 소수(Vital Few)'를 정확히 구분해 내는 안목을 가졌습니다. 여러 일을 동시에 벌이기보다 한 번에 하나씩 완수하여 실질적인 결과를 만들어내며, 과거의 데이터에서 교훈을 얻되 시선은 항상 미래의 기회에 고정되어 있습니다. 이러한 태도는 조직의 자원이 분산되지 않게 막아주는 강력한 필터 역할을 합니다./\n" +
        "/\n" +
        "4. 기대 효과/\n" +
        "리더가 명확한 우선순위를 견지할 때, 조직 전체의 피로도는 낮아지고 성공 경험은 축적되어 '이기는 조직'으로 빠르게 변화합니다.",
      G_PRIO:
        "1. 리더십 프로파일/\n" +
        "사소한 다수의 업무에 에너지를 분산시키며, 미래의 기회보다 과거의 문제 해결에 빠져있는 경영자/\n" +
        "/\n" +
        "2. 보완점 핵심/\n" +
        '"과거의 짐(Problem)을 내려놓고 미래의 기회(Opportunity)로 자원 재배치 필요"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "현재 당신은 모든 일이 중요해 보이는 '우선순위 혼선' 상태에 있을 가능성이 큽니다. 많은 일을 동시에 처리하려다 보니 개별 과업의 완성도가 떨어지고, 정작 중요한 전략적 과업은 뒤로 밀리고 있습니다. 특히 '어제 일어난 문제'를 수습하는 데 가용 자원의 대부분을 사용하고 있다면, 내일의 성장을 위한 기회를 포착할 동력을 잃게 됩니다. 과거의 성공 방정식이 오늘날의 장애물이 되고 있지는 않은지 점검이 시급합니다./\n" +
        "/\n" +
        "4. 실행 제언/\n" +
        "- '폐기(Abandonment)' 리스트 작성/\n" +
        "새로운 일을 시작하기 전, 현재 하고 있는 일 중 성과가 낮거나 관성적으로 하는 일 하나를 골라 과감히 중단하십시오. '무엇을 할지'보다 '무엇을 그만둘지'를 먼저 결정해야 합니다./\n" +
        "- 기회 우선의 법칙(Opportunities First)/\n" +
        "회의나 보고를 받을 때 '문제점 보고'보다 '미래 기회와 가능성'에 대한 논의를 먼저 배치하십시오. 리더의 관심사가 조직의 자원 배분 방향을 결정합니다./\n" +
        "- 업무의 슬라이싱(Slicing)과 집중/\n" +
        "가장 중요도가 높은 단 하나의 과업(The One Thing)을 선정하고, 그 일이 끝날 때까지 다른 업무의 간섭을 차단하는 '집중 근무 시간'을 운영해 보십시오.",
      S_DECI:
        "1. 리더십 프로파일/\n" +
        "현상 너머의 본질을 꿰뚫어 보며, 다양한 견해를 통합하여 미래 가치를 창출하는 결단력 있는 경영자/\n" +
        "/\n" +
        "2. 강점 핵심/\n" +
        '"본질적 문제 해결과 다각적 검토를 통한 전략적 결단"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "귀하는 당장 눈앞의 문제를 덮는 '임시방편'이 아닌, 사태의 근본 원인을 찾아 뿌리 뽑는 통찰력을 발휘하고 있습니다. 의사결정 과정에서 만장일치의 위험을 경계하고 반대 의견을 충분히 수렴하여 리스크를 사전에 관리하며, 한 번 결정한 사항은 반드시 실행에 옮겨 결과를 확인하는 책임감을 보여줍니다./\n" +
        "/\n" +
        "4. 기대 효과/\n" +
        "리더의 이러한 결정 방식은 조직 내에 건강한 토론 문화를 정착시키고, 반복되는 문제로 인한 자원 낭비를 막아 조직의 기초 체력을 비약적으로 강화합니다.",
      G_DECI:
        "1. 리더십 프로파일/\n" +
        "당면한 상황을 해결하느라 충분한 검토와 사후 확인을 놓치기 쉬운 경영자/\n" +
        "/\n" +
        "2. 보완점 핵심/\n" +
        '"대증요법에서 근본 처방(Root Cause)으로의 의사결정 방향 조정 필요함"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "현재 당신은 문제의 본질을 파고들기보다 당장 급한 불을 끄는 식의 의사결정을 반복하고 있을 위험이 있습니다. 이는 같은 문제가 반복해서 발생하는 '악순환'의 원인이 됩니다. 또한, 리더의 생각과 일치하는 의견만 수용하거나 결정 이후 실행 여부를 꼼꼼히 챙기지 않는다면, 조직원들은 의사결정을 형식적인 절차로 인식하게 됩니다. 기회보다 위기 대응에만 치우친 결정은 조직의 성장 동력을 약화시킬 수 있습니다./\n" +
        "/\n" +
        "4. 실행 제언/\n" +
        "- '왜(Why)' 다섯 번 질문하기/\n" +
        '문제가 발생했을 때 첫 번째 해결책을 바로 채택하지 마십시오. "왜 이런 일이 생겼는가?"를 5번 반복 질문하여 현상이 아닌 구조적인 원인을 찾아내고 이를 해결하는 결정을 내리십시오./\n' +
        "- 의도적인 반대자(Devil's Advocate) 활용/\n" +
        "중요한 결정을 앞두고 회의를 할 때, 반드시 누군가에게는 의도적으로 반대 의견을 내는 역할을 맡기십시오. 만장일치는 결코 최고의 결정이 아님을 기억해야 합니다./\n" +
        "- '결정 일지'와 실행 점검/\n" +
        "결정된 사항이 실제 행동으로 옮겨졌는지 확인하기 위한 '의사결정 체크리스트'를 만드십시오. 무엇을 결정했는지보다, 그 결정이 현장에서 어떻게 작동했는지 확인하는 피드백 세션을 정례화하십시오.",
      S_CORE:
        "1. 리더십 프로파일/\n" +
        "고객의 목소리를 경영의 최우선 순위에 두고, 차별화된 가치 창출을 통해 시장의 주도권을 확보하는 고객 중심형 경영자/\n" +
        "/\n" +
        "2. 강점 핵심/\n" +
        '"고객 가치 기반의 명확한 차별화와 현장 중심의 경영 철학"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "귀하는 시장 경쟁력의 본질이 기술이나 자본이 아닌 '고객'에게 있음을 깊이 신뢰하고 있습니다. 고객의 피드백을 가감 없이 들을 수 있는 체계를 갖추고 있으며, 모든 의사결정의 순간에 \"이것이 고객에게 어떤 이득을 주는가?\"를 자문하는 습관이 정착되어 있습니다. 우리 기업만이 줄 수 있는 고유한 가치를 명확히 정의하고 이를 사업 전략에 일관되게 반영하고 있습니다./\n" +
        "/\n" +
        "4. 기대 효과/\n" +
        "리더가 고객 가치에 집착할 때 조직은 흔들리지 않는 기준을 갖게 되며, 이는 강력한 팬덤 형성 및 대체 불가능한 브랜드 파워로 이어집니다.",
      G_CORE:
        "1. 리더십 프로파일/\n" +
        "고객의 실질적인 결핍보다 내부 효율이나 매출 지표에 집중하며, 시장의 목소리와 단절된 채 관성적으로 경영하는 경영자/\n" +
        "/\n" +
        "2. 보완점 핵심/\n" +
        '"지표 중심 경영에서 현장 고객 데이터 중심 경영으로의 복귀 필요"/\n' +
        "/\n" +
        "3. 상세 진단/\n" +
        "현재 당신은 고객이 누구이며 그들이 진정으로 원하는 것이 무엇인지에 대한 생생한 감각을 잃어가고 있을 위험이 있습니다. 보고서상의 숫자나 내부 운영 효율에만 매몰되면, 우리 제품과 서비스가 제공하는 차별성을 잃게 되고 결국 시장에서 가격 경쟁의 늪에 빠지게 됩니다. 고객의 목소리가 리더에게 도달하는 경로가 막혀 있거나 형해화되어 있다면, 중대한 전략적 실책을 범할 가능성이 큽니다./\n" +
        "/\n" +
        "4. 실행 제언/\n" +
        "- 고객 피드백의 직통 라인(Hotline) 구축/\n" +
        "일주일 중 단 1시간이라도 고객의 불만(VOC)이나 리뷰를 원문 그대로 직접 읽거나, 최전방 접점 직원의 목소리를 듣는 시간을 고정하십시오. 필터링 되지 않은 데이터가 경영의 날을 세워줍니다./\n" +
        "- 의사결정의 '빈 의자' 기법 도입/\n" +
        "회의 시 자리에 없는 고객을 상징하는 빈 의자를 두고, 중요한 결정을 내리기 전 \"이 자리에 앉은 고객이 우리의 결정을 본다면 만족할 것인가?\"를 반드시 논의하십시오./\n" +
        "- 가치 제안(Value Proposition) 재정의/\n" +
        "\"우리 회사가 내일 당장 사라진다면 고객은 우리의 어떤 기능 때문에 슬퍼할 것인가?\"라는 질문에 단 한 문장으로 답해 보십시오. 그 답변이 바로 귀하가 집중해야 할 차별적 핵심 가치입니다.",
    },
    dynamism: {
      S_VISION:
        "1. 성과관리 프로파일/\n" +
        "리더의 시각에서 우리 조직은 전사 비전과 개별 과업이 유기적으로 연결된 '고정렬(High-Alignment)' 상태로 인식되고 있습니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"리더가 체감하는 목표 가시성과 전사적 정렬 수준이 매우 높음"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 우리 조직의 비전이 단순한 구호를 넘어 구성원의 일상 업무 속에 깊이 내재화되어 있다고 평가하셨습니다. 전사 목표가 정기적으로 투명하게 공유되고 있으며, 누구나 목표 관련 데이터에 접근할 수 있는 개방적인 정보 구조를 갖추고 있다는 확신을 보여주십니다. 특히 구성원들이 자신의 업무가 전사 성과에 어떻게 기여하는지 명확히 인식하고 있어, 리더가 보기에 조직 전체가 높은 응집력을 바탕으로 탁월한 실행력을 발휘하고 있는 것으로 분석됩니다. 이는 리더가 구축한 목표 관리 시스템과 소통 체계에 대한 높은 신뢰를 반영합니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 성과 지표의 전사 가시화(Transparency):/\n" +
        "리더가 느끼는 정렬 상태가 유지되도록 KPI/OKR 달성률을 누구나 실시간 확인 가능한 통합 대시보드를 강화하여 정보의 투명성을 유지하십시오./\n" +
        "- 'Bottom-up' 연결 고리 정례화:/\n" +
        "전사 목표에 맞춰 각 팀이 도전 과제를 스스로 제안하는 프로세스를 구축하여, 리더가 인지하는 목표 의식이 현장까지 도달하게 하십시오./\n" +
        "- 전사적 '얼라인먼트 데이' 운영:/\n" +
        "현재 활동이 비전 달성에 어떻게 기여하는지 점검하고 공유하는 자리를 정기적으로 마련하여 리더와 구성원의 방향성을 상시 동기화하십시오.",
      G_VISION:
        "1. 성과관리 프로파일/\n" +
        "리더의 시각에서 우리 조직은 전사 비전과 실무 목표가 다소 단절되어 있으며, 부서 간 목표가 파편화된 '저정렬(Low-Alignment)' 상태로 인식되고 있습니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"추상적 비전과 현장 실무 사이의 연결 고리 부재 및 정보 폐쇄성 개선 필요"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 현재 조직의 비전이 구성원들에게 명확히 전달되지 않거나, 공유되는 목표가 실제 실행 계획으로 이어지는 논리가 부족하다고 평가하셨습니다. 목표와 관련된 공식 문서에 대한 접근성이 낮고 전사적 목표 공유가 정기적으로 이뤄지지 못하고 있다는 인식은, 구성원들이 '내가 왜 이 일을 해야 하는가'에 대한 의문을 가질 수 있음을 시사합니다. 리더가 보기에 현재 조직은 각자도생식의 업무 몰입은 있으나, 조직 전체의 에너지를 한곳으로 모으는 정렬 체계의 보완이 시급한 상태입니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 비전의 '실행 언어' 변환:/\n" +
        "추상적인 경영 슬로건을 각 팀이 즉시 실행할 수 있는 구체적인 핵심 결과(Key Results)로 변환하여 현장에 다시 전파하십시오./\n" +
        "- 목표 접근성 전면 개방:/\n" +
        "전사 목표와 진행 상황이 정리된 대시보드나 공유 문서에 모든 구성원이 상시 접근할 수 있도록 정보 공유 프로세스를 투명하게 개선하십시오./\n" +
        "- 직무 기여도 재확인 면담:/\n" +
        '리더와 구성원이 함께 "나의 업무가 조직의 성공에 어떤 가치를 더하는가"를 정의하는 1:1 세션을 통해 개인 과업의 의미를 재정립하십시오.',
      S_INNO:
        "1. 성과관리 프로파일/\n" +
        "리더의 관점에서 우리 조직은 구성원들이 도전적 목표를 즐기며 자발적으로 학습하고 시도하는 '능동적 혁신' 단계로 파악됩니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"직무 주도권과 창의적 제안 활동이 활발하게 이뤄지고 있다는 리더의 긍정적 인식"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 우리 조직 구성원들에게 충분한 과업 주도권이 부여되어 있으며, 외부의 강요가 아닌 내부 동기에 의해 움직이는 자발적 업무 문화가 정착되어 있다고 평가하셨습니다. 최근의 아이디어 제안 활동이나 창의적 문제 해결 시도가 빈번하게 일어난다고 인식하시는 것은, 리더가 조직 내에 '실패해도 괜찮다'는 유무형의 지원 시스템을 잘 갖추고 있다고 믿기 때문입니다. 목표 달성에 필요한 자원을 구성원이 당당히 요청할 수 있는 환경이 조성되어 있다는 점은 조직의 혁신 속도를 높이는 강력한 자산으로 파악됩니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 혁신 실험 비용(Innovation Budget) 지원:/\n" +
        "창의적 아이디어를 제안한 구성원이 작게라도 실험해 볼 수 있도록 시간과 예산 등 필요한 자원을 즉시 배정하는 프로세스를 공식화하십시오./\n" +
        "- 학습과 성과의 선순환 구조 강화:/\n" +
        "도전적 목표 달성을 위해 필요한 학습 활동(교육, 정보 구독 등)을 적극 지원하여 '성장하며 성과를 내는 경험'을 조직의 성공 공식으로 만드십시오./\n" +
        "- 주도권 기반의 성과 공유:/\n" +
        "자발적 참여로 이뤄낸 성과에 대해서는 결정 과정에서의 구성원 주도권을 높게 평가하여 그들의 효능감을 극대화하십시오.",
      G_INNO:
        "1. 성과관리 프로파일/\n" +
        "리더의 관점에서 우리 조직은 실패 리스크를 피하기 위해 안전한 목표에 안주하며, 새로운 시도나 창의적 제안이 위축된 '안정 지향적 정체' 상태로 파악됩니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"심리적 안전감 부족과 통제 중심의 구조로 인한 자발적 혁신 동력 약화"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 구성원들이 자신의 역량 대비 도전적인 목표를 설정하기보다 달성 가능한 범위 내에서 움직이려 한다고 평가하셨습니다. 창의적인 아이디어 제안이나 새로운 프로젝트에 대한 도전이 최근 3개월간 저조했다는 인식은, 조직 내에 '실패에 대한 두려움'이나 '제안해도 바뀌지 않는다'는 무력감이 존재할 가능성을 보여줍니다. 과업 수행의 주도권이 구성원에게 충분히 이전되지 않아 자발성보다는 지시에 따른 수행이 우선시되고 있는 점이 혁신의 정체를 가져오는 주요 원인으로 분석됩니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- '도전적 실패' 면책 제도화:/\n" +
        "결과가 좋지 않더라도 과정이 도전적이었다면 이를 긍정적으로 평가하는 문화를 제도적으로 명시하여 실패에 대한 공포를 제거하십시오./\n" +
        "- 직무 자율성(Autonomy) 범위 명문화:/\n" +
        "업무 방식이나 자원 배분에 있어 구성원이 직접 결정할 수 있는 권한 범위를 명확히 규정하여 과업 주도권을 회복시켜 주십시오./\n" +
        "- 아이디어 피드백 'Fast-Track' 구축:/\n" +
        "제안된 아이디어가 사장되지 않도록 72시간 이내 피드백하거나 소규모 실험 기회를 즉시 부여하여 제안의 효능감을 체감하게 하십시오.",
      S_SUPP:
        "1. 성과관리 프로파일/\n" +
        "스스로에 대해 구성원의 의견을 경청하고 실무적 장애물을 적극적으로 해결해 주는 '성과 촉진형(Facilitative) 리더십'을 실천하고 있다고 인식하고 계십니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"정서적 지지와 실무적 가이드가 조화를 이루고 있다는 리더의 자기 진단"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 스스로가 구성원의 의견을 이해하려 노력하며, 그들의 성과를 적절히 인정하고 지지하는 조력자 역할을 충실히 수행하고 있다고 평가하셨습니다. 구성원이 업무 중 겪는 병목 현상을 정확히 파악하여 필요한 자료와 가이드를 제공하고 있으며, 리더의 피드백이 실제 구성원의 역량 향상과 업무 진척에 실질적인 도움을 주고 있다는 강한 확신을 가지고 계십니다. 이는 리더 스스로가 '관리'보다는 '지원'에 무게중심을 둔 성과관리 철학을 보유하고 있음을 의미합니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 지원적 리더십 사례 공유:/\n" +
        "성과 향상을 이끈 리더의 피드백 방식이나 장애물 해결 사례를 사내에 공유하여 조직 내 리더십의 표준 모델로 확산시키십시오./\n" +
        "- 코칭 중심의 피드백 체계 강화:/\n" +
        "단순 결과 평가가 아닌 '성장과 해결'에 초점을 맞춘 코칭 기술을 정기적으로 연마하여 피드백의 실질적 영향력을 유지하십시오./\n" +
        "- 인정(Recognition)의 제도화:/\n" +
        "리더의 인정을 구성원이 더 명확히 체감할 수 있도록 칭찬 채널이나 즉각적인 보상 툴을 활용하여 인정 문화를 더욱 공고히 하십시오.",
      G_SUPP:
        "1. 성과관리 프로파일/\n" +
        "리더 스스로 진단하기에, 구성원과의 정서적 교감이 부족하거나 실무적 장애물을 해결해 주는 '조력자로서의 역할'이 충분히 발휘되지 못하는 상태로 인식하고 계십니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"피드백의 실효성 저하 및 지원 체계 미흡으로 인한 리더십 영향력 약화"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 스스로 구성원의 의견을 깊이 이해하려는 노력이 부족했거나, 그들의 성과를 인정하고 지지하는 피드백의 질이 만족스럽지 못하다고 평가하셨습니다. 구성원이 업무 중 막혀 있는 지점을 정확히 파악하여 필요한 자료나 자원을 적시에 제공하지 못했다는 인식은, 리더와 구성원의 관계가 다소 기능적이고 단절되어 있음을 시사합니다. 리더가 주는 피드백이 구성원의 역량 향상에 실질적인 동력이 되지 못하고 있다는 자기 성찰은 리더십 스타일의 전면적인 변화가 필요한 시점임을 보여줍니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- '장애물 파악' 전용 1:1 미팅 도입:/\n" +
        '지시나 보고 중심의 회의에서 벗어나, "내가 당신의 업무를 돕기 위해 무엇을 제거해주면 좋겠는가"를 묻는 지원 중심의 면담을 정례화하십시오./\n' +
        "- 인정 및 지지의 구체화:/\n" +
        "추상적인 칭찬 대신, 구성원의 특정 행동이 조직 성과에 기여한 바를 구체적으로 짚어주는 '맥락 있는 인정' 빈도를 높이십시오./\n" +
        "- 역량 향상 중심 피드백 학습:/\n" +
        "단순한 평가 피드백이 아닌, 구성원의 미래 성장을 설계하는 '코칭형 피드백' 기법을 습득하여 대화의 질을 높이십시오.",
      S_PSYC:
        "1. 성과관리 프로파일/\n" +
        "리더가 인지하는 우리 조직은 실수에 대해 관대하며, 어떤 의견이든 자유롭게 개진될 수 있는 '고신뢰·개방형' 문화를 갖추고 있습니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"비난 없는 소통과 건강한 비판이 수용되는 안전한 환경이라는 리더의 평가"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 우리 조직 내에서 실수가 비난의 대상이 되지 않으며, 리더와 견해가 달라도 소신 있게 발언할 수 있는 개방적인 분위기가 형성되어 있다고 평가하셨습니다. 엉뚱한 의견도 무시받지 않고 갈등이 가십거리가 되지 않는 성숙한 소통 구조를 갖추고 있다는 인식은, 리더가 조직 내 심리적 안전감의 중요성을 깊이 인지하고 있음을 보여줍니다. 실수를 극복할 기회가 제공되고 솔직함이 보장되는 환경은 조직의 잠재적 리스크를 조기에 발견하게 하는 훌륭한 방어기제로 작동한다고 믿고 계십니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- '실수 학습'의 자산화:/\n" +
        "실패 사례를 공유하고 교훈을 정리하는 포스트모템(Post-mortem) 문화를 정착시켜 실수가 비난이 아닌 학습의 대상임을 시스템으로 명확히 하십시오./\n" +
        "- 회의 운영 원칙(Ground Rules) 수립:/\n" +
        "'모든 의견은 가치 있다'는 원칙을 회의실에 명문화하여 리더가 느끼는 안전감을 구성원들도 동일하게 느낄 수 있게 하십시오./\n" +
        "- 취약성 리더십 강화:/\n" +
        "리더가 먼저 자신의 고민이나 실수를 솔직하게 공유하는 자리를 마련하여 구성원들이 안심하고 의견을 낼 수 있는 심리적 문턱을 낮추십시오.",
      G_PSYC:
        "1. 성과관리 프로파일/\n" +
        "리더가 인지하는 우리 조직은 실수에 대한 비난의 우려가 존재하며, 다른 의견을 내는 것에 부담을 느끼는 '방어적 소통' 문화가 형성되어 있습니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"비난에 대한 두려움과 침묵하는 문화로 인한 조직적 리스크 은폐 가능성"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 구성원들이 실수했을 때 비난받을 것을 걱정하거나, 리더와 견해가 다를 때 자신의 의견을 솔직하게 말하지 못한다고 평가하셨습니다. 엉뚱한 의견이 무시당하거나 갈등이 건설적인 토론이 아닌 사적인 가십거리가 되는 경향이 있다는 인식은, 조직 내 심리적 문턱이 매우 높음을 의미합니다. 잘못을 솔직하게 인정하기보다 숨기려 하고, 실수를 극복할 기회가 부족하다고 느끼는 환경은 조직의 투명성을 저해하고 장기적으로 집단적 침체에 빠뜨릴 위험이 큽니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 익명 소통 창구 활성화:/\n" +
        "신원 노출의 우려 없이 자유롭게 의견이나 리스크를 제안할 수 있는 채널을 마련하여 억눌린 현장의 목소리를 양지로 끌어내십시오./\n" +
        "- 리더의 취약성 먼저 드러내기:/\n" +
        "리더가 본인의 실수나 모르는 점을 먼저 고백함으로써, 조직원들에게 '완벽하지 않아도 안전하다'는 강력한 신호를 보내십시오./\n" +
        "- 심리적 안전감 그라운드 룰 수립:/\n" +
        "회의나 협업 시 '상대의 인격을 비난하지 않는다', '모든 의견은 끝까지 듣는다' 등 소통의 규칙을 정하고 이를 위반할 시 서로 경고해주는 문화를 만드십시오.",
      S_EFFI:
        "1. 성과관리 프로파일/\n" +
        "리더의 시각에서 우리 구성원들은 자신의 직무에 강한 자부심을 느끼며, 스스로를 조직의 핵심 인재로 인식하는 '고효능·고몰입' 상태로 평가됩니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"구성원들의 높은 책임감과 프로페셔널리즘에 대한 리더의 강한 신뢰"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 구성원들이 업무에 깊이 몰입하여 자기 주도적으로 일하고 있으며, 성과에 대한 책임 또한 본인에게 있다고 믿는 주체적인 태도를 보인다고 파악하셨습니다. 기한 내에 높은 수준의 결과물을 내놓으려는 완결성과 자신의 일을 주변에 당당히 소개할 수 있는 자부심이 조직 전체에 흐르고 있다는 평가는 리더가 인적 자본의 역량을 매우 높게 평가하고 있음을 나타냅니다. 리더가 보기에 우리 구성원들은 업무를 단순한 생계 수단이 아닌 자아실현과 성장의 통로로 활용하고 있는 고효능 인재들입니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 직무의 의미 재조명(Job Crafting) 지원:/\n" +
        "구성원의 업무가 고객과 사회에 미치는 긍정적 영향력을 정기적으로 공유하여 현재의 높은 직무 자부심을 고취하십시오./\n" +
        "- 자기 결정권 확대:/\n" +
        "스스로 높은 기준을 가진 구성원들에게는 업무 방식에 대한 더 많은 재량권을 부여하여 몰입의 즐거움을 극대화할 수 있는 환경을 제공하십시오./\n" +
        "- 전문성 강화 로드맵 제공:/\n" +
        "현재의 효능감이 지속적인 성장으로 연결되도록 한 단계 높은 수준의 전문성을 습득할 수 있는 도전적 과제와 학습 기회를 지속적으로 연결하십시오.",
      G_EFFI:
        "1. 성과관리 프로파일/\n" +
        "리더의 시각에서 우리 구성원들은 업무를 단순 반복 과업으로 여기며, 자신의 기여도나 성과 창출 능력에 대해 확신이 낮은 '저효능·무기력' 상태로 파악됩니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"직무 자부심 하락과 책임 회피 성향으로 인한 조직 생산성 저하 우려"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 구성원들이 업무에 몰입하여 즐거움을 느끼는 경우가 드물고, 성과에 대한 책임을 외부로 돌리려는 수동적인 태도를 보인다고 평가하셨습니다. 기한 내 업무 완수나 결과물의 품질에 대한 스스로의 기대치가 낮아져 있으며, 자신의 일을 주변에 자랑스럽게 말하지 못할 정도로 직무 자부심이 떨어진 상태라는 인식은 매우 뼈아픈 진단입니다. 리더가 보기에 구성원들은 '왜 이 일을 하는가'에 대한 답을 잃어버린 상태이며, 이는 조직의 인적 경쟁력이 약화되고 있음을 경고하는 지표입니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- '작은 성공(Small Win)'의 설계:/\n" +
        "너무 큰 목표 대신 즉각 달성 가능한 작은 과업을 부여하고, 성공했을 때 즉시 축하하여 잃어버린 효능감을 단계적으로 회복시키십시오./\n" +
        "- 개별 직무의 사회적 가치 연결:/\n" +
        "구성원의 사소한 업무가 실제 고객의 삶을 어떻게 개선했는지 구체적인 사례를 공유하여 '일의 의미'를 다시 발견하게 하십시오./\n" +
        "- 강점 기반 직무 재배치:/\n" +
        "현재 업무에서 전혀 흥미를 느끼지 못하는 구성원에게는 본인의 강점과 적성에 맞는 새로운 역할을 탐색할 기회를 부여하여 몰입의 불씨를 지펴주십시오.",
    },
    gainge_mgmt: {
      S_CULT_SAT:
        "1. 조직 프로파일/\n" +
        "리더의 시각에서 우리 조직은 구성원 간 깊은 신뢰를 바탕으로 공적인 업무뿐 아니라 개인적인 고민까지 나눌 수 있는 '가족적·신뢰' 문화를 보유하고 있습니다. 조직에 대한 자부심이 높고 서로를 격려하는 에너지가 충만한 상태입니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"진솔한 소통과 상호 지지를 바탕으로 자부심이 선순환되는 건강한 조직 문화"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 우리 조직의 공식 미팅이 형식에 치우치지 않고 진솔한 대화가 오가는 살아있는 소통의 장이라고 평가하셨습니다. 리더와 구성원 사이에는 개인적인 고민을 나눌 수 있을 정도의 두터운 신뢰가 형성되어 있으며, 서로의 건강한 가정생활까지 배려하는 따뜻한 분위기가 조성되어 있다고 파악하셨습니다. 특히 외부인에게 자랑하고 싶을 만큼 매력적인 문화적 사례들이 지속적으로 창출되고 있어, 리더가 보기에 우리 조직은 단순한 직장을 넘어 '정서적 공동체'로서의 기능을 훌륭히 수행하고 있습니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 문화적 성공 사례 기록 및 전파:/\n" +
        "조직 내에서 발생하는 격려와 지지, 자부심의 순간들을 '스토리'로 기록하여 전사적으로 공유함으로써 우리만의 고유한 문화를 자산화하십시오./\n" +
        "- 심리적 유대감을 높이는 소셜 루틴 강화:/\n" +
        "현재의 높은 신뢰가 유지될 수 있도록 업무 외적인 주제로 가볍게 소통하는 '티타임'이나 '문화의 날' 등 정서적 연결 고리를 더욱 촘촘히 하십시오./\n" +
        "- 가정 친화적 제도의 명문화:/\n" +
        "리더가 인지하는 '건강한 가정'의 가치가 제도로서도 보장될 수 있도록 유연근무나 가족 초청 행사 등 일·가정 양립을 지원하는 정책을 강화하십시오.",
      G_CULT_SAT:
        "1. 조직 프로파일/\n" +
        "리더의 관점에서 우리 조직은 소통이 다소 형식적이며 구성원 간의 정서적 교류보다 업무 중심의 드라이한 관계가 주를 이루는 '기능적·경직적' 상태로 인식됩니다. 조직에 대한 자부심을 느낄만한 상징적 사례가 부족한 상황입니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"형식적인 소통 구조와 정서적 지지 체계 부족으로 인한 조직 응집력 약화"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "현재 응답자께서는 우리 조직의 소통 방식이 다소 경직되어 있어 공식적인 자리에서 마음속 깊은 진솔한 이야기가 나오기 어렵다고 평가하셨습니다. 리더와 구성원, 혹은 동료 사이에 개인적인 고민을 나누거나 서로를 격려하는 정서적 안전망이 충분하지 않으며, 일과 가정의 균형이 흔들리고 있을 가능성을 인지하고 계십니다. 특히 조직원들이 외부인에게 우리 문화를 자랑스러워할 만한 뚜렷한 사례나 자부심의 근거가 약해져 있다는 인식은, 조직의 정체성이 희미해지고 에너지가 고갈되고 있음을 시사합니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 진솔한 대화를 위한 '경청 세션' 도입:/\n" +
        "회의 전 5분간의 체크인(Check-in) 미팅 등을 통해 업무 외의 감정과 상태를 먼저 나누는 연습을 함으로써 소통의 온도를 높이십시오./\n" +
        "- 동료 간 '칭찬·감사' 캠페인 활성화:/\n" +
        "서로의 존재와 기여를 공식적으로 인정하고 지지하는 채널(예: 감사 카드, 칭찬 릴레이)을 마련하여 상호 신뢰의 토양을 다시 다지십시오./\n" +
        "- 조직 자부심을 만드는 '작은 변화' 기획:/\n" +
        "구성원들이 작게라도 자랑스러워할 만한 우리 조직만의 독특한 문화적 이벤트나 복지 요소를 발굴하여 성공 경험을 쌓아 나가십시오.",
      S_TAL_PLACE:
        "1. 조직 프로파일/\n" +
        "리더의 시각에서 우리 조직은 내부 전문가가 포진해 있으며, 기존 구성원이 리더로 성장하는 '선순환적 인재 육성' 상태입니다. 역량에 따른 승진과 공정한 보상이 시스템적으로 작동하여 조직 전체의 성과 밀도가 높아지고 있습니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"명확한 롤모델과 공정한 보상 체계를 바탕으로 인재의 성장이 성과로 직결되는 조직"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 우리 조직 내에 신입사원이 본받을 만한 롤모델과 전문가가 충분하며, 성과를 내는 인원이 지속적으로 늘고 있다고 평가하셨습니다. 역량 있는 인재가 승진하고 기존 멤버가 리더로 세워지는 과정을 통해 '성장 사다리'가 정상적으로 작동하고 있음을 확신하고 계십니다. 특히 보상과 포상이 단순히 금전적 의미를 넘어 즐겁게 일하는 동기가 되고 있으며, 우리만의 인재상에 부합하는 인력이 합류하여 적절한 업무 분장 아래 역량을 발휘하고 있다는 점은 리더가 보기에 매우 고무적인 상태입니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 내부 지식 전문가 인증 제도:/\n" +
        "사내 전문가들의 노하우가 공식적으로 인정받고 전수될 수 있도록 '사내 강사'나 '지식 마스터' 제도를 운영하여 전문성을 자산화하십시오./\n" +
        "- 성장 경로 가시화:/\n" +
        "구성원이 리더로 성장한 실제 사례를 기반으로 표준 성장 로드맵을 제시하여, 모든 인재가 미래의 모습을 꿈꿀 수 있게 하십시오./\n" +
        "- 성과 기반 포상 스토리텔링:/\n" +
        "보상이 단순히 '지급'되는 것에 그치지 않고, 어떤 성과와 지식이 축하받는지 그 배경을 공유하여 공정성에 대한 확신을 높이십시오.",
      G_TAL_PLACE:
        "1. 조직 프로파일/\n" +
        "리더의 관점에서 우리 조직은 내부에서 성장의 롤모델을 찾기 어렵고, 인재 배치와 보상 시스템이 구성원들을 충분히 몰입시키지 못하는 '성장 정체 및 보상 불균형' 상태로 인식됩니다. 적재적소의 인력 배치가 시급한 상황입니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"인재 성장 가이드 부재와 보상 공정성 인식 저하로 인한 핵심 인력 이탈 리스크"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "현재 응답자께서는 우리 조직 내에 신입사원에게 제시할 만한 롤모델이 부족하거나, 기존 구성원이 리더로 성장하는 속도가 정체되어 있다고 평가하셨습니다. 역량보다는 관행에 따른 승진이 이뤄지고 있다는 우려가 있으며, 보상과 포상이 실제 업무 동기를 유발하기보다 오히려 불만족의 원인이 될 가능성을 인지하고 계십니다. 인재상에 맞지 않는 인력의 합류나 부적절한 업무 분장으로 인해 성과를 내는 인원이 늘지 않고 있다는 인식은, 현재의 인적 자원 관리(HRM) 시스템에 대한 전반적인 재설계가 필요함을 시사합니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 직무별 역량 표준(Job Standard) 재정립:/\n" +
        "각 직무에서 전문가가 되기 위해 필요한 역량을 명확히 정의하고, 이를 승진 및 배치와 연동하여 보상의 객관적 근거를 마련하십시오./\n" +
        "- 채용 인터뷰 시스템 강화:/\n" +
        "우리 조직의 인재상(Value fit)을 검증할 수 있는 구조화된 면접 질문과 평가 기준을 도입하여, 시작부터 결이 맞는 인재를 선발하십시오./\n" +
        "- 업무 부하량(Workload) 및 직무 적합도 점검:/\n" +
        "현재의 업무 분장이 각자의 강점과 역량에 맞는지 전수 점검하고, 비효율적이거나 편중된 과업을 재조정하여 업무 효능감을 높이십시오.",
      S_TASK_DRV:
        "1. 조직 프로파일/\n" +
        "리더의 시각에서 우리 조직은 모든 구성원이 전사적 목적을 최우선으로 공유하며, 핵심 과제에 자원을 집중하는 '목표 지향적 실행' 상태입니다. 각자가 성과의 주인이 되어 움직이며, 리더의 피드백이 실무의 속도를 높이는 고효능 조직입니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"전사적 목적 중심의 일치된 협업과 고객 가치를 향한 끊임없는 제안이 활성화된 조직"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 우리 구성원들이 회사의 장기적 해결 과제를 명확히 인지하고 있으며, 개인의 편의보다 전체의 목적을 우선시하는 성숙한 태도를 보인다고 평가하셨습니다. 각자 자신이 창출해야 할 성과가 무엇인지 정확히 알고 스스로 관리하고 있으며, 업무 시간의 대부분이 부차적인 행정이 아닌 실질적인 가치 창출에 투입되고 있다는 확신을 보여주십니다. 특히 부서 간 이기주의 없이 원활하게 협력하며 고객을 위한 새로운 시도를 멈추지 않는다는 인식은, 리더가 보기에 우리 조직의 실행 엔진이 매우 건강하게 작동하고 있음을 의미합니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- '원 씽(One Thing)' 중심의 성과 관리 강화:/\n" +
        "1년 이상 집중해야 할 핵심 과제가 흔들리지 않도록, 분기별/월별 성과 지표를 이 과제와 더욱 정교하게 연결하여 추진력을 유지하십시오./\n" +
        "- 피드백 품질의 상향 평준화:/\n" +
        "리더의 피드백이 단순히 점검을 넘어 '성취의 도구'가 될 수 있도록, 데이터에 기반한 객관적이고 건설적인 피드백 루프를 시스템화하십시오./\n" +
        "- 부서 간 '크로스 펑셔널(Cross-Functional)' 프로젝트 활성화:/\n" +
        "현재의 원활한 협업 문화를 바탕으로, 부서 간 경계를 넘나드는 태스크포스(TF) 팀을 수시로 운영하여 고객에 대한 혁신적 제안의 빈도를 높이십시오.",
      G_TASK_DRV:
        "1. 조직 프로파일/\n" +
        "리더의 관점에서 우리 조직은 전사적 목적보다는 당장 눈앞의 긴급한 일에 에너지를 소모하며, 부서 간 협업의 단절로 인해 실행력이 저하된 '과업 분산 및 정체' 상태로 인식됩니다. 성과에 대한 개인의 주도적 관리가 필요한 상황입니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"전사적 우선순위 혼선과 피드백 부재로 인한 업무 효율성 및 고객 지향성 약화"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "현재 응답자께서는 우리 구성원들이 조직의 핵심 과제에 집중하기보다 파편화된 업무에 시간을 뺏기고 있으며, 회사 전체의 목적보다는 부서나 개인의 이익을 우선하는 경향이 있다고 평가하셨습니다. 각자가 내야 할 성과 정의가 불분명하여 업무 시간이 비본질적인 일에 소모되고 있으며, 리더의 적절한 피드백이나 부서 간의 유기적인 협조가 원활하지 않다는 인지적 위기감을 가지고 계십니다. 특히 고객에 대한 새로운 제안이나 시도가 줄어들고 있다는 인식은 조직의 성장 동력이 약화되고 있음을 경고합니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- '성과 정의(Job Description)' 재정립:/\n" +
        '구성원 개개인이 "나의 성과는 무엇인가?"라는 질문에 단 한 문장으로 답할 수 있도록 역할과 책임을 명확히 규정하고 이를 가시화하십시오./\n' +
        "- 주간, 월간 '우선순위(Priority)' 동기화:/\n" +
        "업무 시간의 80% 이상이 성과와 직결된 일에 쓰일 수 있도록, 리더가 직접 불필요한 과업을 제거(De-scoping)해주고 우선순위를 정렬해주는 미팅을 정례화하십시오./\n" +
        "- 협업 평가지표(Cooperation Index) 도입:/\n" +
        "부서 간 협력을 저해하는 요소가 무엇인지 파악하고, 타 부서의 성과를 돕는 행위가 조직 전체에서 인정받고 보상받는 문화를 설계하십시오.",
      S_VAL_PRAC:
        "1. 조직 프로파일/\n" +
        "리더의 시각에서 우리 조직은 명확한 사명과 비전을 바탕으로, 수익 창출을 넘어 사회적 가치를 실현하는 '목적 지향적(Purpose-driven)' 상태입니다. 핵심가치가 현장에서 실천되며, 조직의 존재 이유에 대한 구성원들의 자부심이 매우 높은 단계입니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"사명의 내재화를 넘어 사회적 공헌으로 기업의 존재 이유를 증명하는 가치 중심 조직"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 우리 구성원들이 회사의 사명과 비전을 깊이 이해하고 있으며, 이를 외부인에게 자신 있게 자랑할 수 있을 정도로 내재화되어 있다고 평가하셨습니다. 단순히 비전 달성을 위해 일하는 것을 넘어, 매년 꾸준한 시간과 재원을 투입하여 사회공헌 활동을 실천하는 등 '이웃 사랑'의 정신이 기업 운영의 본질에 닿아 있다는 확신을 보여주십니다. 우리 기업이 사회에 꼭 필요한 존재라는 믿음과 고객에 대한 자부심이 결합되어 있어, 리더가 보기에 우리 조직은 강력한 '가치 공동체'로서의 면모를 갖추고 있습니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 가치 실천 사례의 자산화:/\n" +
        "핵심가치를 업무 현장에서 구체적으로 실천한 '가치 챔피언' 사례를 발굴하고 공유하여, 추상적인 가치를 생생한 행동 지침으로 유지하십시오./\n" +
        "- 비전 달성 로드맵의 가시화:/\n" +
        "비전을 향한 여정이 어디쯤 와있는지 구성원들과 정기적으로 공유하여, 가치 실천이 실질적인 성과와 성취감으로 연결되게 하십시오./\n" +
        "- 전략적 사회공헌(CSV/CSR) 고도화:/\n" +
        "현재의 사회공헌 활동이 기업의 핵심 역량과 연결되어 더 큰 임팩트를 낼 수 있도록, 비즈니스 모델과 연계된 공헌 프로그램을 기획하십시오.",
      G_VAL_PRAC:
        "1. 조직 프로파일/\n" +
        "리더의 관점에서 우리 조직은 사명과 비전이 실무와 분리되어 있으며, 기업의 사회적 책임이나 존재 이유에 대한 인식이 점차 약화되고 있는 '가치 정체 및 정체성 모호' 상태로 인식됩니다. 가치 중심의 의사결정 체계 회복이 필요한 상황입니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"사명의 형식화로 인한 목적 의식 약화 및 사회적 기여 활동의 상징성 부족"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "현재 응답자께서는 조직의 핵심가치가 실제 업무 현장에서 실천되는 체감이 낮으며, 구성원들이 사명과 비전을 명확히 설명하거나 자부심을 느끼는 정도가 부족하다고 평가하셨습니다. 사회에 공헌하기 위한 자원 투입이나 활동이 비정기적이거나 형식적인 수준에 머물러 있어, '우리 기업이 왜 사회에 존재해야 하는가'에 대한 근본적인 확신이 흔들리고 있다는 인지적 위기감을 가지고 계십니다. 가치가 비전 달성을 위한 동력으로 작동하지 못하면서, 조직의 정체성이 단순히 수익을 내는 집단에 머물 위험이 있다는 진단입니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 사명, 비전 재정렬(Alignment) 워크숍:/\n" +
        "리더와 핵심 구성원이 모여 우리 기업의 존재 이유와 5년 후의 모습을 다시 정의하고, 이를 구성원들이 공감할 수 있는 언어로 재선포하십시오./\n" +
        "- 가치 기반 의사결정 원칙 수립:/\n" +
        "중요한 의사결정 순간에 \"이 결정이 우리의 핵심가치에 부합하는가?\"를 먼저 묻는 'Value Check' 단계를 공식 미팅에 도입하십시오./\n" +
        "- 작은 나눔의 제도화:/\n" +
        "거창한 활동이 아니더라도 팀 단위에서 매달 실천할 수 있는 작은 사회공헌 루틴을 만들어, 구성원들이 '좋은 일을 하는 조직'의 일원임을 체감하게 하십시오.",
      S_COMP_EDGE:
        "1. 조직 프로파일/\n" +
        "리더의 시각에서 우리 조직은 모든 실행 뒤에 반드시 성찰과 피드백이 따르는 '학습 지향적(Learning Organization)' 상태입니다. 고객의 니즈를 명확히 꿰뚫고 있으며, 이를 우리만의 차별화된 핵심 역량으로 연결해내는 강력한 경쟁력을 보유하고 있습니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"피드백의 일상화와 고객 데이터 기반의 차별적 역량으로 시장 주도권을 확보한 조직"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 우리 구성원들이 시키지 않아도 스스로 자신의 업무를 피드백하고 개선점을 찾아내는 높은 수준의 자기 주도성을 갖추고 있다고 평가하셨습니다. 모든 프로젝트 실행 후 '더 나은 방법'을 찾기 위해 치열하게 고민하는 문화가 정착되어 있으며, 정기적으로 고객의 목소리를 수집하여 업무에 반영하는 선순환 구조를 신뢰하고 계십니다. 특히 우리 조직만이 가진 대체 불가능한 '핵심 역량'이 무엇인지 명확히 인지하고 이를 강화하는 데 에너지를 집중하고 있다는 점은, 리더가 보기에 우리 조직이 지속 가능한 성장을 이룰 준비가 되었음을 의미합니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 지식 자산화 시스템(Knowledge Bank) 구축:/\n" +
        "개인과 팀의 피드백 결과물이 단순 공유에 그치지 않고, 조직 전체의 표준(Standard)으로 상향 평준화될 수 있도록 '지식 저장소'를 활성화하십시오./\n" +
        "- 고객 접점 데이터의 실시간 동기화:/\n" +
        "정기적 피드백을 넘어, 고객의 반응을 실시간으로 확인하고 즉각 업무에 반영할 수 있는 애자일(Agile)한 의사결정 체계를 더욱 정교화하십시오./\n" +
        "- 핵심 역량 집중 투자(Focus on Core):/\n" +
        "리더가 인지하는 우리만의 차별화된 역량이 경쟁사와의 격차를 더욱 벌릴 수 있도록, 해당 영역에 대한 R&D 및 인적 투자를 최우선 순위로 배정하십시오.",
      G_COMP_EDGE:
        "1. 조직 프로파일/\n" +
        "리더의 관점에서 우리 조직은 피드백 없이 실행 자체에만 급급하며, 과거의 성공 방식에 머물러 있는 '관성적 실행 및 차별성 부재' 상태로 인식됩니다. 고객의 진짜 니즈보다는 내부의 논리로 일하고 있을 가능성이 높은 상황입니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"사후 피드백 부재로 인한 학습 정체 및 고객 중심의 차별적 경쟁력 약화"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "현재 응답자께서는 우리 조직이 '일단 하고 보는' 식의 실행은 있으나, 실행 후 무엇을 배웠고 무엇을 개선해야 할지에 대한 사후 피드백이 매우 부족하다고 평가하셨습니다. 고객의 니즈를 체계적으로 파악하기보다 짐작으로 일하는 경향이 있으며, 이로 인해 우리만의 독보적인 핵심 역량이 무엇인지 모호해지고 있다는 위기감을 느끼고 계십니다. 더 나은 방법을 찾으려는 시도보다는 주어진 과업을 쳐내는 데 급급해지면서, 시장에서 우리 조직만의 차별화된 색깔이 흐릿해지고 있다는 것이 리더의 냉정한 진단입니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- '피드백 의무화' 프로세스 도입:/\n" +
        "모든 프로젝트나 주요 과업 종료 후 반드시 '성과-원인-개선점'을 기록하는 간단한 피드백 양식(예: 가인지 AAR) 작성을 공식 업무 루틴으로 삽입하십시오./\n" +
        "- 고객 피드백 채널의 다각화:/\n" +
        "내부 회의실에서 벗어나 리더와 실무자가 직접 고객을 만나거나 현장의 목소리를 청취하는 '고객의 날'을 운영하여 시장의 감각을 회복하십시오./\n" +
        "- 핵심 역량(Core Competency) 재정의:/\n" +
        "우리 조직이 가장 잘하는 것, 그리고 고객이 우리를 선택하는 단 하나의 이유를 다시 정의하고, 비본질적인 업무를 걷어내어 핵심 역량에 에너지를 집중하십시오.",
      S_LEAD_TRUST:
        "1. 조직 프로파일/\n" +
        "리더의 시각에서 우리 조직은 구성원들이 의사결정 과정에 능동적으로 참여하며, 리더의 판단과 헌신에 대해 깊은 신뢰를 보내는 '상호 신뢰형 리더십' 상태입니다. 방향 설정(비전)과 실질적인 문제 해결이 균형 있게 이뤄지고 있습니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"참여적 의사결정과 리더의 헌신을 바탕으로 조직의 비전이 강력한 추진력을 얻는 단계"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 주요 의사결정 시 실무자들의 의견을 충분히 반영하고 있으며, 구성원들 역시 회사의 결정 방향을 명확히 이해하고 지지한다고 평가하셨습니다. 리더가 솔선수범하여 조직에 헌신하고 상시 비전과 사명을 공유하는 모습이 구성원들에게 존경과 신뢰의 근거가 되고 있다는 확신을 보여주십니다. 특히 결정이 필요한 순간에 적시에 의사결정이 이뤄지고, 이것이 현장의 실질적인 문제 해결로 이어지고 있다는 인식은 리더십이 조직의 병목이 아닌 '해결사' 역할을 하고 있음을 의미합니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 의사결정 맥락(Context) 공유의 제도화:/\n" +
        "결정된 사항뿐만 아니라 '왜(Why)' 이런 결정을 내렸는지 배경을 투명하게 공유하는 자리를 정기적으로 가져 리더십에 대한 신뢰를 공고히 하십시오./\n" +
        "- 차세대 리더를 위한 권한 위임(Delegation) 확대:/\n" +
        "현재의 높은 신뢰를 바탕으로 실무자의 의사결정 참여 범위를 넓혀, 리더의 헌신이 조직 전체의 '책임감'으로 전이되도록 설계하십시오./\n" +
        "- 비전 리마인드 루틴 유지:/\n" +
        "리더가 말하는 비전이 구성원의 일상이 되도록 월간 타운홀 미팅이나 메시지 발송 등을 통해 조직의 존재 이유를 끊임없이 환기하십시오.",
      G_LEAD_TRUST:
        "1. 조직 프로파일/\n" +
        "리더의 관점에서 우리 조직은 의사결정이 리더에게 편중되어 있으며, 결정의 배경이 현장에 충분히 전달되지 않아 구성원들의 신뢰가 정체된 '일방향적 리더십' 상태로 인식됩니다. 문제 해결의 속도가 현장의 기대를 따라가지 못하는 상황입니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"의사결정의 폐쇄성 및 적시성 부족으로 인한 리더십 신뢰도 및 조직 응집력 저하"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "현재 응답자께서는 주요 의사결정 과정에서 실무자들의 참여가 제한적이며, 이로 인해 구성원들이 리더의 결정을 수동적으로 받아들이거나 불확실함을 느낀다고 평가하셨습니다. 리더가 조직의 비전과 사명을 충분히 강조하지 못하거나, 헌신하는 모습이 구성원들에게 온전히 전달되지 않아 리더십의 권위와 존경심이 예전 같지 않다는 인지적 위기감을 가지고 계십니다. 특히 의사결정이 지연되거나 현장의 고질적인 문제들이 제때 해결되지 않으면서, 리더십이 조직의 성장을 가로막는 요소로 비춰질 위험이 있다는 진단입니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 의사결정 프로세스의 투명성 강화:/\n" +
        "결정 과정에 실무진의 의견을 청취하는 '사전 협의' 단계를 공식화하고, 결정 사항을 전파할 때 리더의 진심과 고민의 과정을 솔직하게 공유하십시오./\n" +
        "- '적시 결정'을 위한 보고 체계 간소화:/\n" +
        "의사결정의 속도를 높이기 위해 불필요한 보고 단계를 줄이고, 현장에서 바로 해결 가능한 문제는 과감히 권한을 하부로 이양하십시오./\n" +
        "- 비전-실행 연결 고리 재구축:/\n" +
        "리더의 사명 선포가 구호에 그치지 않도록, 리더가 직접 현장의 문제를 해결하는 '현장 중심 경영'의 빈도를 높여 헌신하는 리더의 이미지를 회복하십시오.",
      S_HR_DEV:
        "1. 조직 프로파일/\n" +
        "리더의 시각에서 우리 조직은 구성원 개개인의 성장 경로가 명확하며, 서로의 지식을 나누는 것이 문화로 정착된 '동반 성장형 학습 공동체' 상태입니다. 교육이 현장의 성과로 직결되며, 팀워크와 개인 역량이 동시에 상향 평준화되고 있습니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"체계적인 성장 지원과 지식 공유 문화를 통해 개인의 경험을 조직의 자산으로 전환하는 조직"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "응답자께서는 우리 구성원들이 업무 역량의 향상을 체감하고 있으며, 리더가 각자의 강약점을 파악하여 그에 맞는 도전적인 과업을 적절히 부여하고 있다고 평가하셨습니다. 특히 필요한 교육이 적시에 이뤄질 뿐만 아니라, 그 결과가 실제 성과 창출에 기여하고 있다는 확신을 보여주십니다. 새로운 시도와 결과를 공유하는 장이 활성화되어 있고, 서로 묻고 답하는 과정이 자연스럽게 흐르고 있어, 리더가 보기에 우리 조직은 개인이 얻은 '작은 지식'이 전체의 '큰 실력'으로 빠르게 확산되는 고효능 학습 구조를 갖추고 있습니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- 지식 페스티벌(Knowledge Festival) 정례화:/\n" +
        "새로운 시도와 성공/실패 경험을 전사가 함께 축하하고 배우는 공유의 장을 브랜드화하여, 지식 공유를 조직의 핵심 의례로 만드십시오./\n" +
        "- 강점 기반의 '사내 멘토링' 시스템 구축:/\n" +
        "리더가 파악한 구성원의 강점이 동료들에게 전수될 수 있도록, 특정 분야의 강점 보유자가 타인을 코칭하는 구조를 만들어 팀워크와 역량을 동시에 높이십시오./\n" +
        "- 성장 로드맵의 '디지털 자산화':/\n" +
        "구성원의 성장 경로와 이수 교육, 획득한 지식을 데이터로 관리하여 개인의 성장이 가시적으로 보이게 하고 이를 인사 평가지표와 연계하십시오.",
      G_HR_DEV:
        "1. 조직 프로파일/\n" +
        "리더의 관점에서 우리 조직은 구성원의 성장을 돕는 체계적인 로드맵이 부족하며, 개인의 경험과 지식이 동료에게 흐르지 못하고 단절된 '개별 학습 및 지식 고립' 상태로 인식됩니다. 교육의 실효성을 높이고 공유 문화를 재건해야 하는 상황입니다./\n" +
        "/\n" +
        "2. 핵심 진단 결과/\n" +
        '"성장 가이드 부재 및 지식 공유 채널 단절로 인한 조직적 역량 향상 정체"/\n' +
        "/\n" +
        "3. 상세 진단 분석/\n" +
        "현재 응답자께서는 구성원들을 위한 명확한 성장 로드맵이 부재하거나, 제공되는 교육이 실제 성과로 연결되는 체감이 낮다고 평가하셨습니다. 리더가 구성원의 강약점을 세밀하게 파악하여 도전적 기회를 주는 매니지먼트가 부족하며, 개인이 얻은 귀중한 경험이나 시도들이 팀 전체로 공유되지 못하고 각자의 머릿속에 머물러 있다는 인지적 위기감을 느끼고 계십니다. 모르는 것을 서로 묻고 답하는 것이 어색하거나 지식 공유의 장이 형식화되어 있어, 조직 전체의 실력이 상향 평준화되지 못하고 있다는 것이 리더의 판단입니다./\n" +
        "/\n" +
        "4. 실행 제안/\n" +
        "- '1인 1지식' 공유 캠페인 도입:/\n" +
        "거창한 교육이 아니더라도 자신이 발견한 업무 팁을 주간 회의나 메신저 등을 통해 짧게 공유하는 문화를 만들어 공유의 심리적 문턱을 낮추십시오./\n" +
        "- 직무별 필수 교육 과정(Curriculum) 설계:/\n" +
        "현업 성과와 직결되는 핵심 스킬을 정의하고, 이를 습득할 수 있는 실무 중심의 교육 과정을 리더가 직접 설계하여 교육의 현장 적용도를 높이십시오./\n" +
        "- '질문하는 문화'의 리더 선도:/\n" +
        "리더가 먼저 동료나 부하 직원에게 업무적 도움을 구하거나 질문을 던짐으로써, '서로 묻고 답하는 것'이 무능함이 아닌 '성장을 위한 협력'임을 몸소 보여주십시오.",
    },
  };

  function normalizeNarrativeText(text) {
    return String(text || "")
      .replace(/\/\/+/g, "\n")
      .replace(/\/+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function renderNarrativeHtml(text) {
    var lines = String(text || "").split("\n");
    var html = [];
    var hasOutput = false;
    var currentSectionNo = null;
    lines.forEach(function (line) {
      var s = String(line || "");
      var t = s.trim();
      if (!t) {
        return;
      }
      var sectionMatch = t.match(/^(\d+)\.\s+/);
      if (sectionMatch) {
        currentSectionNo = Number(sectionMatch[1]);
        if (hasOutput) html.push("<br />");
        html.push(
          '<strong class="diagnosis-result-subheading">' +
            escapeHtml(t) +
            "</strong><br />"
        );
        hasOutput = true;
        return;
      }
      if (/^-\s+/.test(t)) {
        html.push(
          '<strong class="diagnosis-result-subtopic">' +
            escapeHtml(t) +
            "</strong><br />"
        );
        hasOutput = true;
        return;
      }
      // 2번 소주제의 따옴표 문구는 서명처럼 가운데/브랜드 컬러로 표시
      var quoteLine = t.replace(/\/+$/, "").trim();
      var isSignatureLine =
        currentSectionNo === 2 &&
        /^["'“‘「].+["'”’」]$/.test(quoteLine);
      if (isSignatureLine) {
        html.push(
          '<span class="diagnosis-result-signature-wrap"><span class="diagnosis-result-signature">' +
            escapeHtml(quoteLine) +
            "</span></span>"
        );
        hasOutput = true;
        return;
      }

      // 1,3,4 소주제의 설명 본문에만 들여쓰기 적용
      var isBodyCopy = currentSectionNo === 1 || currentSectionNo === 3 || currentSectionNo === 4;
      if (isBodyCopy) {
        html.push(
          '<span class="diagnosis-result-body-copy">' +
            escapeHtml(s) +
            "</span><br />"
        );
      } else {
        html.push(escapeHtml(s) + "<br />");
      }
      hasOutput = true;
    });
    return html.join("");
  }

  function getResultNarrative(data, typeKey, label) {
    var diagnosisMap = RESULT_TEXT_BY_TYPE_ID[data && data.diagnosisId] || {};
    var direct = diagnosisMap[data && data.typeId];
    var template = direct;
    if (!template) {
      var map = RESULT_TEXT_MAP[data && data.diagnosisId] || RESULT_TEXT_MAP.default;
      template = (map && map[typeKey]) || RESULT_TEXT_MAP.default[typeKey];
    }
    return normalizeNarrativeText(
      String(template || "").replace(/\{label\}/g, String(label || ""))
    );
  }

  function renderResultCard(typeKey, data) {
    var title =
      typeKey === "strength"
        ? "잘 하고 있는 영역 (STRENGTH)"
        : "보완하면 좋은 영역 (GROWTH)";
    if (!data) {
      return (
        '<section class="diagnosis-result-card">' +
        '<h3 class="diagnosis-result-card-title">' +
        escapeHtml(title) +
        "</h3>" +
        '<p class="diagnosis-result-card-label">-</p>' +
        '<p class="diagnosis-result-card-score">해당 주제 점수: -</p>' +
        '<div class="diagnosis-result-text-block">' +
        '<p class="diagnosis-result-text">선택된 항목이 없습니다.</p>' +
        "</div>" +
        "</section>"
      );
    }
    var displayLabel = formatResultCardLabel(data.label);
    var narrative = getResultNarrative(data, typeKey, displayLabel);
    var scoreText =
      typeof data.roundedScore === "number" && Number.isFinite(data.roundedScore)
        ? data.roundedScore.toFixed(1)
        : "-";
    return (
      '<section class="diagnosis-result-card">' +
      '<h3 class="diagnosis-result-card-title">' +
      escapeHtml(title) +
      "</h3>" +
      '<p class="diagnosis-result-card-label">' +
      escapeHtml(displayLabel) +
      "</p>" +
      '<p class="diagnosis-result-card-score">해당 주제 점수: ' +
      escapeHtml(String(scoreText)) +
      "</p>" +
      '<div class="diagnosis-result-text-block">' +
      '<p class="diagnosis-result-text">' +
      renderNarrativeHtml(narrative) +
      "</p>" +
      "</div>" +
      "</section>"
    );
  }

  function buildPreviewResult() {
    var rule = getRuleByTypeId(state.previewTypeId);
    if (!rule) {
      return { strength: null, growth: null };
    }
    var data = {
      diagnosisId: rule.diagnosisId,
      typeId: rule.typeId,
      label: rule.typeLabel,
      targetSectionId: rule.targetSectionId,
      roundedScore: null,
      imageSrc: "",
      imageFileName: "",
      altText: rule.typeLabel,
      typeGroup: rule.typeGroup,
    };
    if (rule.typeGroup === "STRENGTH") {
      return { strength: data, growth: null };
    }
    return { strength: null, growth: data };
  }

  /** 결과 전용 화면(결과 단계): 문항 UI 없이 결과 블록만 표시 */
  function renderResultScreen() {
    var introPanel = root.querySelector("#diagnosis-intro-panel");
    var questionsHost = root.querySelector("#diagnosis-questions-root");
    if (!questionsHost) return;
    if (introPanel) introPanel.hidden = true;
    questionsHost.hidden = false;

    var result = state.previewMode ? buildPreviewResult() : computeResult();
    if (!result) {
      state.resultViewActive = false;
      render();
      return;
    }

    questionsHost.innerHTML =
      '<section class="diagnosis-result-screen" aria-label="진단 결과">' +
      getPreviewPanelHtml() +
      '<section class="diagnosis-result-block">' +
      '<h2 class="diagnosis-result-heading">진단 결과</h2>' +
      renderResultCard("strength", result.strength) +
      renderResultCard("growth", result.growth) +
      "</section>" +
      '<div class="diagnosis-result-screen-actions">' +
      '<a class="diagnosis-result-consult-btn" href="story-inquiry-popup.html">컨설팅 문의하기</a>' +
      "</div>" +
      "</section>";

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function render() {
    try {
    if (!state.hasStarted) {
      renderIntro();
      return;
    }

    document.body.classList.toggle("diagnosis-result-phase", state.resultViewActive);

    if (state.resultViewActive && state.dataReady) {
      renderResultScreen();
      return;
    }

    if (!state.dataReady) {
      var introWait = root.querySelector("#diagnosis-intro-panel");
      var hostWait = root.querySelector("#diagnosis-questions-root");
      if (introWait) introWait.hidden = true;
      if (hostWait) {
        hostWait.hidden = false;
        hostWait.innerHTML =
          '<p class="diagnosis-loading-msg">진단 데이터를 불러오는 중입니다.</p>';
      }
      if (state.scrollQuestionsTop) {
        state.scrollQuestionsTop = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    var totalPages = Math.max(1, Math.ceil(state.items.length / PAGE_SIZE));
    if (state.currentPage > totalPages - 1) state.currentPage = totalPages - 1;
    if (state.currentPage < 0) state.currentPage = 0;
    var isLastPage = state.currentPage >= totalPages - 1;
    var pageItems = getPageItems();
    var pageComplete = isCurrentPageComplete(pageItems);
    var unansweredCount = getUnansweredCount();
    var canShowResult = unansweredCount === 0;
    var showPageNavHint = !isLastPage && !pageComplete;

    var pageStart = state.currentPage * PAGE_SIZE + 1;
    var pageEnd = Math.min((state.currentPage + 1) * PAGE_SIZE, state.items.length);

    var itemsHtml = pageItems
      .map(function (item) {
        var min = toNumber(item.scaleMin, 1);
        var max = toNumber(item.scaleMax, 5);
        var radios = [];
        for (var s = min; s <= max; s += 1) {
          var checked = String(state.answers[item.itemId]) === String(s);
          radios.push(
            '<label class="diagnosis-option">' +
              '<input type="radio" name="' +
              escapeHtml(item.itemId) +
              '" value="' +
              String(s) +
              '"' +
              (checked ? " checked" : "") +
              " />" +
              '<span class="diagnosis-option-label">' +
              String(s) +
              "</span>" +
              "</label>"
          );
        }
        var answered = state.answers[item.itemId] != null;
        return (
          '<article class="diagnosis-question-card' +
          (answered ? " diagnosis-question-card--answered" : "") +
          '">' +
          '<p class="diagnosis-question-text">' +
          escapeHtml(item.itemText) +
          "</p>" +
          '<div class="diagnosis-option-row" data-item-id="' +
          escapeHtml(item.itemId) +
          '">' +
          radios.join("") +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    var introPanel = root.querySelector("#diagnosis-intro-panel");
    var questionsHost = root.querySelector("#diagnosis-questions-root");
    if (!questionsHost) {
      return;
    }
    if (introPanel) {
      introPanel.hidden = true;
    }
    questionsHost.hidden = false;

    questionsHost.innerHTML =
      '<section class="diagnosis-ui">' +
      '<header class="diagnosis-ui-header">' +
      '<p class="diagnosis-ui-progress">' +
      "문항 " +
      pageStart +
      " - " +
      pageEnd +
      " / " +
      state.items.length +
      "</p>" +
      '<p class="diagnosis-ui-page">페이지 ' +
      (state.currentPage + 1) +
      " / " +
      totalPages +
      "</p>" +
      "</header>" +
      '<div class="diagnosis-question-list">' +
      itemsHtml +
      "</div>" +
      '<div class="diagnosis-ui-after-questions">' +
      '<p class="diagnosis-validation-msg" ' +
      (!showPageNavHint ? 'hidden="hidden"' : "") +
      ">" +
      escapeHtml(PAGE_NAV_HINT) +
      "</p>" +
      '<div class="diagnosis-ui-actions">' +
      '<button type="button" class="diagnosis-nav-btn diagnosis-nav-btn--prev" data-action="prev" ' +
      (state.currentPage === 0 ? "disabled" : "") +
      ">이전</button>" +
      (isLastPage
        ? ""
        : '<button type="button" class="diagnosis-nav-btn diagnosis-nav-btn--next" data-action="next" ' +
          (!pageComplete ? "disabled" : "") +
          ">다음</button>") +
      (isLastPage
        ? '<button type="button" class="diagnosis-result-btn" data-action="result" ' +
          (canShowResult ? "" : "disabled") +
          ">결과보기</button>"
        : "") +
      "</div>" +
      "</div>" +
      "</section>";

    if (state.scrollQuestionsTop) {
      state.scrollQuestionsTop = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    var optionRows = questionsHost.querySelectorAll(".diagnosis-option-row");
    optionRows.forEach(function (row) {
      row.addEventListener("change", function (e) {
        var target = e.target;
        if (!target || target.tagName !== "INPUT") return;
        var itemId = row.getAttribute("data-item-id");
        state.answers[itemId] = toNumber(target.value, null);
        render();
      });
    });

    var prevBtn = questionsHost.querySelector('[data-action="prev"]');
    var nextBtn = questionsHost.querySelector('[data-action="next"]');
    var resultBtn = questionsHost.querySelector('[data-action="result"]');
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        state.currentPage -= 1;
        render();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        if (nextBtn.disabled) return;
        state.currentPage += 1;
        render();
      });
    }
    if (resultBtn) {
      resultBtn.addEventListener("click", function () {
        if (getUnansweredCount() > 0) return;
        if (!computeResult()) return;
        state.resultViewActive = true;
        render();
      });
    }
    } finally {
      if (state.dataReady) {
        persistState();
      }
    }
  }

  function normalizeRows(rows) {
    return rows.map(function (r) {
      var out = {};
      Object.keys(r).forEach(function (k) {
        var key = String(k || "").trim();
        if (!key) return;
        out[key] = String(r[k] == null ? "" : r[k]).trim();
      });
      return out;
    });
  }

  Promise.all([
    loadCsvText(CSV_PATHS.items[diagnosisId]),
    loadCsvText(CSV_PATHS.sectionScoring[diagnosisId]),
    loadCsvText(CSV_PATHS.typeRules[diagnosisId]),
    loadCsvText(CSV_PATHS.typeAssets),
    diagnosisId === "dynamism" && CSV_PATHS.sectionMap.dynamism
      ? loadCsvText(CSV_PATHS.sectionMap.dynamism)
      : Promise.resolve(""),
  ])
    .then(function (texts) {
      state.items = normalizeRows(parseCsv(texts[0])).map(function (r) {
        return {
          diagnosisId: r.diagnosisId,
          sectionId: r.sectionId,
          sectionTitle: r.sectionTitle,
          itemId: r.itemId,
          itemText: r.itemText,
          scaleMin: toNumber(r.scaleMin, 1),
          scaleMax: toNumber(r.scaleMax, 5),
        };
      });
      state.sectionScoringRows = normalizeRows(parseCsv(texts[1])).filter(function (r) {
        return r.diagnosisId === diagnosisId;
      });
      state.typeRulesRows = normalizeRows(parseCsv(texts[2])).filter(function (r) {
        return r.diagnosisId === diagnosisId;
      });
      state.typeAssetRows = normalizeRows(parseCsv(texts[3]));
      state.sectionMapRows = normalizeRows(parseCsv(texts[4] || "")).filter(function (r) {
        return r.diagnosisId === diagnosisId;
      });
      state.dataReady = true;
      loadSessionState();
      render();
    })
    .catch(function (err) {
      root.innerHTML =
        '<div class="diagnosis-load-error-wrap">' +
        '<p class="diagnosis-load-error">진단 데이터를 불러오지 못했습니다.</p>' +
        '<p class="diagnosis-load-error-detail">' +
        escapeHtml(err && err.message ? err.message : "") +
        "</p>" +
        "</div>";
      console.error(err);
    });

  render();
})();
