# 우리집 서재 — 활용 가능한 공개 API 목록

> 조사일 2026-10-04. ✅ = 데이터 ID·엔드포인트를 직접 확인, ⚠️ = 세부 스펙·한도를 아직 확인하지 못함(2차 자료 기준).
> data.go.kr 공통: `serviceKey` 인증, 개발계정 자동승인(보통 **일 10,000건**), 활용사례 등록 시 운영계정으로 한도 상향.
> **구현** 열: ● 구현됨 / ○ 다음 단계 / – 검토만.

## 서비스에 넣는 위치 요약

| 화면 | 쓰는 API |
|---|---|
| 대시보드 「우리 가족을 위한 정보」 | 전국도서관표준데이터, 정보나루 인기대출(지역·초등), 국중도 사서추천 |
| 동네 화면 「동네 도서관」 | 전국도서관표준데이터 |
| 책 상세 「근처 도서관에서도 빌릴 수 있어요」 | 정보나루 libSrchByBook + bookExist |
| 서재 설정(지역 저장 시) | 행안부 법정동코드 |
| 등록·추천(기존) | 카카오 책 검색, 국중도 ISBN 서지(seoji), 정보나루 recommandList |
| 검색 「내용으로 찾기」 | Google Books API v1 |
| 추천·위시 「구매」 | 알라딘 TTB(제휴 링크) |

환경변수: `DATA_GO_KR_SERVICE_KEY`, `DATA4LIBRARY_API_KEY`, `NL_OPEN_API_KEY`(없으면 `NL_SEOJI_API_KEY`로 시도), `GOOGLE_BOOKS_API_KEY`, `ALADIN_TTB_KEY`.
모두 선택이며 키가 없거나 호출이 실패하면 해당 위젯만 숨긴다(`src/lib/public-data.ts`, best-effort).

---

## 1. 도서·서지

| API / 제공기관 | ID·URL | 핵심 파라미터 → 응답 | 활용 | 우선 | 구현 |
|---|---|---|---|---|---|
| **도서관 정보나루 Open API** (국립중앙도서관) | ✅ data4library.kr/apiUtilization | `authKey`. `srchDtlList`(isbn13→표지·KDC·소개), `keywordList`(키워드), `usageAnalysisList`(함께 대출), `recommandList`(mania/reader), `hotTrend`, `monthlyKeywords` | 추천(사용 중), 취향 키워드 클라우드, "이 책과 함께 빌린 책" | P1 | ● 추천 / ○ 키워드 |
| **국립중앙도서관 사서추천도서** | ✅ data.go.kr **15064371** · `nl.go.kr/NL/search/openApi/saseoApi.do` | `key, startRowNumApi, endRowNumApi, drCode` → 제목·저자·ISBN·표지·소개(XML) | 대시보드 「이달의 사서 추천」 | P1 | ● |
| **국립어린이청소년도서관 사서추천도서** (KCISA) | ✅ data.go.kr **15104976** · `api.kcisa.kr/openapi/API_LIB_052/request` ⚠️ | 유아/초등 저·고/청소년 연령별, 격월 | 아이 프로필 연령별 추천 | P1 | ○ |
| 국립세종도서관 새로들어온책 (KCISA 652) | ⚠️ culture.go.kr | 일반·어린이 신착 | 신간 피드 | P2 | – |
| 출판유통통합전산망 Open API (출판진흥원) | ✅ bnk.kpipa.or.kr | ONIX 도서 상세, 출판사 정보 | 정가·판형 보강(일반 서비스 이용 가능 여부 확인 필요) | P3 | – |
| **알라딘 TTB Open API** | ✅ blog.aladin.co.kr/openapi/5353290 | `ItemSearch`, `ItemLookUp(ISBN13)`, `ItemList(Bestseller/ItemNewAll)` → 표지·가격·링크 | 구매 링크(제휴), 베스트셀러 | P1 | ● 링크 / ○ 가격 |
| 카카오 책 검색 | developers.kakao.com | `query, target` → 서지·표지 | 등록·추천(기존) | — | ● |
| Google Books API v1 | ✅ developers.google.com/books | `q=` **전문(full-text) 검색**, `maxResults≤40`, `industryIdentifiers`로 ISBN 반환. 한국 도서 수록은 적음 ⚠️ | 「내용으로 찾기」 1단계 | P1 | ● |

## 2. 도서관

| API | ID·URL | 핵심 | 활용 | 우선 | 구현 |
|---|---|---|---|---|---|
| **전국도서관표준데이터** (문체부·지자체) | ✅ data.go.kr **15013109** · `api.data.go.kr/openapi/tn_pubr_public_lbrry_api` | `CTPRVN_NM, SIGNGU_NM, type=json, numOfRows≤1000` → 도서관명·유형·휴관일·운영시간·주소·전화·홈페이지·위경도 (연 1회 갱신, 작은도서관 포함) | 동네 도서관 목록·오늘 휴관·지도 링크 | P1 | ● |
| 정보나루 `libSrchByBook` | ✅ | `isbn, region` → 이 책을 가진 도서관 | 책 상세 「근처 도서관」 1단계 | P1 | ● |
| 정보나루 `bookExist` | ✅ | `libCode, isbn13` → `hasBook`, `loanAvailable` | 「대출 가능/대출 중」 표시 | P1 | ● |
| 정보나루 `loanItemSrch` | ✅ | 기간·성별·**연령**·지역·KDC → 순위·ISBN·대출 건수 | 지역 인기 대출, 초등 인기 | P1 | ● |
| 정보나루 `libSrch` | ✅ | region → libCode·주소·휴관일 | 표준데이터 ↔ libCode 매핑 | P1 | ○ |
| 정보나루 `readQt`, `usageTrend` | ✅ | 지역 독서량 / 요일·시간대 대출 추이 | 가족 독서량 vs 지역 평균, 한산한 시간 | P2 | – |

## 3. 가족에게 도움이 되는 정보

| API | ID | 활용 | 우선 | 구현 |
|---|---|---|---|---|
| 한국문화정보원 한눈에보는문화정보 | ✅ **15138937** | 이번 주말 가족 공연·전시(지역·기간·좌표) | P2 | – |
| 전국공연행사정보표준데이터 | ✅ **15013106** | 관람 연령으로 어린이 행사 필터 | P2 | – |
| 전국문화축제표준데이터 | ✅ **15013104** | 책 축제·북페스티벌 | P3 | – |
| 문체부 문화예술공연(통합) | ✅ **15121487** | 위 항목과 중복 검토 | P3 | – |
| 소상공인 상가(상권)정보 | ✅ **15012005** | 「동네 서점」 지도(서점 업종 코드 검증 필요 ⚠️) | P2 | – |
| 도서관 독서 프로그램 전국 API | ⚠️ 미확인 | 지자체 포털별 개별 연동 필요 | P3 | – |

## 4. 동네(지역)

| API | ID | 활용 | 우선 | 구현 |
|---|---|---|---|---|
| **행정안전부 법정동코드** | ✅ **15077871** · `apis.data.go.kr/1741000/StanReginCd/getStanReginCdList` | 서재·동네 지역을 법정동 코드로 정규화 | P1 | ● (지역 저장 시 코드 조회) |
| 도로명주소 검색/좌표 API (행안부) | ✅ juso.go.kr, data.go.kr 15056797·15096712 | 주소 입력 → 행정구역코드·좌표 | P1 | ○ |
| 국토부 전국 법정동(파일) | ✅ 15063424 | 시드 데이터 | P2 | – |

## 5. 기타(나들이 보조)

| API | ID | 활용 | 우선 |
|---|---|---|---|
| 에어코리아 대기오염정보 | ✅ 15073861 | "미세먼지 나쁨 — 도서관 실내 나들이" 배너 | P3 |
| 기상청 단기예보 | ✅ 15084084 | 주말 행사 카드 날씨 | P3 |

---

## 확인된 외부 제약

- **Google Custom Search JSON API**: "closed to new customers", 기존 고객도 **2027-01-01**까지 이전해야 함. → 쓰지 않는다.
  대안: Google Books 전문 검색(채택), Vertex AI Search(지정 코퍼스용), Gemini API Grounding with Google Search(유료·LLM 응답 근거용).
  우리 서비스는 「Google Books → 서재 매칭」, 결과 0건이면 「Claude가 서재 목록 안에서만 고르기」(키 있을 때, 가구당 시간 20회)로 보완한다.
- **Google OAuth 리디렉션 URI**: HTTPS 필수(단, `localhost` 예외), **IP 주소 호스트 불가**, TLD 는 Public Suffix List 에 있어야 함(nip.io 비권장).
  → 랩 테스트는 `deploy.ps1 tunnel`(http://localhost:3503), 운영은 자체 도메인 + HTTPS.

## 구현 전에 확인할 것(⚠️)

정보나루 일일 호출 한도와 JSON 지원 범위 · KCISA 엔드포인트 정확한 경로 · juso.go.kr 호출 한도 · 알라딘 TTB 현행 적립률 · 쿠팡 딥링크 경로.

## 출처

data.go.kr 각 데이터 페이지(위 ID) · https://www.data4library.kr/apiUtilization · https://blog.aladin.co.kr/openapi/5353290 ·
https://developers.google.com/custom-search/v1/overview · https://developers.google.com/books/docs/v1/using ·
https://developers.google.com/identity/protocols/oauth2/web-server · https://ai.google.dev/gemini-api/docs/pricing
