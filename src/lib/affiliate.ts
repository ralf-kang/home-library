/**
 * 도서 구매 링크(수익화 골격). 제휴 코드가 설정된 서점만 '제휴' 로 표시한다(공정위 추천·보증 심사지침).
 *
 *  - 알라딘 TTB: ALADIN_TTB_KEY 가 있으면 상품 링크에 ttbkey 를 붙인다(알라딘 Open API 제휴 방식).
 *    ※ 정확한 적립 조건은 TTB 관리 페이지에서 확인할 것(docs/monetization.md).
 *  - 쿠팡 파트너스: 딥링크 API(HMAC)가 필요해 지금은 링크를 만들지 않는다(문서에 후보로만 둠).
 *  - 교보문고·예스24: 일반 검색 링크(제휴 없음). 예스24 제휴는 링크프라이스 가입 후 추가 예정.
 */
export interface PurchaseLink {
  store: string
  url: string
  affiliate: boolean
}

export function purchaseLinks(book: { isbn13?: string | null; title: string; authors?: string | null }): PurchaseLink[] {
  const q = encodeURIComponent(book.isbn13 || `${book.title} ${book.authors ?? ''}`.trim())
  const ttb = process.env.ALADIN_TTB_KEY
  const aladin = book.isbn13
    ? `https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${book.isbn13}`
    : `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&SearchWord=${q}`
  return [
    {
      store: '알라딘',
      url: ttb ? `${aladin}${aladin.includes('?') ? '&' : '?'}partner=openAPI&start=api&ttbkey=${encodeURIComponent(ttb)}` : aladin,
      affiliate: Boolean(ttb),
    },
    { store: '교보문고', url: `https://search.kyobobook.co.kr/search?keyword=${q}`, affiliate: false },
    { store: '예스24', url: `https://www.yes24.com/Product/Search?query=${q}`, affiliate: false },
  ]
}

export const AFFILIATE_NOTICE = '제휴 링크로 구매하면 서비스 운영에 쓰이는 소정의 수수료를 받을 수 있습니다(구매 가격은 같습니다).'
