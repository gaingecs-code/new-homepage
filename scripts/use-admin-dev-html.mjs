/**
 * 로컬에서 `npm run dev` 시에만 실행: Vite 개발용 엔트리(index.dev.html)를 index.html 로 복사합니다.
 * 배포본은 index.html 이 빌드 결과(번들 스크립트)를 가리켜야 하므로 저장소에는 그 상태를 유지합니다.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminDir = path.join(__dirname, "..", "admin");
const dev = path.join(adminDir, "index.dev.html");
const target = path.join(adminDir, "index.html");

if (!fs.existsSync(dev)) {
  console.error("[use-admin-dev-html] admin/index.dev.html 이 없습니다.");
  process.exit(1);
}
fs.copyFileSync(dev, target);
console.log("[use-admin-dev-html] index.dev.html → index.html (로컬 개발용)");
