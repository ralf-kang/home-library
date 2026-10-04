# 우리집 서재 (home-library)

가족이 함께 쓰는 서재 관리·독서 기록 서비스이고, 동네 이웃과 책을 나누는 플랫폼으로 확장하고 있습니다.
구글 계정으로 회원가입 없이 시작하고, 가족과 동네 이웃을 서로 다른 권한으로 초대합니다.

- 스택: Next.js 16(App Router) · Prisma 5 · PostgreSQL(통합 운영 DB) · Tailwind 4 · Docker(Node 24 이미지)
- 로컬 개발: Node 22 이상(`@zxing/library`가 Node 24, `vitest`가 Node 22 이상을 요구)
- 개발·문의: ralfkang@outlook.com

## 주요 기능

| 영역 | 기능 |
| --- | --- |
| 계정·가구 | 구글 로그인(회원가입 없음), 서재(가구) 여러 개·전환, 가족 역할 소유자/관리자/구성원/아이, 계정 없는 아이 프로필(어른이 대리 기록) |
| 초대 | 가족 초대 링크(역할·이메일 지정·횟수·7일 만료), 동네 이웃 초대 링크 — 이웃은 '대여 가능' 책만 열람 |
| 첫 화면 | 취향 대시보드: 가족 전체(장서·이번 달 완독·구성원별 진행·최근 활동·분야별 완독) + 구성원별 취향 |
| 서가 | 표지 중심 서가(칸 = 선반 한 줄), 공간 › 책장 › 칸 트리, 여러 권 선택 이동 + 이동 이력 |
| 검색 | 제목·저자·출판사·시리즈·태그·소개·메모·독후감, 초성(ㅅㅍㅇㅅ)·ISBN, **내용으로 찾기**(Google Books 본문 검색 → 우리 서재 매칭, 보조로 Claude) |
| 기록 | 읽기 상태·별점·날짜, 독후감·인용구·메모, 아이 책 '한 번 더 읽어 줬어요' |
| 추천 | 집에 있는데 안 읽은 책 먼저, 좋아한 저자·도서관 대출 데이터·시리즈 빈 권 후보 → Claude 선정, 위시리스트, 구매 링크 |
| 동네 | 공유 서가, 대여 요청 → 승인 → 반납, 동네 도서관(운영시간·휴관), 후원 배너 자리 |
| 공공데이터 | 우리 동네 도서관, 지역·초등 인기 대출, 사서 추천, 근처 도서관 대출 가능 여부 — `docs/public-apis.md` |
| 운영 | `/admin`: 가입·활성 지표, 외부 연동 상태, 후원 배너 관리. 수익화는 골격만(전부 무료) — `docs/monetization.md` |
| 공개 페이지 | 랜딩(소개·취지·사용 방법·FAQ), 이용약관, 개인정보처리방침, 요금 안내 |

설계 원칙:
- **멀티 테넌트**: 모든 데이터는 가구(Household) 단위로 나뉘고, 모든 조회에 가구 조건을 겁니다(`CLAUDE.md`).
- **서지와 소장본 분리**: 독후감은 서지(Book)에, 위치·상태·대여는 소장본(Copy)에 붙습니다.

## 로컬 실행

```bash
npm ci
cp .env.example .env          # DATABASE_URL, AUTH_SECRET 그리고 아래 중 하나
                              #  - 구글: APP_URL=http://localhost:3000, GOOGLE_CLIENT_ID/SECRET
                              #  - 테스트: ENABLE_DEV_LOGIN=1 (이메일만으로 로그인)
npx prisma db push            # 스키마 생성
npm run db:seed:demo          # (선택) '데모 서재' + 테스트 계정 dad@demo.local / mom@demo.local
npm run dev                   # http://localhost:3000
```

검증 명령: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`

로컬 PostgreSQL이 없으면 Docker로 띄울 수 있습니다:
`docker run -d --name hl-pg -e POSTGRES_PASSWORD=devpass -p 5432:5432 postgres:16`

## 구글 로그인 설정

1. [Google Cloud Console](https://console.cloud.google.com) → API 및 서비스 → **OAuth 동의 화면**에 다음을 입력합니다.
   - 앱 이름: 우리집 서재
   - 지원 이메일
   - 홈페이지: `APP_URL`
   - 개인정보처리방침: `APP_URL/privacy`
   - 이용약관: `APP_URL/terms`
2. **사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션)**를 만들고, 승인된 리디렉션 URI에 `APP_URL/api/auth/google/callback`을 넣습니다.
3. `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`을 설정합니다.

> 구글은 리디렉션 URI로 **HTTPS 또는 `http://localhost`만 허용하고 IP 주소는 받지 않습니다.**
> 운영 서버에는 도메인과 HTTPS 리버스 프록시가 필요하고(`COOKIE_SECURE=1`), 랩 테스트는 `localhost`로 포트포워딩합니다.

## 외부 API 키(모두 선택)

키가 없으면 해당 기능만 꺼지고 나머지는 동작합니다. 자세한 설명은 `.env.example`과 `docs/public-apis.md`에 있습니다.

| 변수 | 용도 |
| --- | --- |
| `KAKAO_REST_API_KEY` | ISBN·제목으로 서지·표지 채우기, 좋아한 저자의 다른 책 |
| `NL_SEOJI_API_KEY` / `NL_OPEN_API_KEY` | 국립중앙도서관 ISBN 서지(KDC) / 사서추천도서 |
| `DATA4LIBRARY_API_KEY` | 정보나루: 추천, 지역·연령 인기대출, 근처 도서관 소장·대출 가능 |
| `DATA_GO_KR_SERVICE_KEY` | 공공데이터포털: 전국도서관표준데이터, 법정동코드 |
| `GOOGLE_BOOKS_API_KEY` | 책 내용으로 찾기 |
| `ANTHROPIC_API_KEY` | 서가 사진 책등 판독, 추천 선정·이유, 내용 검색 보조 |
| `ALADIN_TTB_KEY` | 구매 링크 제휴(수익화) |

## 운영 배포(.20 서버)

배포 대상은 `deploy.target`(server1, 192.168.0.20)입니다. DB는 `shared-db-net`의 통합 PostgreSQL(`shared-postgres`)을 씁니다.

1. **DB·계정 만들기(최초 1회)**: shared-postgres에 관리자 권한으로 접속해 실행합니다.

   ```sql
   CREATE ROLE home_library_app LOGIN PASSWORD '<NAS secrets에 보관할 비밀번호>';
   CREATE DATABASE home_library_db OWNER home_library_app;
   ```

2. **`.env.local` 작성**: `.env.example`을 복사해 채웁니다. 운영에서는 `ENABLE_DEV_LOGIN`을 비워 두고 `COOKIE_SECURE=1`로 설정합니다.
3. **도메인·HTTPS**: 구글 로그인에 필요합니다. 리버스 프록시를 거쳐 3503으로 연결하고 `APP_URL`을 그 주소로 설정합니다.
4. **기동**: `docker compose up -d --build`
   - 엔트리포인트는 `prisma db push` → seed(변경 없음) → 서버 순으로 실행됩니다.
   - 포트는 외부 **3503** → 내부 3000입니다. kang-util `REGISTRY.md`에 등록하세요.
5. **확인**: `curl https://<도메인>/api/health` → `{"ok":true,...}`
6. **첫 사용**: 구글로 로그인 → 온보딩에서 서재 만들기 → 설정에서 위치·가족 초대를 진행합니다.

> MVP(PIN 로그인) 스키마에서 바로 올리면 `db push`가 파괴적 변경을 이유로 멈춥니다. MVP 데이터가 운영에 없을 때만 새 DB로 시작하세요.

### 백업

통합 PostgreSQL의 정기 백업을 따릅니다. 수동 백업이 필요하면 다음을 실행합니다.

```bash
docker exec shared-postgres pg_dump -U home_library_app -Fc home_library_db > home_library_$(date +%F).dump
```

서재 설정의 'CSV 내려받기'로 엑셀용 장서 목록도 받을 수 있습니다.

## 로컬 테스트 클러스터(k8s-lab)

`C:\hyper-v\k8s-lab\apps\home-library\README.md`를 참고하세요. 주요 명령은 다음과 같습니다.
- `deploy.ps1 all`: 빌드 → 이미지 → 배포
- `deploy.ps1 demo`: 데모 데이터 생성
- `deploy.ps1 secret -Key GOOGLE_CLIENT_ID`: Secret 값 넣기
- `deploy.ps1 tunnel`: `http://localhost:3503`으로 구글 로그인 테스트
