import { useMemo, useState } from "react";
import AdminProgramCalendarTable from "../components/AdminProgramCalendarTable";
import { ADMIN_CAL_MONTHS, emptyMonthEntries } from "../lib/adminCalendarConstants";
import { defaultEducationCalendarData } from "../data/defaultEducationCalendar";
import { downloadJson, loadLocalDraft, nowIso, readJsonFile, saveLocalDraft } from "../lib/localJsonDraft";

const STORAGE_KEY = "admin.local.education-calendar.v1";

function normalizeRows(rows) {
  return (rows || []).map((row) => {
    if (row.monthEntries) {
      const merged = { ...emptyMonthEntries(), ...row.monthEntries };
      return { ...row, monthEntries: merged };
    }
    const monthEntries = emptyMonthEntries();
    ADMIN_CAL_MONTHS.forEach((m) => {
      const labels = String(row.months?.[m] || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      monthEntries[m] = labels.map((label, i) => ({
        id: `${row.id}-${m}-${i + 1}`,
        label,
        link: row.monthLinks?.[m] || "",
      }));
    });
    return { ...row, monthEntries };
  });
}

export default function EducationCalendarPage() {
  const [data, setData] = useState(() => loadLocalDraft(STORAGE_KEY, defaultEducationCalendarData));
  const [message, setMessage] = useState("");
  const rows = useMemo(() => normalizeRows(data.rows), [data.rows]);

  function updateMeta(key, value) {
    setData((prev) => ({ ...prev, [key]: value, updatedAt: nowIso() }));
  }

  function updateRowField(index, field, value) {
    setData((prev) => {
      const nextRows = [...prev.rows];
      nextRows[index] = { ...nextRows[index], [field]: value, updatedAt: nowIso() };
      return { ...prev, rows: nextRows, updatedAt: nowIso() };
    });
  }

  function updateEntry(index, month, entryIndex, key, value) {
    setData((prev) => {
      const nextRows = [...prev.rows];
      const sourceRow = normalizeRows(nextRows)[index];
      const row = { ...sourceRow, monthEntries: { ...sourceRow.monthEntries }, updatedAt: nowIso() };
      const entries = [...(row.monthEntries[month] || [])];
      entries[entryIndex] = { ...entries[entryIndex], [key]: value };
      row.monthEntries[month] = entries;
      nextRows[index] = row;
      return { ...prev, rows: nextRows, updatedAt: nowIso() };
    });
  }

  function addEntry(index, month, partial) {
    setData((prev) => {
      const nextRows = [...prev.rows];
      const sourceRow = normalizeRows(nextRows)[index];
      const row = { ...sourceRow, monthEntries: { ...sourceRow.monthEntries }, updatedAt: nowIso() };
      const entries = [...(row.monthEntries[month] || [])];
      entries.push({
        id: `${row.id}-${month}-${Date.now()}`,
        label: partial.label || "",
        link: partial.link || "",
      });
      row.monthEntries[month] = entries;
      nextRows[index] = row;
      return { ...prev, rows: nextRows, updatedAt: nowIso() };
    });
  }

  function removeEntry(index, month, entryIndex) {
    setData((prev) => {
      const nextRows = [...prev.rows];
      const sourceRow = normalizeRows(nextRows)[index];
      const row = { ...sourceRow, monthEntries: { ...sourceRow.monthEntries }, updatedAt: nowIso() };
      const entries = [...(row.monthEntries[month] || [])];
      entries.splice(entryIndex, 1);
      row.monthEntries[month] = entries;
      nextRows[index] = row;
      return { ...prev, rows: nextRows, updatedAt: nowIso() };
    });
  }

  function addProgramRow() {
    setData((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        {
          id: `education-row-${Date.now()}`,
          program: "새 프로그램",
          monthEntries: emptyMonthEntries(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ],
      updatedAt: nowIso(),
    }));
    setMessage("새 프로그램 캘린더 행을 추가했습니다. 프로그램명을 입력해 주세요.");
  }

  function removeProgramRow(index) {
    if (!window.confirm("이 프로그램 캘린더 행을 삭제할까요?")) return;
    setData((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== index),
      updatedAt: nowIso(),
    }));
    setMessage("프로그램 행을 삭제했습니다.");
  }

  function saveDraft() {
    saveLocalDraft(STORAGE_KEY, data);
    setMessage("로컬 초안을 저장했습니다.");
  }

  function exportJson() {
    downloadJson("corporate-education-calendar.json", data);
    setMessage("JSON 파일을 내보냈습니다.");
  }

  async function importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const next = await readJsonFile(file);
      setData({ ...next, rows: normalizeRows(next.rows || []) });
      setMessage("JSON을 불러왔습니다.");
    } catch (err) {
      setMessage(`불러오기 실패: ${err.message || String(err)}`);
    } finally {
      e.target.value = "";
    }
  }

  function resetDefault() {
    setData(defaultEducationCalendarData);
    setMessage("기본값으로 되돌렸습니다.");
  }

  return (
    <section className="page">
      <h2 className="page-title">기업교육 캘린더</h2>
      <div className="panel">
        <p className="muted">기존 `corporate-education.html` 캘린더 구성 기준입니다. 월 칸을 누르면 일정을 추가·수정할 수 있습니다.</p>
        <div className="admin-actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
          <button className="btn btn-primary" type="button" onClick={saveDraft}>
            로컬 저장 (PC에 문서로 저장합니다)
          </button>
          <button className="btn btn-outline" type="button" onClick={exportJson}>
            JSON 내보내기 (웹 게시용 파일로 저장합니다.)
          </button>
          <label className="btn btn-outline" style={{ cursor: "pointer" }}>
            JSON 불러오기 (웹 게시용 파일을 불러옵니다.)
            <input type="file" accept="application/json,.json" onChange={importJson} style={{ display: "none" }} />
          </label>
          <button className="btn btn-outline" type="button" onClick={resetDefault}>
            기본값 복원
          </button>
          <button className="btn btn-primary" type="button" onClick={addProgramRow}>
            + 프로그램 캘린더 추가
          </button>
        </div>
        {message && <p className="muted">{message}</p>}

        <label className="field">
          <span>섹션 타이틀</span>
          <input className="input" value={data.title || ""} onChange={(e) => updateMeta("title", e.target.value)} />
        </label>
        <label className="field">
          <span>섹션 보조 타이틀</span>
          <input className="input" value={data.guide || ""} onChange={(e) => updateMeta("guide", e.target.value)} />
        </label>

        {rows.map((row, rowIndex) => (
          <div key={row.id} className="panel" style={{ marginTop: "0.85rem" }}>
            <p className="card-label">프로그램 캘린더</p>
            <AdminProgramCalendarTable
              row={row}
              rowIndex={rowIndex}
              variant="education"
              onUpdateRowField={updateRowField}
              onUpdateEntry={updateEntry}
              onAddEntry={addEntry}
              onRemoveEntry={removeEntry}
              onRemoveRow={removeProgramRow}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
