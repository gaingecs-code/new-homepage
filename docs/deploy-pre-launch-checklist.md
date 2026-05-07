# 웹 배포 전 체크리스트 (자동 점검 결과 요약)

이 문서는 배포 직전 **저장소에서 확인 가능한 항목**을 기록합니다. Vercel 대시보드는 사람이 확인해야 하는 항목만 목록으로 남깁니다.

## 자동 점검 (로컬에서 확인됨)

| 항목 | 결과 |
|------|------|
| `npm run vercel-build` | 성공 (루트에서 실행 시 admin 설치·Vite 빌드·`sync-admin-dist`까지 완료) |
| `node scripts/check-asset-paths.js` | **Missing: 0** |
| `assets/비즈니스 로드맵.pdf` | 저장소에 존재 (`consulting` 페이지 로드맵 iframe 연결용) |
| `admin/dist` Git 추적 | **추적하지 않음** (`admin/.gitignore`의 `dist`) |
| 루트 `package-lock.json` | 존재 (커밋 권장) |
| `admin/package-lock.json` | 존재 (커밋 유지 권장) |

## Vercel 프로젝트 (배포 전 사람이 확인)

- **Build Command**: `npm run vercel-build` (`vercel.json`과 동일)
- **Output Directory**: `.` (프로젝트 루트 전체 배포)
- **Node 버전**: `package.json`의 `engines.node`는 `>=18` — Vercel 프로젝트 설정과 맞출 것

### Admin 환경 변수 (Production)

`admin/.env.example` 참고. Vercel **Production**에 다음을 설정합니다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_STORAGE_MODE` — Supabase 로그인·원격 연동 시 **`remote`** (미설정 시 기본은 로컬 초안 모드)

빌드 시점에 주입되므로 변수 추가·변경 후 **재배포**가 필요합니다.

## 보안 (npm audit)

- **admin**: `xlsx` 패키지에 reported high 이슈가 있으나 **현재 npm에서 수정 버전 없음** (`npm audit` 참고).
- 용도: 관리자 전용 문의 목록 **엑셀 내보내기** (`admin/src/lib/inquiriesXlsx.js`). 신뢰할 수 있는 관리자만 사용한다는 전제에서 배포 후 주기적으로 재확인하면 됩니다.

## Admin SPA 리라이트 (중요)

`/admin/:path*` 를 모두 `index.html`로 보내면 **`/admin/assets/*.js` 번들까지 HTML로 리라이트**되어 화면이 하얗게 나올 수 있습니다. `vercel.json`에서는 **`/admin/assets/` 로 시작하지 않는 경로만** SPA로 넘기도록 구분했습니다.

## 배포 후에 진행할 항목

- 프로덕션 URL에서 핵심 페이지·폼·`/admin` 로그인 스모크 테스트
- 문의 API·CORS (`docs/inquiry-api-contract.md`와 실제 엔드포인트 일치)
- `404`/SPA 리라이트 동작 확인
