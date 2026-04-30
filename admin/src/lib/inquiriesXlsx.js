import * as XLSX from "xlsx";
import { INQUIRIES_EXPORT_HEADERS, buildInquiriesDataRows } from "./inquiriesExport";

/** 엑셀 시트 이름 (31자 이내) */
export const INQUIRIES_SHEET_NAME = "문의내용 목록";

/**
 * @param {Parameters<typeof buildInquiriesDataRows>[0]} items
 * @param {string} filename
 */
export function downloadInquiriesXlsx(items, filename) {
  const dataRows = buildInquiriesDataRows(items);
  const aoa = [INQUIRIES_EXPORT_HEADERS, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, INQUIRIES_SHEET_NAME);
  XLSX.writeFile(wb, filename);
}
