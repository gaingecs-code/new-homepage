import { useEffect, useMemo, useRef, useState } from "react";
import { defaultEducationProgramsData } from "../data/defaultEducationPrograms";
import { downloadJson, loadLocalDraft, nowIso, readJsonFile, saveLocalDraft } from "../lib/localJsonDraft";

const STORAGE_KEY = "admin.local.education-programs.v1";
const PUBLISHED_STORAGE_KEY = "admin.published.education-programs.v1";

/** 왼쪽 목록 섹션 순서 (데이터 `group` 값과 일치) */
const EDUCATION_PROGRAM_GROUPS = ["자격증 과정", "직급별 교육", "직무별 교육"];

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function groupItemsBySection(items) {
  const by = {};
  EDUCATION_PROGRAM_GROUPS.forEach((g) => {
    by[g] = [];
  });
  const other = [];
  (items || []).forEach((item) => {
    const g = item.group;
    if (EDUCATION_PROGRAM_GROUPS.includes(g)) {
      by[g].push({ item });
    } else {
      other.push({ item });
    }
  });
  return { by, other };
}

export default function EducationIntroPage() {
  const [data, setData] = useState(() => loadLocalDraft(STORAGE_KEY, defaultEducationProgramsData));
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState(() => defaultEducationProgramsData.items?.[0]?.id ?? null);
  const [showSavedBadge, setShowSavedBadge] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const thumbInputRef = useRef(null);
  const saveFeedbackTimerRef = useRef(null);

  const items = useMemo(() => data.items || [], [data.items]);

  const selectedIndex = useMemo(() => items.findIndex((x) => x.id === selectedId), [items, selectedId]);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  const grouped = useMemo(() => groupItemsBySection(items), [items]);

  useEffect(
    () => () => {
      if (saveFeedbackTimerRef.current) {
        clearTimeout(saveFeedbackTimerRef.current);
        saveFeedbackTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!showPreview) return undefined;
    const previousOverflow = document.body.style.overflow;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowPreview(false);
      }
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showPreview]);

  function updateItem(index, key, value) {
    setData((prev) => {
      const next = { ...prev, items: [...prev.items], updatedAt: nowIso() };
      next.items[index] = { ...next.items[index], [key]: value, updatedAt: nowIso() };
      return next;
    });
  }

  function updateTargets(index, value) {
    const lines = value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    updateItem(index, "targets", lines);
  }

  function normalizeHashtags(list) {
    const src = Array.isArray(list) ? list : [];
    return [0, 1, 2].map((i) => (typeof src[i] === "string" ? src[i] : ""));
  }

  function updateHashtag(index, tagIndex, value) {
    const next = normalizeHashtags(items[index]?.hashtags);
    next[tagIndex] = value;
    updateItem(index, "hashtags", next);
  }

  async function onThumbnailFile(e) {
    const file = e.target.files?.[0];
    if (!file || selectedIndex < 0) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      updateItem(selectedIndex, "imageUrl", dataUrl);
      setMessage("썸네일을 이미지 파일로 반영했습니다. JSON 용량이 커질 수 있습니다.");
    } catch (err) {
      setMessage(String(err.message || err));
    } finally {
      e.target.value = "";
    }
  }

  function addProgram() {
    const id = `program-${Date.now()}`;
    setData((prev) => ({
      ...prev,
      items: [
        {
          id,
          group: EDUCATION_PROGRAM_GROUPS[0],
          title: "새 프로그램",
          imageUrl: "",
          hashtags: ["", "", ""],
          overview: "",
          targets: [],
          schedule: "",
          link: "",
          ended: false,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
        ...(prev.items || []),
      ],
      updatedAt: nowIso(),
    }));
    setSelectedId(id);
    setMessage("새 프로그램을 추가했습니다. 오른쪽에서 내용을 입력해 주세요.");
  }

  function deleteProgram(id) {
    const target = items.find((x) => x.id === id);
    if (!target) return;
    const label = target.title?.trim() || target.id;
    if (!window.confirm(`「${label}」 프로그램을 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`)) return;

    const remaining = items.filter((x) => x.id !== id);
    setData((prev) => ({
      ...prev,
      items: remaining,
      updatedAt: nowIso(),
    }));
    setSelectedId((cur) => {
      if (cur !== id) return cur;
      return remaining[0]?.id ?? null;
    });
    setMessage("프로그램을 삭제했습니다.");
  }

  function saveDraft() {
    saveLocalDraft(STORAGE_KEY, data);
    saveLocalDraft(PUBLISHED_STORAGE_KEY, data);
    setMessage("웹 저장하기: 기업교육 프로그램 변경사항을 즉시 반영용으로 저장했습니다.");
    setShowSavedBadge(true);
    if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current);
    saveFeedbackTimerRef.current = setTimeout(() => {
      setShowSavedBadge(false);
      saveFeedbackTimerRef.current = null;
    }, 1800);
  }

  function exportJson() {
    downloadJson("corporate-education-programs.json", data);
    setMessage("JSON 파일을 내보냈습니다. 웹의 data/corporate-education-programs.json 으로 덮어씌우면 종료 오버레이(items[].ended)까지 함께 반영됩니다.");
  }

  async function importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const next = await readJsonFile(file);
      setData(next);
      const first = next.items?.[0]?.id;
      setSelectedId(first ?? null);
      setMessage("JSON을 불러왔습니다.");
    } catch (err) {
      setMessage(`불러오기 실패: ${err.message || String(err)}`);
    } finally {
      e.target.value = "";
    }
  }

  function resetDefault() {
    setData(defaultEducationProgramsData);
    setSelectedId(defaultEducationProgramsData.items?.[0]?.id ?? null);
    setMessage("기본값으로 되돌렸습니다.");
  }

  function openPreviewArea() {
    setShowPreview(true);
  }

  function resolvePreviewImageUrl(rawUrl) {
    const src = String(rawUrl || "").trim();
    if (!src) return "";
    if (/^(data:|blob:|https?:|\/)/i.test(src)) return src;
    return `/${src.replace(/^\.?\//, "")}`;
  }

  return (
    <section className="page">
      <h2 className="page-title">기업교육 프로그램</h2>
      <div className="panel">
        <p className="muted">
          `corporate-education` 교육 소개 카드 기준입니다. 왼쪽에서 프로그램을 선택하면 오른쪽에서 수정합니다. 썸네일은 파일 업로드 시 JSON에 포함되므로 용량을 확인해 주세요. 종료 오버레이는 JSON 내보내기 파일의{" "}
          items[].ended를 웹 서버의 data/corporate-education-programs.json으로 반영하면 공개 페이지에도 적용됩니다.
        </p>
        <div className="admin-actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <button className="btn btn-primary" type="button" onClick={saveDraft}>
              웹 저장하기
            </button>
            {showSavedBadge ? (
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: "calc(100% + 0.3rem)",
                  transform: "translateX(-50%)",
                  background: "#047857",
                  color: "#ffffff",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  lineHeight: 1,
                  padding: "0.22rem 0.42rem",
                  borderRadius: "999px",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                }}
              >
                반영됨
              </span>
            ) : null}
          </div>
          <button className="btn btn-outline" type="button" onClick={resetDefault}>
            기본값 복원
          </button>
          <button className="btn btn-primary" type="button" onClick={addProgram}>
            + 프로그램 추가
          </button>
          <button
            className="btn btn-outline education-intro-delete-btn"
            type="button"
            disabled={!selectedId}
            title={!selectedId ? "삭제하려면 왼쪽 목록에서 프로그램을 선택하세요" : undefined}
            onClick={() => selectedId && deleteProgram(selectedId)}
          >
            프로그램 삭제
          </button>
          <button
            className="btn btn-outline"
            type="button"
            disabled={!selected}
            title={!selected ? "미리보기하려면 프로그램을 선택하세요" : undefined}
            onClick={openPreviewArea}
          >
            미리보기
          </button>
        </div>
        {message && <p className="muted">{message}</p>}

        <div className="education-intro-split">
          <aside className="panel education-intro-list-panel">
            <p className="card-label" style={{ marginTop: 0 }}>
              프로그램 목록
            </p>
            {EDUCATION_PROGRAM_GROUPS.map((groupName) => (
              <div key={groupName} className="education-intro-section">
                <p className="education-intro-section-title">{groupName}</p>
                <table className="education-intro-table">
                  <thead>
                    <tr>
                      <th scope="col">프로그램명</th>
                      <th scope="col" className="education-intro-table-status">
                        종료 여부
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(grouped.by[groupName] || []).length === 0 ? (
                      <tr>
                        <td colSpan={2} className="education-intro-table-empty">
                          없음
                        </td>
                      </tr>
                    ) : (
                      grouped.by[groupName].map(({ item }) => (
                        <tr
                          key={item.id}
                          className={selectedId === item.id ? "is-selected" : ""}
                          onClick={() => setSelectedId(item.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId(item.id);
                            }
                          }}
                        >
                          <td>{item.title || "(제목 없음)"}</td>
                          <td className="education-intro-table-status">
                            {item.ended ? (
                              <span className="education-status-ended">[운영 종료]</span>
                            ) : (
                              <span className="education-status-live">[운영 중]</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ))}

            {grouped.other.length > 0 ? (
              <div className="education-intro-section">
                <p className="education-intro-section-title">기타 (group 값 확인 필요)</p>
                <table className="education-intro-table">
                  <thead>
                    <tr>
                      <th scope="col">프로그램명</th>
                      <th scope="col" className="education-intro-table-status">
                        종료 여부
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.other.map(({ item }) => (
                      <tr
                        key={item.id}
                        className={selectedId === item.id ? "is-selected" : ""}
                        onClick={() => setSelectedId(item.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(item.id);
                          }
                        }}
                      >
                        <td>
                          {item.title || "(제목 없음)"}
                          <span className="muted" style={{ display: "block", fontSize: "0.72rem", marginTop: "0.2rem" }}>
                            group: {item.group || "—"}
                          </span>
                        </td>
                        <td className="education-intro-table-status">
                          {item.ended ? <span className="education-status-ended">[운영 종료]</span> : <span className="education-status-live">[운영 중]</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </aside>

          <div className="panel education-intro-editor-panel">
            {!selected ? (
              <p className="muted">왼쪽 목록에서 프로그램을 선택하거나 「프로그램 추가」를 눌러 주세요.</p>
            ) : (
              <>
                <p className="card-label">
                  편집: {selected.title || "새 프로그램"} <span className="muted">({selected.id})</span>
                </p>

                <fieldset className="education-intro-group-fieldset">
                  <legend className="education-intro-group-legend">섹션(그룹)</legend>
                  <div className="education-intro-radio-grid">
                    {EDUCATION_PROGRAM_GROUPS.map((g) => (
                      <label key={g} className="education-intro-radio-label">
                        <input
                          type="radio"
                          name={`group-${selected.id}`}
                          checked={selected.group === g}
                          onChange={() => updateItem(selectedIndex, "group", g)}
                        />
                        <span>{g}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="field">
                  <span>카드 제목</span>
                  <input className="input" value={selected.title || ""} onChange={(e) => updateItem(selectedIndex, "title", e.target.value)} />
                </label>

                <div className="field">
                  <span>썸네일 이미지</span>
                  <div className="education-intro-thumb-row">
                    <button className="btn btn-outline" type="button" onClick={() => thumbInputRef.current?.click()}>
                      이미지 파일 업로드
                    </button>
                    <input ref={thumbInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onThumbnailFile} />
                    {selected.imageUrl && String(selected.imageUrl).startsWith("data:") ? (
                      <button className="btn btn-outline" type="button" onClick={() => updateItem(selectedIndex, "imageUrl", "")}>
                        업로드 이미지 제거
                      </button>
                    ) : null}
                    <label className="education-intro-thumb-url">
                      <span className="muted education-intro-thumb-url-label">이미지 URL (파일 대신 경로만 쓸 때)</span>
                      <input
                        className="input"
                        value={String(selected.imageUrl || "").startsWith("data:") ? "" : selected.imageUrl || ""}
                        onChange={(e) => updateItem(selectedIndex, "imageUrl", e.target.value)}
                        placeholder="https://... 또는 assets/..."
                      />
                    </label>
                  </div>
                  {selected.imageUrl ? (
                    <div style={{ marginTop: "0.5rem" }}>
                      <img src={selected.imageUrl} alt="" className="education-intro-thumb-preview" />
                    </div>
                  ) : null}
                </div>

                <div className="field">
                  <span>해시태그 (3개)</span>
                  <div className="education-intro-hashtag-grid">
                    {normalizeHashtags(selected.hashtags).map((tag, i) => (
                      <input
                        key={`hashtag-${selected.id}-${i}`}
                        className="input"
                        value={tag}
                        onChange={(e) => updateHashtag(selectedIndex, i, e.target.value)}
                        placeholder={`#해시태그 ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <label className="field">
                  <span>프로그램 슬로건</span>
                  <textarea className="input" rows={3} value={selected.overview || ""} onChange={(e) => updateItem(selectedIndex, "overview", e.target.value)} />
                </label>
                <label className="field">
                  <span>타겟 고객 (3줄로 작성)</span>
                  <textarea
                    className="input"
                    rows={4}
                    value={(selected.targets || []).join("\n")}
                    onChange={(e) => updateTargets(selectedIndex, e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>운영 회차 및 운영 시간</span>
                  <input className="input" value={selected.schedule || ""} onChange={(e) => updateItem(selectedIndex, "schedule", e.target.value)} />
                </label>
                <label className="field">
                  <span>링크 URL</span>
                  <input className="input" value={selected.link || ""} onChange={(e) => updateItem(selectedIndex, "link", e.target.value)} />
                </label>
                <label className="field" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={!!selected.ended} onChange={(e) => updateItem(selectedIndex, "ended", e.target.checked)} />
                  <span>
                    종료 오버레이 표시 (목록 「운영 종료」·공개 페이지는 JSON 내보내기 파일의 items[].ended 배포로 반영됩니다)
                  </span>
                </label>
              </>
            )}
          </div>
        </div>
      </div>
      {showPreview && selected ? (
        <div
          className="education-intro-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label="프로그램 미리보기"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPreview(false);
          }}
        >
          <div className="education-intro-preview-modal-panel">
            <div className="education-intro-preview-modal-head">
              <strong>프로그램 미리보기</strong>
              <button type="button" className="btn btn-outline" onClick={() => setShowPreview(false)}>
                닫기
              </button>
            </div>
            <p className="muted" style={{ marginTop: "0.15rem", marginBottom: "0.55rem", fontSize: "0.82rem" }}>
              공개 페이지 카드와 동일한 비율로 표시됩니다. 카드에 마우스를 올리면 호버 내용을 확인할 수 있습니다.
            </p>
            <div className="education-intro-preview-card" role="article" aria-label={`${selected.title || "프로그램"} 미리보기`}>
              <div className="education-intro-preview-media">
                {selected.imageUrl ? (
                  <img src={resolvePreviewImageUrl(selected.imageUrl)} alt="" className="education-intro-preview-image" />
                ) : (
                  <div className="education-intro-preview-image-placeholder">썸네일 없음</div>
                )}
                <div className="education-intro-preview-overlay">
                  <div className="education-intro-preview-tags">
                    {normalizeHashtags(selected.hashtags)
                      .filter(Boolean)
                      .map((tag, idx) => (
                        <span key={`preview-tag-${selected.id}-${idx}`} className="education-intro-preview-tag">
                          {tag}
                        </span>
                      ))}
                  </div>
                  <p className="education-intro-preview-overview">{selected.overview || "-"}</p>
                  <ul className="education-intro-preview-targets">
                    {(selected.targets || []).length ? (selected.targets || []).map((line, idx) => <li key={`preview-target-${selected.id}-${idx}`}>{line}</li>) : <li>-</li>}
                  </ul>
                  <p className="education-intro-preview-schedule">{selected.schedule || "-"}</p>
                </div>
              </div>
              <h4 className="education-intro-preview-title">{selected.title || "(제목 없음)"}</h4>
              <a
                className="education-intro-preview-link"
                href={selected.link || "#"}
                onClick={(e) => e.preventDefault()}
                aria-disabled={selected.link ? "false" : "true"}
              >
                참여하기
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
