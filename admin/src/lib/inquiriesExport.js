/** CSV / XLSX 공통 — 문의 목록 행 생성 */

export const INQUIRIES_EXPORT_HEADERS = [
  "id",
  "접수일시(ISO)",
  "접수일(표시)",
  "기업명",
  "이름",
  "연락처",
  "이메일",
  "열람",
  "열람시간",
  "문의내용",
  "관리메모",
];

/**
 * @param {Array<{ id: string, createdAt?: string, company?: string, name?: string, phone?: string, email?: string, isRead?: boolean, readAt?: string, message?: string, memo?: string }>} items
 * @returns {string[][]}
 */
export function buildInquiriesDataRows(items) {
  return items.map((item) => [
    item.id,
    item.createdAt || "",
    item.createdAt ? new Date(item.createdAt).toLocaleString("ko-KR") : "",
    item.company || "",
    item.name || "",
    item.phone || "",
    item.email || "",
    item.isRead ? "열람 완료" : "미열람",
    item.readAt ? new Date(item.readAt).toLocaleString("ko-KR") : "",
    item.message || "",
    item.memo || "",
  ]);
}
