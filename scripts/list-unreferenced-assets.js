/**
 * assets/ 폴더의 파일 중 코드·데이터에서 참조되지 않는 것 출력
 * 실행: node scripts/list-unreferenced-assets.js
 */
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");

function walkDir(dir, baseDir = "") {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = baseDir ? `${baseDir}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkDir(full, rel.replace(/\\/g, "/")));
    } else {
      out.push(rel.replace(/\\/g, "/"));
    }
  }
  return out;
}

function readUtf8(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function shouldScanFile(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  if (norm.includes("node_modules")) return false;
  return /\.(html|htm|css|js|json|jsx|tsx|ts|csv)$/i.test(norm);
}

function collectStaticReferences() {
  const refs = new Set();

  function extractFromText(text) {
    const patterns = [
      /"assets\/[^"]+"/gi,
      /'assets\/[^']+'/gi,
      /"\.\.\/assets\/[^"]+"/gi,
      /'\.\.\/assets\/[^']+'/gi,
      /`assets\/[^`]+`/gi,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text))) {
        let s = m[0].replace(/^["'`]|["'`]$/g, "").trim();
        s = s.replace(/^\.\.\//, "");
        s = s.split("?")[0].split("#")[0];
        if (s.startsWith("assets/")) refs.add(s);
      }
    }
    const urlInner = /url\(\s*["']?((?:\.\.\/)?assets\/[^)"']+)["']?\s*\)/gi;
    let um;
    while ((um = urlInner.exec(text))) {
      let s = um[1].trim().replace(/^\.\.\//, "");
      s = s.split("?")[0].split("#")[0];
      if (s.startsWith("assets/")) refs.add(s);
    }
    const loose = /\bassets\/[A-Za-z0-9._\-\/가-힣()%\uAC00-\uD7A3]+/gi;
    let lm;
    while ((lm = loose.exec(text))) {
      let s = lm[0].replace(/[,;.\s]+$/, "");
      if (/[\/]$/.test(s)) continue;
      if (
        !/\.(png|jpe?g|gif|svg|webp|mp4|pdf|otf|csv|json|JPG|PNG|JPEG)$/i.test(s) &&
        !/\/[^.\/]+$/.test(s)
      )
        continue;
      refs.add(s.split("?")[0].split("#")[0]);
    }
  }

  function walkProject(relDir) {
    const full = path.join(PROJECT_ROOT, relDir);
    if (!fs.existsSync(full)) return;
    for (const ent of fs.readdirSync(full, { withFileTypes: true })) {
      const name = ent.name;
      if (name === "node_modules" || name === ".git") continue;
      const rel = relDir ? `${relDir}/${name}` : name;
      const fp = path.join(full, name);
      if (ent.isDirectory()) {
        walkProject(rel.replace(/\\/g, "/"));
      } else if (shouldScanFile(rel)) {
        extractFromText(readUtf8(fp));
      }
    }
  }

  walkProject("");
  return refs;
}

function consultingCompanyNames() {
  const html = readUtf8(path.join(PROJECT_ROOT, "consulting.html"));
  const names = new Set();
  const re = /<p[^>]*class="[^"]*industry-logo-name[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html))) {
    let inner = m[1].replace(/<br\s*\/?>/gi, "").replace(/\s+/g, " ").trim();
    inner = inner.replace(/<[^>]+>/g, "").trim();
    if (inner && !/^대표 고객사\s*\d+$/.test(inner) && !/^기업명\s*\d+$/.test(inner)) {
      names.add(inner);
    }
  }
  const attrRe = /data-company-logo-name="([^"]*)"/g;
  while ((m = attrRe.exec(html))) {
    const v = (m[1] || "").trim();
    if (v) names.add(v);
  }
  return names;
}

function diagnosisAssetFiles() {
  const csvPath = path.join(PROJECT_ROOT, "diagnosis-data", "type_assets.csv");
  const txt = readUtf8(csvPath);
  const files = new Set();
  if (!txt) return files;
  const lines = txt.split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    const fname = parts[2];
    if (fname && /\.(png|jpe?g|gif|webp|svg)$/i.test(fname)) {
      files.add(`assets/diagnosis/${fname}`);
    }
  }
  return files;
}

function main() {
  const assetFiles = walkDir(path.join(PROJECT_ROOT, "assets")).map((f) => `assets/${f}`);

  const referenced = collectStaticReferences();
  for (const d of diagnosisAssetFiles()) referenced.add(d);

  const companyNames = consultingCompanyNames();
  const companySet = new Set(companyNames);

  for (const name of companyNames) {
    referenced.add(`assets/customer-logos/${name}.png`);
    referenced.add(`assets/customer-logos/${name}.svg`);
    referenced.add(`assets/customer-logos/${encodeURIComponent(name)}.png`);
    referenced.add(`assets/customer-logos/${encodeURIComponent(name)}.svg`);
  }

  const refLower = new Set([...referenced].map((r) => r.toLowerCase()));

  function isReferenced(filePath) {
    const n = filePath.replace(/\\/g, "/");
    if (referenced.has(n) || refLower.has(n.toLowerCase())) return true;

    if (n.startsWith("assets/customer-logos/")) {
      const base = path.basename(n);
      const stem = base.replace(/\.(png|svg|jpe?g|gif|webp)$/i, "");
      let decoded = stem;
      try {
        decoded = decodeURIComponent(stem);
      } catch (_) {}
      if (companySet.has(stem) || companySet.has(decoded)) return true;
    }

    return false;
  }

  let unreferenced = assetFiles.filter((f) => !isReferenced(f));
  unreferenced = unreferenced.filter((f) => !/\/\.gitkeep$/.test(f) && f !== "assets/images/.gitkeep");
  unreferenced.sort();

  const outLines = [
    "=== 코드·데이터에서 참조되지 않는 assets 파일 (" + unreferenced.length + "개) ===",
    "",
    ...unreferenced,
    "",
    "--- 포함된 참조 규칙 ---",
    "• 정적 문자열: 프로젝트 내 .html .css .js .json .csv 등에서 따옴표·url() 안의 assets/… 및 ../assets/…",
    "• 진단: diagnosis-data/type_assets.csv 의 imageFileName → assets/diagnosis/…",
    "• 컨설팅 로고: consulting.html 의 industry-logo-name 등 기업명과 일치하는 customer-logos 파일",
    "• 경로 대소문자는 Windows 기준으로 동일하면 참조된 것으로 간주",
    "",
    "삭제 전: 스크립트가 동적 로드·런타임 조합 경로는 포착하지 못할 수 있습니다.",
  ];
  const reportPath = path.join(PROJECT_ROOT, "scripts", "unreferenced-assets-report.txt");
  fs.writeFileSync(reportPath, outLines.join("\n"), "utf8");

  console.log("=== 코드·데이터에서 참조되지 않는 assets 파일 (" + unreferenced.length + "개) ===\n");
  unreferenced.forEach((x) => console.log(x));
  console.log("\n저장됨: scripts/unreferenced-assets-report.txt");
  console.log("\n--- 포함된 참조 규칙 ---");
  console.log("정적 경로·CSS url(): 프로젝트 소스에서 추출 (공백 포함 파일명 포함)");
  console.log("진단: diagnosis-data/type_assets.csv 의 imageFileName → assets/diagnosis/…");
  console.log(
    "컨설팅 로고: consulting.html 의 industry-logo-name·data-company-logo-name 에 대응하는 customer-logos 파일명(기업명과 일치하는 png/svg)"
  );
}

main();
