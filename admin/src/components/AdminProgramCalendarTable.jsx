import { useEffect, useState } from "react";
import { ADMIN_CAL_MONTHS } from "../lib/adminCalendarConstants";

/**
 * 홈 community.html 캘린더 그리드와 동일한 열 구조(프로그램 + 12개월).
 * Admin 전용: 흰 셀·검은 테두리. 월 셀 클릭 시 일정 추가/수정 모달.
 *
 * variant: "education" | "community" — community만 메모(note)·programMeta·place 사용.
 */
export default function AdminProgramCalendarTable({
  row,
  rowIndex,
  variant,
  onUpdateRowField,
  onUpdateEntry,
  onAddEntry,
  onRemoveEntry,
  onRemoveRow,
}) {
  const [modalMonth, setModalMonth] = useState(null);
  const [form, setForm] = useState({ label: "", link: "", note: "" });
  const [editingEntryId, setEditingEntryId] = useState(null);

  const isCommunity = variant === "community";

  useEffect(() => {
    if (!modalMonth) {
      setForm({ label: "", link: "", note: "" });
      setEditingEntryId(null);
    }
  }, [modalMonth]);

  function openModal(month) {
    setModalMonth(month);
    setForm({ label: "", link: "", note: "" });
    setEditingEntryId(null);
  }

  function closeModal() {
    setModalMonth(null);
  }

  function startEdit(entry) {
    setEditingEntryId(entry.id);
    setForm({
      label: entry.label || "",
      link: entry.link || "",
      note: entry.note || "",
    });
  }

  function cancelEdit() {
    setEditingEntryId(null);
    setForm({ label: "", link: "", note: "" });
  }

  function handleSaveEdit() {
    if (!modalMonth || !editingEntryId) return;
    const entries = row.monthEntries?.[modalMonth] || [];
    const entryIndex = entries.findIndex((e) => e.id === editingEntryId);
    if (entryIndex < 0) return;
    if (!String(form.label || "").trim()) {
      window.alert("날짜/표시 텍스트를 입력해 주세요. (예: 15일)");
      return;
    }
    onUpdateEntry(rowIndex, modalMonth, entryIndex, "label", form.label.trim());
    onUpdateEntry(rowIndex, modalMonth, entryIndex, "link", form.link.trim());
    if (isCommunity) onUpdateEntry(rowIndex, modalMonth, entryIndex, "note", form.note.trim());
    cancelEdit();
  }

  function handleAdd() {
    if (!modalMonth) return;
    if (!String(form.label || "").trim()) {
      window.alert("날짜/표시 텍스트를 입력해 주세요. (예: 15일)");
      return;
    }
    onAddEntry(rowIndex, modalMonth, {
      label: form.label.trim(),
      link: form.link.trim(),
      note: isCommunity ? form.note.trim() : "",
    });
    setForm({ label: "", link: "", note: "" });
  }

  function handleDelete(entryIndex) {
    if (!modalMonth) return;
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    onRemoveEntry(rowIndex, modalMonth, entryIndex);
  }

  const modalEntries = modalMonth ? row.monthEntries?.[modalMonth] || [] : [];

  return (
    <>
      <div className="admin-calendar-grid" role="table" aria-label={`${row.program || "프로그램"} 연간 캘린더`}>
        <div className="admin-calendar-row admin-calendar-row--head" role="row">
          <div className="admin-calendar-cell admin-calendar-cell--program" role="columnheader">
            프로그램
          </div>
          {ADMIN_CAL_MONTHS.map((m) => (
            <div key={m} className="admin-calendar-cell" role="columnheader">
              {m}월
            </div>
          ))}
        </div>

        <div className="admin-calendar-row" role="row">
          <div className="admin-calendar-cell admin-calendar-cell--program" role="rowheader">
            <label className="field" style={{ width: "100%", margin: 0 }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>프로그램명</span>
              <input
                className="input"
                value={row.program || ""}
                onChange={(e) => onUpdateRowField(rowIndex, "program", e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </label>
            {isCommunity && (
              <>
                <label className="field" style={{ width: "100%", marginTop: "0.45rem", marginBottom: 0 }}>
                  <span style={{ fontSize: "0.72rem" }}>메타 (예: 매월 셋째 목요일)</span>
                  <input
                    className="input"
                    value={row.programMeta || ""}
                    onChange={(e) => onUpdateRowField(rowIndex, "programMeta", e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                <label className="field" style={{ width: "100%", marginTop: "0.35rem", marginBottom: 0 }}>
                  <span style={{ fontSize: "0.72rem" }}>장소</span>
                  <input
                    className="input"
                    value={row.place || ""}
                    onChange={(e) => onUpdateRowField(rowIndex, "place", e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
              </>
            )}
            {onRemoveRow && (
              <button className="btn btn-outline" type="button" style={{ marginTop: "0.5rem", fontSize: "0.8rem", padding: "0.35rem 0.5rem" }} onClick={() => onRemoveRow(rowIndex)}>
                이 프로그램 행 삭제
              </button>
            )}
          </div>

          {ADMIN_CAL_MONTHS.map((month) => {
            const entries = row.monthEntries?.[month] || [];
            return (
              <button
                key={month}
                type="button"
                className="admin-calendar-cell admin-calendar-cell--month"
                onClick={() => openModal(month)}
                aria-label={`${month}월 일정 편집`}
              >
                {entries.length === 0 ? (
                  <span className="admin-calendar-cell-placeholder">클릭하여 입력</span>
                ) : (
                  <div className="admin-calendar-cell-pills">
                    {entries.map((ent) => (
                      <span key={ent.id} className={`admin-calendar-pill ${ent.link ? "admin-calendar-pill--linked" : ""}`}>
                        {ent.label || "—"}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {modalMonth && (
        <div className="admin-calendar-modal-backdrop" role="presentation" onClick={closeModal}>
          <div className="admin-calendar-modal" role="dialog" aria-modal="true" aria-labelledby="admin-cal-modal-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="admin-cal-modal-title" style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>
              {row.program || "프로그램"} · {modalMonth}월 일정
            </h3>

            <div className="admin-calendar-modal-list">
              {modalEntries.length === 0 ? <p className="muted" style={{ margin: "0 0 0.75rem" }}>등록된 일정이 없습니다. 아래에서 추가하세요.</p> : null}
              {modalEntries.map((ent, idx) => (
                <div key={ent.id} className="admin-calendar-modal-row">
                  <span className={`admin-calendar-pill ${ent.link ? "admin-calendar-pill--linked" : ""}`}>{ent.label || "—"}</span>
                  {ent.link ? (
                    <span className="muted" style={{ fontSize: "0.78rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {ent.link}
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: "0.78rem" }}>링크 없음</span>
                  )}
                  {isCommunity && ent.note ? (
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      메모: {ent.note}
                    </span>
                  ) : null}
                  <button type="button" className="btn btn-outline" style={{ fontSize: "0.8rem", padding: "0.25rem 0.45rem" }} onClick={() => startEdit(ent)}>
                    수정
                  </button>
                  <button type="button" className="btn btn-outline" style={{ fontSize: "0.8rem", padding: "0.25rem 0.45rem", color: "#b91c1c", borderColor: "#fecaca" }} onClick={() => handleDelete(idx)}>
                    삭제
                  </button>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", margin: "0.75rem 0", paddingTop: "0.75rem" }}>
              <p className="card-label" style={{ marginBottom: "0.5rem" }}>
                {editingEntryId ? "선택한 일정 수정" : "일정 추가"}
              </p>
              <label className="field">
                <span>날짜 표시</span>
                <input className="input" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="예: 15일, 미정" />
              </label>
              <label className="field">
                <span>링크 (선택)</span>
                <input className="input" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://..." />
              </label>
              {isCommunity ? (
                <label className="field">
                  <span>메모 / 장소 (선택)</span>
                  <input className="input" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="예: 아모리스 역삼" />
                </label>
              ) : null}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
                {editingEntryId ? (
                  <>
                    <button className="btn btn-primary" type="button" onClick={handleSaveEdit}>
                      변경 저장
                    </button>
                    <button className="btn btn-outline" type="button" onClick={cancelEdit}>
                      수정 취소
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary" type="button" onClick={handleAdd}>
                    일정 추가
                  </button>
                )}
                <button className="btn btn-outline" type="button" onClick={closeModal}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
