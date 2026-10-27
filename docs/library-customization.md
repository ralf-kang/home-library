# 로그인 후 나의 서재 꾸미기

2026-10-05 구현. 로그인 후 `/customize`에서 개인 서재 화면을 꾸밉니다.

## 사용 흐름

1. 대시보드·서가의 **서재 꾸미기**, 또는 우측 계정 메뉴의 **나의 서재 꾸미기**를 엽니다. 관리자용 서재 설정에서도 연결됩니다.
2. 테마 3종, 대표 이미지 6종 또는 없음, 선반 재질 3종, 여유로운/촘촘한 책 배치, 큰 화면의 제목 표시, 개인 환영 문구를 선택합니다.
3. 선택 즉시 오른쪽(모바일은 옵션 아래) 예시가 바뀝니다. 미리보기는 저장 전 실제 화면을 변경하지 않습니다.
4. **꾸미기 저장**을 누르면 계정과 현재 서재의 구성원 정보에 저장합니다. 대시보드·서가에 대표 이미지/문구를, 로그인 화면 내부에 테마 색상을, 서가에 선반 재질·간격을 적용합니다.
5. **변경 취소**는 마지막 저장 상태로, **기본 꾸미기**는 기본 옵션 미리보기로 돌아갑니다. 기본 상태도 저장 버튼을 눌러 확정합니다.

서재의 실제 이름, 공간·책장·칸, 책 위치, 권한, 독서 기록은 바뀌지 않습니다. 다른 가족의 화면과 이웃의 공개 서가는 변경하지 않습니다. 같은 사용자라도 다른 서재의 설정은 독립적입니다. 로그인 가능한 아이 구성원도 자신의 화면을 꾸밀 수 있습니다.

## 저장과 권한

- Prisma `Member.libraryAppearance` → PostgreSQL `members.library_appearance JSONB`, nullable. 기존 데이터가 없거나 유효하지 않으면 기본값을 사용합니다.
- 서버 액션은 매 요청 `requireMember()`로 로그인·현재 구성원 여부를 확인합니다.
- 쓰기 조건은 서버에서 얻은 `member.id + user.id + household.id`입니다. 클라이언트가 구성원 ID를 정할 수 없습니다.
- 화면을 연 뒤 다른 서재로 전환했다면 예전 탭의 저장을 거부합니다.
- 테마/이미지/재질은 허용 목록만 사용합니다. 임의 CSS·외부 이미지 URL은 받지 않습니다. 환영 문구는 40자 이내이며 React 텍스트로 렌더링합니다.
- 저장 실패 시 선택 내용을 유지하고 다시 저장할 수 있습니다. 저장 완료 뒤 해당 사용자 화면 캐시를 갱신합니다.

## 적용 전 DB 준비

새 Prisma client와 애플리케이션을 실행하기 **전에** 아래 추가 SQL을 대상 DB에 적용해야 합니다. 새로운 nullable 열만 추가합니다.

```sql
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "library_appearance" JSONB;
```

파일: [20261005-library-appearance.sql](../prisma/sql/20261005-library-appearance.sql). 프로젝트의 기존 `prisma db push` 배포 절차에도 필드가 포함됩니다. 다른 진행 중인 스키마 변경은 별도로 검토해야 하므로 이 SQL만 적용하면 꾸미기 필드만 추가됩니다.

현재 실행 중인 랩 앱/운영 앱에 이 기능을 배포하지 않았습니다. 검증은 별도의 임시 PostgreSQL DB와 로컬 앱에서 수행합니다.

## 주요 파일

| 경로 | 역할 |
| --- | --- |
| `src/app/(app)/customize/page.tsx` | 로그인·구성원 검사 후 꾸미기 페이지 |
| `src/components/library/LibraryCustomizer.tsx` | 옵션 선택, 미리보기, 저장/취소/초기화 |
| `src/components/library/LibraryCover.tsx` | 대시보드·서가·미리보기에서 공통 표지 |
| `src/components/library/covers.ts` | 생성 사진 6종 매핑 |
| `src/lib/library-appearance.ts` | 기본값, Zod 검증, 테마·선반 토큰 |
| `src/server/actions/library-appearance.ts` | 본인 구성원에 한정한 저장 |
| `src/app/globals.css` | 개인 영역에 한정한 선반 배치·제목 표시 |

대표 이미지의 원본·웹용 파일·프롬프트는 [이미지 README](../src/img/README.md)에 있습니다. 사용자 사진 업로드와 가족 공통 테마 편집은 현재 범위에 포함하지 않았습니다.

## 검증

- `tests/library-appearance.test.ts`: 입력 검증, 로그인 필수, 테넌트/구성원 쓰기 범위, 오래된 탭, 저장 실패.
- `tests/library-appearance.integration.test.ts`: 실제 PostgreSQL 재연결 후 저장 유지, 다른 구성원/다른 서재 격리, 초기화. `APPEARANCE_TEST_DATABASE_URL`이 명시된 전용 `hl_appearance_check_*` DB에서만 실행합니다.
- `docs/web-publishing/check-customization-lab.cjs`: 기존 랩 세션에 임시 DB 생성 → schema/추가 SQL 확인 → 통합 테스트 → 별도 캐시의 로컬 Next.js에서 비로그인 접근 차단 및 로그인 후 화면 응답 확인 → 임시 앱/터널 종료와 DB 제거. 비밀번호는 메모리에만 보관합니다.
- 결과: [customization-validation-report.json](web-publishing/customization-validation-report.json).
- 연결된 브라우저가 없어 클릭·반응형 화면·키보드·스크린리더의 실제 브라우저 검수는 별도로 필요합니다. 서버 HTML 응답 검증은 시각 검수를 대신하지 않습니다.

## UI 검수 기준

360/390/768/1440px에서 옵션과 미리보기가 가로 넘침 없이 보여야 합니다. 라디오/체크박스는 label과 함께 키보드로 조작되고, 저장 결과는 status/alert로 전달됩니다. 모바일은 제목을 항상 표시합니다. 옵션 미리보기의 테마·간격은 바깥의 저장된 테마와 독립적으로 적용됩니다. 자동 재생이나 지속적인 애니메이션을 사용하지 않습니다.
