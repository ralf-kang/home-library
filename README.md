# 우리집 서재 (home-library)

집에 있는 책을 데이터베이스로 관리하는 가족용 웹 서비스입니다.
책 위치 검색, 읽기 기록·독후감, 취향 대시보드, 구매 추천·위시리스트를 제공합니다.

- 기획서: 「우리집 서재 관리 서비스 기획서」(Claude Docs)
- 스택: Next.js 16(App Router) · Prisma 5 · PostgreSQL(통합 운영 DB) · Tailwind 4 · Docker

## 주요 기능

| 영역 | 기능 |
| --- | --- |
| 도서 DB | ISBN 조회·바코드 스캔 등록, 서가 사진 일괄 등록(Claude가 책등 판독), 수동 등록, 시리즈·권차 |
| 검색 | 제목·저자·출판사·시리즈·태그·독후감 통합 검색, 초성 검색(ㅅㅍㅇㅅ), ISBN 검색, 분야·위치·소유자·읽음 상태 필터 |
| 서가 위치 | 공간 › 책장 › 칸 트리(코드 `LV-B2-S3`), 칸별 구역(색 라벨), 여러 권 일괄 이동 + 이동 이력 |
| 읽기 기록 | 구성원별 상태(읽고 싶음·읽는 중·완독·중단·참고용), 별점, 날짜, 독후감·인용구·메모, 아이 책 '한 번 더 읽어 줬어요' |
| 취향 | 분야별 장서 대비 완독, 월별 완독, 선호 저자·출판사, 사 놓고 안 읽은 비율 |
| 추천 | '사기 전에, 이 책부터'(집에 있는 미독 장서), 좋아한 저자·도서관 대출 데이터·시리즈 빈 권 후보 → Claude 선정, 위시리스트(구매 완료 시 장서로 전환) |
| 관리 | 구성원·구역·위치 설정, 장서 CSV 내보내기 |

설계 원칙: **서지(Book)와 소장본(Copy)을 분리**합니다. 독후감은 서지에, 위치·상태·대여는 소장본에 붙습니다.
대여·반납(Loan) 테이블은 2차 범위로 구조만 만들어 두었습니다.

## 로컬 실행

```bash
npm ci
cp .env.example .env          # DATABASE_URL, AUTH_SECRET, FAMILY_PIN만 채워도 실행됩니다
npx prisma db push            # 스키마 생성
npm run db:seed:demo          # (선택) 시연용 데이터 — 기존 데이터를 지웁니다. 운영에서 실행 금지
npm run dev                   # http://localhost:3000
```

검증 명령: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`

로컬 PostgreSQL이 없으면 Docker로 띄울 수 있습니다:
`docker run -d --name hl-pg -e POSTGRES_PASSWORD=devpass -p 5432:5432 postgres:16`

## 외부 API 키(모두 선택)

키가 없으면 해당 기능만 꺼지고 나머지는 동작합니다. 자세한 설명은 `.env.example`.

| 변수 | 용도 |
| --- | --- |
| `KAKAO_REST_API_KEY` | ISBN·제목으로 서지·표지 채우기, 좋아한 저자의 다른 책 |
| `NL_SEOJI_API_KEY` | 국립중앙도서관 ISBN 서지정보(KDC 분류 → 분야 자동 추정) |
| `DATA4LIBRARY_API_KEY` | 도서관 정보나루 마니아·다독자 추천도서 |
| `ANTHROPIC_API_KEY` | 서가 사진 책등 판독, 추천 10권 선정·이유 |

비용 통제: 사진 판독은 칸 사진 1장당 1회 호출(긴 변 2,576px로 줄여 전송), 추천은 '추천 갱신'을 누를 때만(구성원별 10분에 1회) 호출합니다.

## 운영 배포(.20 서버)

배포 대상은 `deploy.target`(server1, 192.168.0.20). DB는 `shared-db-net`의 통합 PostgreSQL(`shared-postgres`)을 씁니다.

1. **DB·계정 만들기(최초 1회)** — shared-postgres에 관리자 권한으로 접속해 실행:

   ```sql
   CREATE ROLE home_library_app LOGIN PASSWORD '<NAS secrets에 보관할 비밀번호>';
   CREATE DATABASE home_library_db OWNER home_library_app;
   ```

2. **`.env.local` 작성** — `.env.example`을 복사해 채웁니다. `DATABASE_URL`은 완성된 문자열이어야 합니다
   (`postgresql://home_library_app:<비밀번호>@shared-postgres:5432/home_library_db`).
3. **기동** — `docker compose up -d --build`
   - 엔트리포인트가 `prisma db push`(스키마 동기화) → `seed`(구성원이 없을 때만 첫 관리자·기본 구역·예시 공간 생성) → 서버 시작 순으로 실행합니다.
   - 포트: 외부 **3503** → 내부 3000. kang-util `REGISTRY.md`에 등록하세요.
4. **확인** — `curl http://192.168.0.20:3503/api/health` → `{"ok":true,...}`
5. **첫 로그인** — `SEED_ADMIN_NAME` 구성원 + `FAMILY_PIN`. 설정 화면에서 가족 구성원·구역·책장/칸을 만드세요.

### 접속 범위와 HTTPS

- 기본은 **집 내부망 전용**입니다. 독후감·아이 기록이 있으므로 외부 공개 시 HTTPS 리버스 프록시를 두고 `COOKIE_SECURE=1`로 설정하세요.
- 휴대폰 **바코드 스캔은 카메라 권한 때문에 HTTPS(또는 localhost)에서만** 동작합니다. 내부망 HTTP로 접속하면 ISBN을 직접 입력하면 됩니다.

### 백업

통합 PostgreSQL의 정기 백업을 따릅니다. 수동 백업이 필요하면:

```bash
docker exec shared-postgres pg_dump -U home_library_app -Fc home_library_db > home_library_$(date +%F).dump
```

설정 화면의 'CSV 내려받기'로 엑셀용 장서 목록도 받을 수 있습니다.
