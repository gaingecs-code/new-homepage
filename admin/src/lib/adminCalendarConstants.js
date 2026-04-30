/** 연간 캘린더 월 키 (JSON · DOM 공통) */
export const ADMIN_CAL_MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export function emptyMonthEntries() {
  const o = {};
  ADMIN_CAL_MONTHS.forEach((m) => {
    o[m] = [];
  });
  return o;
}
