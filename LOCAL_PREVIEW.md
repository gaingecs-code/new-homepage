# 로컬에서 사이트·영상 미리보기

## 왜 `file://`로 `index.html`을 열면 안 되나요?

Chrome 등은 `file://` 페이지를 **특별한 보안 규칙**으로 다룹니다.  
같은 폴더의 `assets/태향.mp4`라도 **iframe·일부 미디어**가 막히거나, 콘솔에 `file: URLs are treated as unique security origins` 경고가 뜰 수 있습니다.  
**이건 배포 코드가 잘못된 것이 아니라, 로컬 열기 방식** 때문입니다.

## 권장: HTTP로 열기 (로컬 = 실제 서버에 가깝게)

1. 터미널에서 **이 폴더(`new hop`)**로 이동합니다.
2. 실행:
   - `npm start`  
   (또는 `npx --yes serve -l 5500 .`)
3. 브라우저에서 **http://localhost:5500/index.html** (또는 루트로 자동 열림)으로 확인합니다.

Node.js가 없다면 Python 예: `python -m http.server 5500` 후 `http://localhost:5500/index.html`  
또는 VS Code / Cursor **Live Server**로 **프로젝트 루트**를 연 뒤 동일하게 확인하세요.

## 웹에 배포했을 때

- `https://도메인/...` + `assets/…` **상대 경로**는 **일반적인 정적 호스팅**과 동일합니다.
- `file://` 한정 이슈는 **나타나지 않습니다.** (동일 출처로 HTML·mp4를 서빙하면 됩니다.)
- `admin/` React 앱은 별도 빌드·배포 정책이 있을 수 있으나, 루트 `index.html` 정적 사이트는 위와 같이 유지하면 됩니다.
