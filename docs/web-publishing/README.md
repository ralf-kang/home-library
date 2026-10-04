# 우리집 서재 웹 퍼블리싱 설계 자료

2026-10-04 제작. 먼저 [design-guide.html](design-guide.html)을 브라우저로 여세요. 서버 없이도 에셋 갤러리, 파일 검색, 모션 시연, 반응형 시안을 확인할 수 있습니다.

| 파일 | 내용 |
| --- | --- |
| [design-guide.html](design-guide.html) | 서비스 검토, 디자인 토큰, 페이지별 설계, 에셋 갤러리, 모션, 개발·검수 기준 |
| [landing-preview.html](landing-preview.html) | 제작 에셋으로 구성한 반응형 랜딩 시안. 실제 인증·저장 기능 없음 |
| [asset-contact-sheet.png](asset-contact-sheet.png) | 생성 사진과 벡터 에셋 모아보기 |
| [../../src/img/asset-manifest.json](../../src/img/asset-manifest.json) | 웹용 22개 파일의 사용 페이지·alt·치수·용량·SHA-256 |
| [image-prompts.json](image-prompts.json) | 내장 image_gen 생성 프롬프트 3개와 PNG 출처 |
| [next-image-example.tsx.txt](next-image-example.tsx.txt) | Next.js 히어로 이미지 연결 예제 |
| [scan-motion-example.tsx.txt](scan-motion-example.tsx.txt) | 사용자 요청 시 재생하는 촬영 안내 예제 |
| [validation-report.json](validation-report.json) | 디코딩·해시·모션 정적 규칙·상대 경로·XML 검사 결과와 한계 |
| [review-notes.json](review-notes.json) | 서비스 확인 방법과 확인 범위 |

에셋은 `C:\hyper-v\home-library\src\img`에 있습니다. 사진 원본 3개, 크기별 WebP 6개, SVG 16개(그중 애니메이션 2개)입니다. 기존 앱 페이지는 수정·배포하지 않았습니다.

설계서와 함께 프로젝트의 폴더 구조를 보존해 공유하세요. 폰트·이미지 CDN이나 외부 JS 없이 동작합니다. 설계서 안의 기술 참고 링크만 외부 문서로 이동합니다. 기존 서비스 로고는 `src/app/icon.svg`를 참조합니다.

## 재생성 / 검증

프로젝트 루트에서 실행합니다. `node`와 `py`가 PATH에 있어야 하며, `sharp`·`typescript`는 현재 프로젝트의 설치본을 사용합니다. 외부 패키지를 추가하지 않았습니다.

```powershell
node docs/web-publishing/optimize-images.cjs
py docs/web-publishing/build-vector-assets.py
py docs/web-publishing/build-guide.py
node docs/web-publishing/validate-assets.cjs
py docs/web-publishing/validate-guide.py
node --check docs/web-publishing/design-guide.html.script-0.js
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

사진은 `_masters`의 PNG에서 재압축됩니다. 그 파일이 없을 때만 image-prompts.json에 기록한 최초 생성 경로를 복사합니다. 이 스크립트는 AI 생성 API를 재호출하지 않습니다. 생성 사진을 변경하려면 프롬프트를 사용해 새 이미지를 생성하고 새 이름으로 보관하세요.

SVG 수정: build-vector-assets.py → 재생성. 설계서 수정: design-guide.template.html → build-guide.py. 검증 결과는 파일을 다시 생성할 때 갱신해야 합니다.

실제 브라우저 세션이 제공되지 않아 HTML 레이아웃·애니메이션의 브라우저 재생·실기기·스크린리더 검수는 남아 있습니다. 사진은 직접 시각 확인했고 SVG는 contact sheet로 확인했습니다. 현재 서비스의 랜딩은 HTTP 200과 반환된 HTML로, 로그인 뒤 페이지는 소스로 검토했습니다.
