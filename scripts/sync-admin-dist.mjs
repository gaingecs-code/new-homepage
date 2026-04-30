/**
 * admin 앱 Vite 빌드 결과(admin/dist)를 사이트의 /admin URL에 맞게 admin/ 아래로 복사합니다.
 * Vercel 빌드 후 실행되며, 배포 시 JS가 /admin/assets/... 를 불러오도록 합니다.
 *
 * 로컬에서 이 스크립트를 실행하면 admin/index.html 이 배포용으로 덮어씌워집니다.
 * 빌드 엔트리는 index.dev.html 이므로, 덮어쓴 뒤에도 다음 빌드는 실패하지 않습니다.
 * 로컬 개발: admin 에서 npm run dev (index.dev.html → index.html 복사 후 Vite)
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "admin", "dist");
const adminDir = path.join(root, "admin");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function main() {
  if (!(await exists(distDir))) {
    console.error("[sync-admin-dist] admin/dist 가 없습니다. admin 폴더에서 npm run build 를 먼저 실행하세요.");
    process.exit(1);
  }

  const distHtml = (await exists(path.join(distDir, "index.dev.html")))
    ? "index.dev.html"
    : "index.html";
  await fs.copyFile(path.join(distDir, distHtml), path.join(adminDir, "index.html"));

  const assetsSrc = path.join(distDir, "assets");
  const assetsDest = path.join(adminDir, "assets");
  if (await exists(assetsDest)) await fs.rm(assetsDest, { recursive: true });
  if (await exists(assetsSrc)) await copyDir(assetsSrc, assetsDest);

  for (const name of ["favicon.svg", "icons.svg"]) {
    const f = path.join(distDir, name);
    if (await exists(f)) await fs.copyFile(f, path.join(adminDir, name));
  }

  const dataSrc = path.join(distDir, "data");
  const dataDest = path.join(adminDir, "data");
  if (await exists(dataSrc)) {
    if (await exists(dataDest)) await fs.rm(dataDest, { recursive: true });
    await copyDir(dataSrc, dataDest);
  }

  console.log("[sync-admin-dist] admin/dist → admin/ 반영 완료 (index.html, assets, …)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
