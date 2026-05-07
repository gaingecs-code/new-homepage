import { useEffect, useMemo, useRef, useState } from "react";
import { defaultBooksData } from "../data/defaultBooks";
import { downloadJson, loadLocalDraft, nowIso, readJsonFile, saveLocalDraft } from "../lib/localJsonDraft";

const STORAGE_KEY = "admin.local.books.v1";
const PUBLISHED_STORAGE_KEY = "admin.published.books.v1";

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

export default function BooksPage() {
  const [data, setData] = useState(() => loadLocalDraft(STORAGE_KEY, defaultBooksData));
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState(() => defaultBooksData.items?.[0]?.id ?? null);
  const [showSavedBadge, setShowSavedBadge] = useState(false);
  const thumbInputRef = useRef(null);
  const saveFeedbackTimerRef = useRef(null);

  const items = useMemo(() => data.items || [], [data.items]);

  const selectedIndex = useMemo(() => items.findIndex((x) => x.id === selectedId), [items, selectedId]);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  useEffect(
    () => () => {
      if (saveFeedbackTimerRef.current) {
        clearTimeout(saveFeedbackTimerRef.current);
        saveFeedbackTimerRef.current = null;
      }
    },
    []
  );

  function updateItem(index, key, value) {
    setData((prev) => {
      const next = { ...prev, items: [...prev.items], updatedAt: nowIso() };
      next.items[index] = { ...next.items[index], [key]: value, updatedAt: nowIso() };
      return next;
    });
  }

  async function onCoverFile(e) {
    const file = e.target.files?.[0];
    if (!file || selectedIndex < 0) return;
    try {
      const imageUrl = await readAsDataUrl(file);
      updateItem(selectedIndex, "imageUrl", imageUrl);
      setMessage("표지 이미지를 반영했습니다. JSON 용량이 커질 수 있습니다.");
    } catch (err) {
      setMessage(`이미지 업로드 실패: ${err.message || String(err)}`);
    } finally {
      e.target.value = "";
    }
  }

  function addBook() {
    const id = `book-${Date.now()}`;
    setData((prev) => ({
      ...prev,
      updatedAt: nowIso(),
      items: [
        ...(prev.items || []),
        {
          id,
          title: "새 도서",
          imageUrl: "",
          link: "",
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ],
    }));
    setSelectedId(id);
    setMessage("새 도서를 추가했습니다. 오른쪽에서 내용을 입력해 주세요.");
  }

  function deleteBook(id) {
    const target = items.find((x) => x.id === id);
    if (!target) return;
    const label = target.title?.trim() || target.id;
    if (!window.confirm(`「${label}」 도서를 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`)) return;

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
    setMessage("도서를 삭제했습니다.");
  }

  function moveBook(index, direction) {
    setData((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.items.length) return prev;
      const itemsNext = [...prev.items];
      const tmp = itemsNext[index];
      itemsNext[index] = itemsNext[target];
      itemsNext[target] = tmp;
      return { ...prev, items: itemsNext, updatedAt: nowIso() };
    });
  }

  function saveDraft() {
    saveLocalDraft(STORAGE_KEY, data);
    saveLocalDraft(PUBLISHED_STORAGE_KEY, data);
    setMessage("웹 저장하기: 도서 변경사항을 즉시 반영용으로 저장했습니다.");
    setShowSavedBadge(true);
    if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current);
    saveFeedbackTimerRef.current = setTimeout(() => {
      setShowSavedBadge(false);
      saveFeedbackTimerRef.current = null;
    }, 1800);
  }

  function exportJson() {
    downloadJson("books.json", data);
    setMessage("JSON 파일을 내보냈습니다.");
  }

  async function importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const next = await readJsonFile(file);
      setData(next);
      setSelectedId(next.items?.[0]?.id ?? null);
      setMessage("JSON을 불러왔습니다.");
    } catch (err) {
      setMessage(`불러오기 실패: ${err.message || String(err)}`);
    } finally {
      e.target.value = "";
    }
  }

  function resetDefault() {
    setData(defaultBooksData);
    setSelectedId(defaultBooksData.items?.[0]?.id ?? null);
    setMessage("기본값으로 되돌렸습니다.");
  }

  return (
    <section className="page">
      <h2 className="page-title">가인지 도서 관리</h2>
      <div className="panel">
        <p className="muted">
          메인 도서 캐러셀(`gainge-management`) 기준 데이터입니다. 왼쪽에서 도서를 선택하면 오른쪽에서 수정합니다. 표지는 파일 업로드 시 JSON에 포함되므로 용량을 확인해 주세요.
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
          <button className="btn btn-primary" type="button" onClick={addBook}>
            도서 추가
          </button>
          <button
            className="btn btn-outline education-intro-delete-btn"
            type="button"
            disabled={!selectedId}
            title={!selectedId ? "삭제하려면 왼쪽 목록에서 도서를 선택하세요" : undefined}
            onClick={() => selectedId && deleteBook(selectedId)}
          >
            도서 삭제
          </button>
        </div>
        {message && <p className="muted">{message}</p>}

        <div className="education-intro-split">
          <aside className="panel education-intro-list-panel">
            <p className="card-label" style={{ marginTop: 0 }}>
              도서 목록 (캐러셀 순서)
            </p>
            <table className="education-intro-table">
              <thead>
                <tr>
                  <th scope="col" className="books-admin-table-order">
                    순서
                  </th>
                  <th scope="col">도서명</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="education-intro-table-empty">
                      등록된 도서가 없습니다. 「도서 추가」를 눌러 주세요.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
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
                      <td className="books-admin-table-order">{index + 1}</td>
                      <td>
                        {item.title || "(제목 없음)"}
                        <span className="muted" style={{ display: "block", fontSize: "0.72rem", marginTop: "0.2rem" }}>
                          {item.id}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </aside>

          <div className="panel education-intro-editor-panel">
            {!selected ? (
              <p className="muted">왼쪽 목록에서 도서를 선택하거나 「도서 추가」를 눌러 주세요.</p>
            ) : (
              <>
                <p className="card-label">
                  편집: {selected.title || "새 도서"} <span className="muted">({selected.id})</span>
                </p>

                <label className="field">
                  <span>도서 제목</span>
                  <input className="input" value={selected.title || ""} onChange={(e) => updateItem(selectedIndex, "title", e.target.value)} />
                </label>

                <div className="field">
                  <span>표지 이미지</span>
                  <div className="education-intro-thumb-row">
                    <button className="btn btn-outline" type="button" onClick={() => thumbInputRef.current?.click()}>
                      이미지 파일 업로드
                    </button>
                    <input ref={thumbInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onCoverFile} />
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

                <label className="field">
                  <span>링크 URL</span>
                  <input className="input" value={selected.link || ""} onChange={(e) => updateItem(selectedIndex, "link", e.target.value)} />
                </label>

                <div className="field">
                  <span>캐러셀 순서</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginTop: "0.35rem" }}>
                    <button className="btn btn-outline" type="button" disabled={selectedIndex <= 0} onClick={() => moveBook(selectedIndex, -1)}>
                      위로 (↑)
                    </button>
                    <button
                      className="btn btn-outline"
                      type="button"
                      disabled={selectedIndex < 0 || selectedIndex >= items.length - 1}
                      onClick={() => moveBook(selectedIndex, 1)}
                    >
                      아래로 (↓)
                    </button>
                    <span className="muted" style={{ fontSize: "0.82rem" }}>
                      현재 {selectedIndex + 1}번째 · 총 {items.length}권
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
