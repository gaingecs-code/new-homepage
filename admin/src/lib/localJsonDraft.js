export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadLocalDraft(storageKey, fallback) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return deepClone(fallback);
    return { ...deepClone(fallback), ...JSON.parse(raw) };
  } catch (_) {
    return deepClone(fallback);
  }
}

export function saveLocalDraft(storageKey, value) {
  localStorage.setItem(storageKey, JSON.stringify(value, null, 2));
}

export function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || "")));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("파일 읽기 실패"));
    reader.readAsText(file, "UTF-8");
  });
}

export function nowIso() {
  return new Date().toISOString();
}
