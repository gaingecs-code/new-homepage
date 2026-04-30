import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  // Vercel 등에서 /admin 경로에 배포할 때 JS/CSS를 /admin/assets/... 로 올바르게 로드
  base: "/admin/",
  plugins: [react()],
  // 배포용 index.html(번들 링크)은 sync로 복사되므로, 빌드 엔트리는 항상 개발용 HTML만 사용
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, "index.dev.html"),
    },
  },
});
