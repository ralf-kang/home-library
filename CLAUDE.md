# home-library 작업 특이사항

> 공통 규칙은 루트 `E:\Claude\CLAUDE.md` 참조. 여기는 이 프로젝트에만 해당하는 불변식·주의사항.

## 데이터 모델 불변식
- **서지(Book) ≠ 소장본(Copy)**. 읽기 기록(Reading)·독후감(Note)은 서지에, 위치·상태·소유자·대여(Loan)는
  소장본에 붙인다. 같은 ISBN을 다시 등록하면 서지를 새로 만들지 말고 소장본만 추가한다(`createBook`).
- 소장본은 위치 **ID**를 가리킨다. 위치 코드/이름 변경이 소장본에 영향을 주면 안 된다. 전체 코드(`LV-B2-S3`)는
  저장하지 않고 `src/lib/location.ts`의 `fullCode()`로 매번 계산한다.
- 위치 이동은 반드시 `CopyMove` 이력을 남긴다(`createBook`, `addCopy`, `updateCopy`, `moveCopies`, 사진 등록).
- 위치 트리는 공간(ROOM) › 책장(BOOKCASE) › 칸(SHELF) 3단계 고정. 자식 종류는 부모 종류로 결정된다(`saveLocation`).
- `Book.titleChosung`은 저장 경로마다 `toChosung(title)`로 채운다. 새 저장 경로를 추가할 때 빠뜨리면 초성 검색이 안 된다.

## 인가 경계
- `src/proxy.ts`는 Edge 런타임 — `jose`만 import(prisma 금지). `/login`, `/api/health` 외 전부 세션 필요.
- proxy만 믿지 않는다: **모든 페이지·서버 액션·API 라우트 최상단**에서 `requireMember()` 또는 `requireAdmin()`
  (`src/server/auth.ts`)을 호출한다. 집 데이터를 바꾸는 작업(등록·위치·삭제·설정·사진 판독·CSV)은 `requireAdmin()`.
  읽기 기록·독후감·위시리스트는 본인 것만 바꿀 수 있다(액션 안에서 memberId 확인).
- 로그인은 구성원 선택 + 가족 공용 PIN(`FAMILY_PIN`). 구성원별 in-memory 실패 제한(10분 5회).

## seed
- `prisma/seed.ts`(운영, 컨테이너 기동마다 실행): **구성원이 0명일 때만** 동작해야 한다. 가족이 설정에서 바꾼 값을
  덮어쓰지 말 것. Dockerfile에서 이 파일 하나만 tsc로 컴파일하므로 `@/…`·`src/` import 금지.
- `prisma/seed-demo.ts`: 로컬 시연용, **모든 데이터를 지운다**. 운영(NODE_ENV=production)에서는 거부한다.

## 외부 API
- 카카오·국립중앙도서관·정보나루·Claude 모두 best-effort: 키가 없거나 실패해도 예외를 밖으로 던지지 말고 빈 결과로
  처리해 수동 입력/규칙 기반으로 계속 동작하게 한다(`src/lib/book-lookup.ts`, `src/server/recommend.ts`).
- Claude 호출은 `src/lib/claude.ts`에만 둔다. 모델은 `ANTHROPIC_MODEL`(기본 `claude-opus-5-5`), 거절 대비 서버측
  fallback(`fallbacks: 'default'`)을 켜 두었다. 추천은 후보 목록의 index로만 고르게 해 없는 책을 지어내지 못하게 한다.

## UI 주의
- Tailwind 4: `@apply`로 조합할 공통 클래스는 `globals.css`에서 `@utility`로 선언해야 한다(`.class {}` 불가).
- 모바일 하단 탭(`MobileNav`)은 header 밖에서 렌더한다 — header의 `backdrop-blur`가 `position: fixed`의 기준이 된다.
- 서버 액션 후 `revalidatePath`로 다시 그려도 비제어 입력의 `defaultValue`는 갱신되지 않는다. 저장 후 값이 바뀌어야 하는
  폼은 필드를 `key`로 다시 마운트한다(책 상세의 읽기 기록 폼 참고).

## 배포
- `.20`(server1), 외부 포트 3503 → 내부 3000, DB는 `shared-db-net`의 `shared-postgres`. compose로 DB를 띄우지 말 것.
- entrypoint는 `prisma db push`(마이그레이션 이력 없음) → seed → 서버. 정식 마이그레이션을 시작하면 `migrate deploy`로 전환.
