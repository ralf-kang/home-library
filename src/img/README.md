# 우리집 서재 이미지 에셋

사진 6종(WebP 12개), SVG 16개, 영상 2종(MP4·WebM 각 1개), 영상 포스터 2개로 웹용 미디어는 총 34개입니다. PNG 원본 6개와 한국어 자막·대본 4개를 별도 보관합니다. SVG에는 1회 재생 모션 2개와 정지 대체본 2개가 포함됩니다.

- 설계서와 시안: [design-guide.html](../../docs/web-publishing/design-guide.html)
- 추가 이미지·영상 재생: [media-preview.html](../../docs/web-publishing/media-preview.html)
- 추가 이미지 프롬프트: [image-prompts-additional.json](../../docs/web-publishing/image-prompts-additional.json)
- 영상 연결 예제: [video-example.tsx.txt](../../docs/web-publishing/video-example.tsx.txt)
- 파일별 페이지·크기·alt·용량·해시: [asset-manifest.json](asset-manifest.json)
- 생성 프롬프트: [image-prompts.json](../../docs/web-publishing/image-prompts.json)
- 개발 예제: [next-image-example.tsx.txt](../../docs/web-publishing/next-image-example.tsx.txt), [scan-motion-example.tsx.txt](../../docs/web-publishing/scan-motion-example.tsx.txt)

| 폴더 | 사용 |
| --- | --- |
| `_masters` | 생성 PNG 원본 6개. 웹에서 직접 사용하지 않음 |
| `photos` | 최적화 WebP. 가족=랜딩, 독서 공간=로그인, 책 나눔=동네 |
| `illustrations` | 온보딩·초대·서가·검색·기록·표지 없음 상태 |
| `icons` | 랜딩의 기능 카드 6종 |
| `motion` | 책장 촬영 안내 3.6초, 등록 완료 0.9초, 각각 정지 대체본 |
| `video` | 각 12초·720p·24fps·무음 영상, MP4·WebM·포스터·한국어 VTT·대본 TXT |

## 추가 에셋 사용 위치

| 파일명 | 사용 페이지 |
| --- | --- |
| `photos/me-reading-journal-desk-{768,1536}.webp` | `/me`, `/books/[id]` 독서 기록 첫 사용 안내 |
| `photos/recommend-unread-books-selection-{768,1536}.webp` | `/recommend` 미독 도서 소개 |
| `photos/add-photo-shelf-framing-{768,1536}.webp` | `/add/photo`, `/#how` 촬영 구도 안내 |
| `video/landing-family-library-story-720p.{mp4,webm}` | `/`, `/#how` 소개 영상 |
| `video/add-photo-three-step-guide-720p.{mp4,webm}` | `/add/photo`, `/#how` 사진 등록 3단계 |

추가 사진과 영상은 16:9입니다. 소개 영상은 생성 사진의 이동·장면 전환 편집이며, 촬영 안내는 직접 제작한 벡터 모션그래픽입니다. 실제 앱 녹화가 아닙니다. 같은 접두사의 `-poster.webp`, `-ko.vtt`, `-transcript.txt`를 묶어서 사용하세요.

영상은 구현 시 필요한 파일을 `public/img/video`로 복사한 뒤 `/img/video/...`로 연결합니다. `next/image`로 MP4를 import하지 않습니다. 현재 영상은 src에 보관하며 앱에는 아직 연결하지 않았습니다. `controls playsInline preload="none"`과 포스터를 사용하고 자동 재생·반복은 사용하지 않습니다. VTT는 영상과 같은 HTTP 출처로 제공하고 HTML 대본을 함께 제공합니다.

파일명은 `{page-or-feature}-{purpose}-{subject}[-{width}].{ext}`이며 ASCII kebab-case를 사용합니다.

Next.js에서는 `import hero from '@/img/photos/landing-hero-family-reading-1536.webp'`처럼 가져와 `next/image`에 전달하세요. `src/img`는 정적 공개 URL이 아닙니다. SVG 모션에는 `unoptimized`를 사용합니다. 일반 HTML에서 `/img/...` URL로 사용하려면 필요한 파일만 `public/img`에 별도 복사해야 합니다.

가족·이웃 사진은 원본 3:2 비율을 유지합니다. 로그인 사진은 4:5입니다. SVG는 `contain`으로 표시합니다. 인접 제목을 되풀이하는 장식 그림은 `alt=""`로 처리하고, 독립 정보가 있는 사진에는 매니페스트의 alt를 사용하세요. 실제 표지·프로필·도서 제목을 생성 사진으로 대체하지 않습니다.

모션은 자동 반복하지 않습니다. 촬영 안내는 사용자가 요청할 때, 완료 모션은 서버 저장 성공 뒤에만 사용하세요. `prefers-reduced-motion: reduce`에서 동작을 제거하며 정지 대체본도 제공합니다.

생성 사진: 내장 `image_gen.imagegen`. SVG: 기존 로고 색상에 맞춘 직접 작성 벡터. 기존 로고나 실제 앱 화면을 수정·배포하지 않았습니다.
