# 우리집 서재 이미지 에셋

웹 퍼블리싱용 사진 3종, WebP 해상도 변형 6개, 직접 제작 SVG 16개입니다. SVG에는 1회 재생 모션 2개와 정지 대체본 2개가 포함됩니다.

- 설계서와 시안: [design-guide.html](../../docs/web-publishing/design-guide.html)
- 파일별 페이지·크기·alt·용량·해시: [asset-manifest.json](asset-manifest.json)
- 생성 프롬프트: [image-prompts.json](../../docs/web-publishing/image-prompts.json)
- 개발 예제: [next-image-example.tsx.txt](../../docs/web-publishing/next-image-example.tsx.txt), [scan-motion-example.tsx.txt](../../docs/web-publishing/scan-motion-example.tsx.txt)

| 폴더 | 사용 |
| --- | --- |
| `_masters` | 생성 PNG 원본 3개. 웹에서 직접 사용하지 않음 |
| `photos` | 최적화 WebP. 가족=랜딩, 독서 공간=로그인, 책 나눔=동네 |
| `illustrations` | 온보딩·초대·서가·검색·기록·표지 없음 상태 |
| `icons` | 랜딩의 기능 카드 6종 |
| `motion` | 책장 촬영 안내 3.6초, 등록 완료 0.9초, 각각 정지 대체본 |

파일명은 `{page-or-feature}-{purpose}-{subject}[-{width}].{ext}`이며 ASCII kebab-case를 사용합니다.

Next.js에서는 `import hero from '@/img/photos/landing-hero-family-reading-1536.webp'`처럼 가져와 `next/image`에 전달하세요. `src/img`는 정적 공개 URL이 아닙니다. SVG 모션에는 `unoptimized`를 사용합니다. 일반 HTML에서 `/img/...` URL로 사용하려면 필요한 파일만 `public/img`에 별도 복사해야 합니다.

가족·이웃 사진은 원본 3:2 비율을 유지합니다. 로그인 사진은 4:5입니다. SVG는 `contain`으로 표시합니다. 인접 제목을 되풀이하는 장식 그림은 `alt=""`로 처리하고, 독립 정보가 있는 사진에는 매니페스트의 alt를 사용하세요. 실제 표지·프로필·도서 제목을 생성 사진으로 대체하지 않습니다.

모션은 자동 반복하지 않습니다. 촬영 안내는 사용자가 요청할 때, 완료 모션은 서버 저장 성공 뒤에만 사용하세요. `prefers-reduced-motion: reduce`에서 동작을 제거하며 정지 대체본도 제공합니다.

생성 사진: 내장 `image_gen.imagegen`. SVG: 기존 로고 색상에 맞춘 직접 작성 벡터. 기존 로고나 실제 앱 화면을 수정·배포하지 않았습니다.
