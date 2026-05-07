import { useEffect, useMemo, useState } from "react";
import { defaultInquiriesData } from "../data/defaultInquiries";
import { downloadCsv } from "../lib/csvDownload";
import { INQUIRIES_EXPORT_HEADERS, buildInquiriesDataRows } from "../lib/inquiriesExport";
import { downloadInquiriesXlsx } from "../lib/inquiriesXlsx";
import { downloadJson, loadLocalDraft, nowIso, readJsonFile, saveLocalDraft } from "../lib/localJsonDraft";

const STORAGE_KEY = "admin.local.inquiries.v1";

/** 과거 번들 데모 문의(inq_001~003) — 기존 로컬 저장분에서 제거 */
const REMOVED_LEGACY_DUMMY_IDS = new Set(["inq_001", "inq_002", "inq_003"]);

function bootstrapInquiriesState() {
  const loaded = loadLocalDraft(STORAGE_KEY, defaultInquiriesData);
  const prev = loaded.items || [];
  const items = prev.filter((it) => !REMOVED_LEGACY_DUMMY_IDS.has(it.id));
  if (items.length === prev.length) {
    return { data: loaded, selectedId: prev[0]?.id ?? null };
  }
  const stripped = { ...loaded, items, updatedAt: nowIso() };
  saveLocalDraft(STORAGE_KEY, stripped);
  return { data: stripped, selectedId: items[0]?.id ?? null };
}

const inquiriesInitialState = bootstrapInquiriesState();

const PAGE_SIZES = [5, 10, 20, 50];
const PAGE_ALL = "all";

/** @typedef {'createdAt' | 'company' | 'name' | 'isRead'} SortKey */

/** ISO 시각 → 로컬 달력 기준 YYYY-MM-DD */
function createdAtLocalYmd(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 접수일(로컬 날짜)이 from~to 범위에 들어가는지. from/to 둘 다 비면 통과.
 * from만: 해당일 이상, to만: 해당일 이하. from>to이면 내부에서 구간 뒤바꿈.
 */
function matchesCreatedLocalRange(iso, fromYmd, toYmd) {
  if (!fromYmd && !toYmd) return true;
  const ymd = createdAtLocalYmd(iso);
  if (!ymd) return false;
  let start = fromYmd || "";
  let end = toYmd || "";
  if (start && end && start > end) {
    const t = start;
    start = end;
    end = t;
  }
  if (start && ymd < start) return false;
  if (end && ymd > end) return false;
  return true;
}

function compareInquiries(a, b, key, dir) {
  const m = dir === "asc" ? 1 : -1;
  if (key === "createdAt") {
    return m * String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  }
  if (key === "company") {
    return m * String(a.company || "").localeCompare(String(b.company || ""), "ko");
  }
  if (key === "name") {
    return m * String(a.name || "").localeCompare(String(b.name || ""), "ko");
  }
  if (key === "isRead") {
    const av = a.isRead ? 1 : 0;
    const bv = b.isRead ? 1 : 0;
    return m * (av - bv);
  }
  return 0;
}

function SortTh({ label, sortKey, activeKey, dir, onAsc, onDesc }) {
  const ascOn = activeKey === sortKey && dir === "asc";
  const descOn = activeKey === sortKey && dir === "desc";
  return (
    <th scope="col">
      <span className="inquiries-sort-head">
        <button
          type="button"
          className={`inquiries-sort-btn${ascOn ? " is-active" : ""}`}
          aria-label={`${label} 오름차순`}
          title="오름차순"
          onClick={(e) => {
            e.stopPropagation();
            onAsc();
          }}
        >
          ▲
        </button>
        <span className="inquiries-sort-label">{label}</span>
        <button
          type="button"
          className={`inquiries-sort-btn${descOn ? " is-active" : ""}`}
          aria-label={`${label} 내림차순`}
          title="내림차순"
          onClick={(e) => {
            e.stopPropagation();
            onDesc();
          }}
        >
          ▼
        </button>
      </span>
    </th>
  );
}

function exportStamp() {
  return new Date().toISOString().slice(0, 10);
}

export default function InquiriesPage() {
  const [data, setData] = useState(inquiriesInitialState.data);
  /** 입력 중인 조건(목록에는 「검색」 시 반영) */
  const [draftSearch, setDraftSearch] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");
  /** 목록·내보내기에 실제 적용되는 검색 조건 */
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [selectedId, setSelectedId] = useState(inquiriesInitialState.selectedId);
  const [message, setMessage] = useState("");
  const [sortKey, setSortKey] = useState(/** @type {SortKey} */ ("createdAt"));
  const [sortDir, setSortDir] = useState("desc");
  const [pageSize, setPageSize] = useState(/** @type {number | typeof PAGE_ALL} */ (10));
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);

  const inquiries = useMemo(
    () =>
      (data.items || []).map((item) => ({
        ...item,
        isRead: !!item.isRead,
        readAt: item.readAt || null,
      })),
    [data.items]
  );

  const filtered = useMemo(() => {
    return inquiries.filter((item) => {
      const q = appliedSearch.trim().toLowerCase();
      const bySearch = q ? [item.company, item.name, item.phone, item.email].join(" ").toLowerCase().includes(q) : true;
      const byDate = matchesCreatedLocalRange(item.createdAt, appliedDateFrom, appliedDateTo);
      return bySearch && byDate;
    });
  }, [inquiries, appliedSearch, appliedDateFrom, appliedDateTo]);

  function applySearchFilters() {
    setAppliedSearch(draftSearch);
    setAppliedDateFrom(draftDateFrom);
    setAppliedDateTo(draftDateTo);
    setPage(1);
    setMessage("검색 조건을 적용했습니다.");
  }

  function clearAppliedDateRange() {
    setDraftDateFrom("");
    setDraftDateTo("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setPage(1);
    setMessage("접수 기간 필터를 지웠습니다.");
  }

  function handleApplySearchKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      applySearchFilters();
    }
  }

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => compareInquiries(a, b, sortKey, sortDir));
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalCount = sorted.length;
  const isAllPage = pageSize === PAGE_ALL;
  const totalPages = isAllPage ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
  const effectivePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    if (isAllPage) return sorted;
    const ps = typeof pageSize === "number" ? pageSize : 10;
    const start = (effectivePage - 1) * ps;
    return sorted.slice(start, start + ps);
  }, [sorted, effectivePage, pageSize, isAllPage]);

  const selected = useMemo(() => sorted.find((item) => item.id === selectedId) ?? null, [sorted, selectedId]);

  function setSort(key, dir) {
    setSortKey(key);
    setSortDir(dir);
    setPage(1);
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function markInquiryRead(id) {
    if (!id) return;
    setData((prev) => ({
      ...prev,
      updatedAt: nowIso(),
      items: (prev.items || []).map((it) =>
        it.id === id
          ? {
              ...it,
              isRead: true,
              readAt: it.readAt || nowIso(),
              updatedAt: nowIso(),
            }
          : it
      ),
    }));
  }

  function markSelectedInquiriesUnread() {
    if (selectedIds.length === 0) {
      setMessage("안 읽음 처리할 문의를 선택해 주세요.");
      return;
    }
    const targets = new Set(selectedIds);
    let changed = 0;
    setData((prev) => ({
      ...prev,
      updatedAt: nowIso(),
      items: (prev.items || []).map((it) => {
        if (!targets.has(it.id)) return it;
        if (!it.isRead && !it.readAt) return it;
        changed += 1;
        return {
          ...it,
          isRead: false,
          readAt: null,
          updatedAt: nowIso(),
        };
      }),
    }));
    if (changed === 0) {
      setMessage("선택한 문의는 이미 안 읽음 상태입니다.");
      return;
    }
    setMessage(`선택한 ${changed}건을 안 읽음 처리했습니다.`);
  }

  const pageIds = useMemo(() => paged.map((i) => i.id), [paged]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function toggleSelectAllPage() {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  }

  function downloadSelectedCsv() {
    const rows = sorted.filter((item) => selectedIds.includes(item.id));
    if (rows.length === 0) {
      setMessage("CSV로 내보낼 문의를 선택해 주세요.");
      return;
    }
    downloadCsv(`inquiries-selected-${exportStamp()}.csv`, INQUIRIES_EXPORT_HEADERS, buildInquiriesDataRows(rows));
    setMessage(`선택한 ${rows.length}건을 CSV로 내보냈습니다.`);
  }

  function downloadSelectedXlsx() {
    const rows = sorted.filter((item) => selectedIds.includes(item.id));
    if (rows.length === 0) {
      setMessage("엑셀로 내보낼 문의를 선택해 주세요.");
      return;
    }
    downloadInquiriesXlsx(rows, `inquiries-selected-${exportStamp()}.xlsx`);
    setMessage(`선택한 ${rows.length}건을 엑셀(.xlsx)로 내보냈습니다.`);
  }

  function downloadFilteredCsv() {
    if (sorted.length === 0) {
      setMessage("내보낼 문의가 없습니다.");
      return;
    }
    downloadCsv(`inquiries-filtered-${exportStamp()}.csv`, INQUIRIES_EXPORT_HEADERS, buildInquiriesDataRows(sorted));
    setMessage(`현재 필터·정렬 결과 ${sorted.length}건을 CSV로 내보냈습니다.`);
  }

  function downloadFilteredXlsx() {
    if (sorted.length === 0) {
      setMessage("내보낼 문의가 없습니다.");
      return;
    }
    downloadInquiriesXlsx(sorted, `inquiries-filtered-${exportStamp()}.xlsx`);
    setMessage(`현재 필터·정렬 결과 ${sorted.length}건을 엑셀(.xlsx)로 내보냈습니다.`);
  }

  function updateMemo(id, memo) {
    setData((prev) => ({
      ...prev,
      updatedAt: nowIso(),
      items: prev.items.map((it) => (it.id === id ? { ...it, memo, updatedAt: nowIso() } : it)),
    }));
  }

  function deleteInquiry(id) {
    setData((prev) => {
      const nextItems = (prev.items || []).filter((it) => it.id !== id);
      const nextSelectedId = nextItems[0]?.id ?? null;
      if (selectedId === id) setSelectedId(nextSelectedId);
      return {
        ...prev,
        updatedAt: nowIso(),
        items: nextItems,
      };
    });
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setMessage("문의를 삭제했습니다.");
  }

  function deleteSelectedInquiries() {
    if (selectedIds.length === 0) {
      setMessage("삭제할 문의를 선택해 주세요.");
      return;
    }
    const toRemove = new Set(selectedIds);
    const prevItems = data.items || [];
    const nextItems = prevItems.filter((it) => !toRemove.has(it.id));
    const removedCount = prevItems.length - nextItems.length;
    if (removedCount === 0) {
      setMessage("삭제할 문의를 찾을 수 없습니다.");
      setSelectedIds([]);
      return;
    }
    let nextSelectedId = selectedId;
    if (selectedId != null && (toRemove.has(selectedId) || !nextItems.some((it) => it.id === selectedId))) {
      nextSelectedId = nextItems[0]?.id ?? null;
    }
    setData((prev) => ({
      ...prev,
      updatedAt: nowIso(),
      items: nextItems,
    }));
    setSelectedId(nextSelectedId);
    setSelectedIds([]);
    setMessage(`선택한 ${removedCount}건을 삭제했습니다.`);
  }

  useEffect(() => {
    saveLocalDraft(STORAGE_KEY, { ...data, items: inquiries });
  }, [data, inquiries]);

  function exportJson() {
    downloadJson("inquiries.json", { ...data, items: inquiries });
    setMessage("문의 DB JSON을 내보냈습니다.");
  }

  async function importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const next = await readJsonFile(file);
      setData(next);
      setSelectedId(next.items?.[0]?.id ?? null);
      setSelectedIds([]);
      setDraftSearch("");
      setDraftDateFrom("");
      setDraftDateTo("");
      setAppliedSearch("");
      setAppliedDateFrom("");
      setAppliedDateTo("");
      setMessage("문의 DB JSON을 불러왔습니다.");
    } catch (err) {
      setMessage(`불러오기 실패: ${err.message || String(err)}`);
    } finally {
      e.target.value = "";
    }
  }

  return (
    <section className="page">
      <h2 className="page-title">문의 관리</h2>

      <div className="admin-actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
        <button className="btn btn-outline" type="button" disabled={selectedIds.length === 0} onClick={downloadSelectedCsv}>
          선택 문의 CSV 다운로드
        </button>
        <button className="btn btn-outline" type="button" disabled={selectedIds.length === 0} onClick={downloadSelectedXlsx}>
          선택 문의 엑셀(.xlsx) 다운로드
        </button>
        <div className="inquiries-filter-export-pair">
          <button className="btn btn-outline" type="button" disabled={totalCount === 0} onClick={downloadFilteredCsv}>
            필터 결과 전체 CSV 다운로드
          </button>
          <button className="btn btn-outline" type="button" disabled={totalCount === 0} onClick={downloadFilteredXlsx}>
            필터 결과 전체 엑셀(.xlsx) 다운로드
          </button>
        </div>
      </div>
      {message && <p className="muted">{message}</p>}

      <div className="inquiries-toolbar-wrap">
        <div className="toolbar inquiries-toolbar-inner inquiries-toolbar-filters">
          <input
            className="input inquiries-search-input"
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            onKeyDown={handleApplySearchKeyDown}
            placeholder="기업명, 이름, 연락처 (입력 후 검색)"
          />
          <span className="inquiries-date-range" role="group" aria-label="접수일 기간">
            <span className="inquiries-date-range-label">접수일</span>
            <label className="inquiries-date-filter">
              <span className="muted inquiries-date-fromto">부터</span>
              <input
                className="input inquiries-date-input"
                type="date"
                value={draftDateFrom}
                onChange={(e) => setDraftDateFrom(e.target.value)}
                onKeyDown={handleApplySearchKeyDown}
              />
            </label>
            <span className="muted inquiries-date-tilde" aria-hidden="true">
              ~
            </span>
            <label className="inquiries-date-filter">
              <span className="muted inquiries-date-fromto">까지</span>
              <input
                className="input inquiries-date-input"
                type="date"
                value={draftDateTo}
                onChange={(e) => setDraftDateTo(e.target.value)}
                onKeyDown={handleApplySearchKeyDown}
              />
            </label>
          </span>
          <button className="btn btn-outline" type="button" onClick={clearAppliedDateRange}>
            접수 기간 지우기
          </button>
          <button className="btn btn-primary" type="button" onClick={applySearchFilters}>
            검색
          </button>
        </div>
        <div className="inquiries-page-controls">
          <label className="inquiries-page-size-label">
            페이지당
            <select
              className="input inquiries-page-size-select"
              value={isAllPage ? PAGE_ALL : String(pageSize)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === PAGE_ALL) {
                  setPageSize(PAGE_ALL);
                  setPage(1);
                } else {
                  setPageSize(Number(v));
                  setPage(1);
                }
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={PAGE_ALL}>모두 보기</option>
            </select>
            개
          </label>
          <button
            className="btn btn-outline"
            type="button"
            disabled={selectedIds.length === 0}
            onClick={deleteSelectedInquiries}
            title="체크한 문의만 삭제합니다"
          >
            삭제하기
          </button>
          <button
            className="btn btn-outline"
            type="button"
            disabled={selectedIds.length === 0}
            onClick={markSelectedInquiriesUnread}
            title="체크한 문의를 안 읽음 상태로 되돌립니다"
          >
            안 읽음 처리
          </button>
          <span className="muted inquiries-page-meta">
            {isAllPage ? (
              <>
                전체 {totalCount}건 · 한 페이지에 모두 표시
              </>
            ) : (
              <>
                전체 {totalCount}건 · {effectivePage} / {totalPages} 페이지
              </>
            )}
          </span>
          <div className="inquiries-page-nav">
            <button className="btn btn-outline" type="button" disabled={isAllPage || effectivePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              이전
            </button>
            <button
              className="btn btn-outline"
              type="button"
              disabled={isAllPage || effectivePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              다음
            </button>
          </div>
        </div>
      </div>
      <p className="muted" style={{ marginTop: "-0.2rem", marginBottom: "0.9rem" }}>
        정책: Admin 접속 시 모든 문의는 열람 처리됩니다. 키워드·접수일을 입력한 뒤 「검색」 또는 Enter로 적용합니다(키워드만, 접수 기간만, 또는 둘 다 가능). 「접수 기간 지우기」는 적용 중인 날짜 필터만 비웁니다. 선택 다운로드는 체크한 행만, 「필터 결과 전체」는 적용된 검색·접수 기간·정렬이 반영된 목록 전체를 내보냅니다(CSV UTF-8 BOM / 시트명 「문의내용 목록」).
      </p>

      <div className="split-grid inquiries-split-grid">
        <div className="panel inquiries-list-panel">
          <div className="table-scroll">
            <table className="table inquiries-table">
              <thead>
                <tr>
                  <th scope="col" className="inquiries-th-check">
                    <input type="checkbox" aria-label="현재 페이지 전체 선택" checked={allPageSelected} onChange={toggleSelectAllPage} />
                  </th>
                  <SortTh
                    label="접수일"
                    sortKey="createdAt"
                    activeKey={sortKey}
                    dir={sortDir}
                    onAsc={() => setSort("createdAt", "asc")}
                    onDesc={() => setSort("createdAt", "desc")}
                  />
                  <SortTh
                    label="기업명"
                    sortKey="company"
                    activeKey={sortKey}
                    dir={sortDir}
                    onAsc={() => setSort("company", "asc")}
                    onDesc={() => setSort("company", "desc")}
                  />
                  <SortTh
                    label="이름"
                    sortKey="name"
                    activeKey={sortKey}
                    dir={sortDir}
                    onAsc={() => setSort("name", "asc")}
                    onDesc={() => setSort("name", "desc")}
                  />
                  <SortTh
                    label="열람"
                    sortKey="isRead"
                    activeKey={sortKey}
                    dir={sortDir}
                    onAsc={() => setSort("isRead", "asc")}
                    onDesc={() => setSort("isRead", "desc")}
                  />
                  <th scope="col">삭제</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((item) => (
                  <tr
                    key={item.id}
                    className={`${selected?.id === item.id ? "is-selected " : ""}${item.isRead ? "inquiries-row-read" : "inquiries-row-unread"}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      markInquiryRead(item.id);
                    }}
                  >
                    <td className="inquiries-td-check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`${item.company} 선택`} />
                    </td>
                    <td>{new Date(item.createdAt).toLocaleDateString("ko-KR")}</td>
                    <td>{item.company}</td>
                    <td>{item.name}</td>
                    <td>{item.isRead ? "열람 완료" : "미열람"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteInquiry(item.id);
                        }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="panel detail-panel inquiries-detail-panel">
          {selected ? (
            <>
              <h3>문의 상세</h3>
              <div style={{ marginBottom: "0.65rem" }}>
                <button className="btn btn-outline" type="button" onClick={() => deleteInquiry(selected.id)}>
                  현재 문의 삭제
                </button>
              </div>
              <div className="inquiries-detail-scroll">
                <dl className="detail-list inquiries-detail-list">
                  <dt>기업명</dt>
                  <dd>{selected.company}</dd>
                  <dt>이름/직책</dt>
                  <dd>{selected.name}</dd>
                  <dt>연락처</dt>
                  <dd>{selected.phone}</dd>
                  <dt>이메일</dt>
                  <dd>{selected.email || "-"}</dd>
                  <dt>열람 여부</dt>
                  <dd>{selected.isRead ? "열람 완료" : "미열람"}</dd>
                  <dt>열람 시간</dt>
                  <dd>{new Date(selected.readAt).toLocaleString("ko-KR")}</dd>
                  <dt>문의 내용</dt>
                  <dd className="inquiries-message-content">{selected.message}</dd>
                  <dt>관리 메모</dt>
                  <dd>
                    <textarea className="input" rows={4} value={selected.memo || ""} onChange={(e) => updateMemo(selected.id, e.target.value)} />
                  </dd>
                </dl>
              </div>
            </>
          ) : (
            <p className="muted">선택된 문의가 없습니다.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
