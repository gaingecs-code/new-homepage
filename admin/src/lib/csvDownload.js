/** CSV 필드 이스케이프 (쉼표·줄바꿈·따옴표) */
export function escapeCsvField(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * UTF-8 BOM 포함 CSV 파일 다운로드 (엑셀에서 한글 인식용)
 * @param {string} filename
 * @param {string[]} headerRow
 * @param {string[][]} dataRows
 */
export function downloadCsv(filename, headerRow, dataRows) {
  const lines = [headerRow.map(escapeCsvField).join(",")];
  for (const row of dataRows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
