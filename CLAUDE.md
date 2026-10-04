# home-library 작업 특이사항

> 공통 규칙은 루트 `E:\Claude\CLAUDE.md` 참조. 여기는 이 프로젝트에만 해당하는 불변식·주의사항.

## 플랫폼(멀티 테넌트) 불변식 — 가장 중요
- 로그인 단위는 `User`(구글 계정), 서재 단위는 `Household`(가구). `Member`는 가구 안의 구성원 프로필이며
  구글 계정이 없는 아이도 Member(userId null)로 둔다.
- `Book`·`Location`·`Zone`·`Series`는 `householdId`로 가구에 속한다. Copy·Reading·Note·WishItem 등은 Book/Member를 통해 정해진다.
- **모든 조회·변경에 가구 조건을 건다.** `requireMember()`가 돌려준 `household.id`를 쓰고, 클라이언트가 보낸 id
  (bookId·copyId·locationId·memberId·zoneId)는 `src/server/queries.ts`의 `ownedBook/ownedCopy/ownedLocation/ownedMember/ownedZone`
  으로 그 가구 소속인지 확인한 뒤 쓴다. 새 쿼리를 추가하면 반드시 이 규칙을 지킬 것.
- 같은 ISBN은 **가구 안에서만** 유일(`@@unique([householdId, isbn13])`). 다른 가구는 같은 책을 각자 서지로 가진다.
- 최상위 위치(공간)는 parentId가 null이라 DB unique가 가구를 구분하지 못한다 → `saveLocation`에서 직접 검사.
- 동네 주민에게는 '대여 가능' 소장본의 표지·제목·저자·출판사·서재 이름만 보인다. `src/server/neighborhood.ts`의
  select를 넓히지 말 것(위치·읽기 기록·독후감·구성원 정보 금지).

## 데이터 모델 불변식
- **서지(Book) ≠ 소장본(Copy)**. 읽기 기록(Reading)·독후감(Note)은 서지에, 위치·상태·소유자·대여(Loan)는
  소장본에 붙인다. 같은 ISBN을 다시 등록하면 서지를 새로 만들지 말고 소장본만 추가한다(`createBook`).
- 소장본은 위치 **ID**를 가리킨다. 전체 코드(`LV-B2-S3`)는 저장하지 않고 `src/lib/location.ts`의 `fullCode()`로 매번 계산한다.
- 위치 이동은 반드시 `CopyMove` 이력을 남긴다(`createBook`, `addCopy`, `updateCopy`, `moveCopies`, 사진 등록).
- 위치 트리는 공간(ROOM) › 책장(BOOKCASE) › 칸(SHELF) 3단계 고정. 자식 종류는 부모 종류로 결정된다(`saveLocation`).
- `Book.titleChosung`은 저장 경로마다 `toChosung(title)`로 채운다. 새 저장 경로를 추가할 때 빠뜨리면 초성 검색이 안 된다.

## 인증·인가
- 구글 OIDC(Authorization Code + PKCE)를 `jose`로 직접 구현(`src/lib/google-oidc.ts`). 외부 인증 라이브러리 없음.
  리디렉션 URI 규칙: HTTPS 또는 `http://localhost`만, IP 호스트 불가 → `APP_URL`로 공개 주소를 고정한다.
- 세션 JWT에는 `{ userId, householdId? }`만 담는다. 역할은 매 요청 DB에서 다시 조회한다(`src/server/auth.ts`).
- `src/proxy.ts`는 Edge 런타임 — `jose`만 import(prisma 금지). 공개 경로: `/`, `/terms`, `/privacy`, `/pricing`, `/login`,
  `/invite/*`, `/api/auth/*`, `/api/health`. 그 외 전부 세션 필요.
- proxy만 믿지 않는다: **모든 페이지·서버 액션·API 최상단**에서 `requireUser()` / `requireMember(minRole)` /
  `requireCan(action)` / `requirePlatformAdmin()`. 권한 표는 `src/lib/permissions.ts`(OWNER > ADMIN > MEMBER > CHILD).
- 계정 없는 구성원(아이)의 기록은 `reading.proxy` 권한으로 대리 입력(`asMemberId`). 계정 있는 가족 기록은 본인만.
- 테스트 로그인(`/api/auth/dev`)은 `ENABLE_DEV_LOGIN=1`일 때만 존재. 운영에서 켜지 말 것.
- 초대 토큰은 원문을 저장하지 않고 SHA-256 해시만 둔다. 사용 횟수는 조건부 `updateMany`로 원자적으로 올린다.

## seed
- `prisma/seed.ts`(운영, 컨테이너 기동마다): 지금은 아무것도 바꾸지 않는다(가구는 온보딩에서 `createHousehold`가 만든다).
  Dockerfile에서 이 파일 하나만 tsc로 컴파일하므로 `@/…`·`src/` import 금지.
- `prisma/seed-demo.ts`: '데모 서재' 가구만 지우고 다시 만든다(테스트 계정 dad@demo.local / mom@demo.local).
  운영(NODE_ENV=production)에서는 `ALLOW_DEMO_SEED=1` 없이는 거부.

## 외부 API
- 카카오·국립중앙도서관·정보나루·공공데이터포털·Google Books·Claude 모두 best-effort: 키가 없거나 실패해도 예외를
  밖으로 던지지 말고 빈 결과로 처리해 위젯만 숨긴다(`src/lib/book-lookup.ts`, `src/lib/public-data.ts`, `src/lib/google-books.ts`).
- Claude 호출은 `src/lib/claude.ts`에만 둔다. 추천·내용 검색 보조는 목록의 index로만 고르게 해 없는 책을 지어내지 못하게 한다.
- Google Custom Search JSON API는 신규 가입 불가(2027-01-01 종료) — 쓰지 않는다. 목록은 `docs/public-apis.md`.

## 수익화
- 지금은 전부 무료. `MONETIZATION_ENABLED`가 꺼져 있으면 `limitProblem()`은 항상 통과. 제휴 링크에는 '제휴' 표시 필수.
  후보·판단 기준은 `docs/monetization.md`.

## UI 주의
- Tailwind 4: `@apply`로 조합할 공통 클래스는 `globals.css`에서 `@utility`로 선언해야 한다(`.class {}` 불가).
- 모바일 하단 탭(`MobileNav`)은 header 밖에서 렌더한다 — header의 `backdrop-blur`가 `position: fixed`의 기준이 된다.
- 서버 액션 후 `revalidatePath`로 다시 그려도 비제어 입력의 `defaultValue`는 갱신되지 않는다. 저장 후 값이 바뀌어야 하는
  폼은 필드를 `key`로 다시 마운트한다(책 상세의 읽기 기록 폼 참고).
- React 19 lint(purity): 컴포넌트 렌더 중 `Date.now()` 금지 → 렌더 밖 함수에서 계산(`/admin` 참고).

## 배포
- `.20`(server1), 외부 포트 3503 → 내부 3000, DB는 `shared-db-net`의 `shared-postgres`. compose로 DB를 띄우지 말 것.
- 구글 로그인을 쓰려면 운영에도 도메인 + HTTPS 리버스 프록시가 필요하다(`APP_URL`, `COOKIE_SECURE=1`).
- entrypoint는 `prisma db push`(마이그레이션 이력 없음) → seed → 서버. 파괴적 스키마 변경은 자동 승인하지 않는다.
  정식 마이그레이션을 시작하면 `migrate deploy`로 전환.
- 로컬 테스트 클러스터 배포: `C:\hyper-v\k8s-lab\apps\home-library\deploy.ps1`(README 참고).
