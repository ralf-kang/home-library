import 'server-only'
import { normalizeIsbn } from './isbn'

/**
 * 외부 서지 API 조회. 모두 "있으면 쓰고 없으면 건너뛰는" best-effort다 —
 * 키가 없거나 응답이 이상해도 예외를 던지지 않고 빈 결과를 돌려준다(수동 입력으로 진행 가능).
 *
 *  - 카카오 책 검색:      KAKAO_REST_API_KEY  (https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide)
 *  - 국립중앙도서관 서지: NL_SEOJI_API_KEY    (ISBN 서지정보 유통지원시스템 Open API, KDC 분류 보강용)
 *  - 도서관 정보나루:     DATA4LIBRARY_API_KEY (마니아/다독자 추천도서 — 추천 후보용, recommend.ts)
 */

export interface BookCandidate {
  isbn13: string | null
  title: string
  authors: string
  publisher: string
  pubYear: number | null
  coverUrl: string | null
  description: string | null
  kdc: string | null
  source: 'kakao' | 'nl' | 'data4library'
}

const TIMEOUT_MS = 8000

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[book-lookup] ${new URL(url).host} → HTTP ${res.status}`)
      return null
    }
    return await res.json()
  } catch (e) {
    console.warn(`[book-lookup] ${new URL(url).host} 실패:`, (e as Error).message)
    return null
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim()
}

// ── 카카오 ────────────────────────────────────────────────────────────────

interface KakaoDoc {
  title?: string
  authors?: string[]
  publisher?: string
  isbn?: string
  datetime?: string
  thumbnail?: string
  contents?: string
}

function fromKakao(d: KakaoDoc): BookCandidate {
  const isbns = str(d.isbn).split(/\s+/)
  const isbn13 = isbns.map((i) => normalizeIsbn(i)).find(Boolean) ?? null
  const year = Number(str(d.datetime).slice(0, 4))
  return {
    isbn13,
    title: str(d.title),
    authors: (d.authors ?? []).join(', '),
    publisher: str(d.publisher),
    pubYear: Number.isFinite(year) && year > 1000 ? year : null,
    coverUrl: str(d.thumbnail) || null,
    description: str(d.contents) || null,
    kdc: null,
    source: 'kakao',
  }
}

export function isKakaoConfigured() {
  return Boolean(process.env.KAKAO_REST_API_KEY)
}

export async function kakaoSearch(query: string, target?: 'isbn' | 'title' | 'person', size = 10): Promise<BookCandidate[]> {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key || !query.trim()) return []
  const params = new URLSearchParams({ query, size: String(size) })
  if (target) params.set('target', target)
  const data = (await fetchJson(`https://dapi.kakao.com/v3/search/book?${params}`, {
    headers: { Authorization: `KakaoAK ${key}` },
  })) as { documents?: KakaoDoc[] } | null
  return (data?.documents ?? []).map(fromKakao).filter((b) => b.title)
}

// ── 국립중앙도서관 ISBN 서지정보 ───────────────────────────────────────────

interface SeojiDoc {
  TITLE?: string
  AUTHOR?: string
  PUBLISHER?: string
  EA_ISBN?: string
  SET_ISBN?: string
  KDC?: string
  TITLE_URL?: string
  PUBLISH_PREDATE?: string
  BOOK_INTRODUCTION_URL?: string
}

export async function nlLookupIsbn(isbn13: string): Promise<BookCandidate | null> {
  const key = process.env.NL_SEOJI_API_KEY
  if (!key) return null
  const params = new URLSearchParams({
    cert_key: key,
    result_style: 'json',
    page_no: '1',
    page_size: '1',
    isbn: isbn13,
  })
  const data = (await fetchJson(`https://www.nl.go.kr/seoji/SearchApi.do?${params}`)) as { docs?: SeojiDoc[] } | null
  const d = data?.docs?.[0]
  if (!d || !str(d.TITLE)) return null
  const year = Number(str(d.PUBLISH_PREDATE).slice(0, 4))
  return {
    isbn13: normalizeIsbn(str(d.EA_ISBN)) ?? isbn13,
    title: stripTags(str(d.TITLE)),
    authors: str(d.AUTHOR).replace(/(^|\s)(지음|저|글|그림|옮김|역)(?=\s|;|,|$)/g, ' ').replace(/\s+/g, ' ').replace(/\s*;\s*/g, ', ').trim(),
    publisher: str(d.PUBLISHER),
    pubYear: Number.isFinite(year) && year > 1000 ? year : null,
    coverUrl: str(d.TITLE_URL) || null,
    description: null,
    kdc: str(d.KDC) || null,
    source: 'nl',
  }
}

/**
 * ISBN 하나로 서지를 조회한다. 카카오(표지·소개)를 우선 쓰고, 국립중앙도서관 결과가 있으면
 * KDC를 보강한다. 둘 다 없으면 null.
 */
export async function lookupIsbn(rawIsbn: string): Promise<BookCandidate | null> {
  const isbn13 = normalizeIsbn(rawIsbn)
  if (!isbn13) return null
  const [kakao, nl] = await Promise.all([kakaoSearch(isbn13, 'isbn', 1), nlLookupIsbn(isbn13)])
  const k = kakao[0]
  if (k) return { ...k, isbn13: k.isbn13 ?? isbn13, kdc: nl?.kdc ?? null, coverUrl: k.coverUrl ?? nl?.coverUrl ?? null }
  return nl
}

/**
 * KDC 분류번호로 가족 분야를 추정한다. 사람이 등록 화면에서 언제든 고칠 수 있는 기본값일 뿐이다.
 * 참고: KDC 0 총류(004/005 컴퓨터), 1 철학, 2 종교, 3 사회과학(32 경제, 325 경영, 37 교육),
 *       4 자연과학, 5 기술과학, 6 예술, 7 언어, 8 문학, 9 역사.
 */
export function guessCategory(kdc: string | null | undefined, ageGroup: 'ADULT' | 'CHILD' = 'ADULT'): string {
  if (ageGroup === 'CHILD') return '어린이 한글 그림책'
  const k = (kdc ?? '').trim()
  if (!k) return '미분류'
  if (/^00[0-9]/.test(k) || /^56[0-9]/.test(k)) return 'IT·개발·데이터'
  if (/^325/.test(k)) return '경영·업무·자기계발'
  if (/^32/.test(k)) return '경제·투자·재테크'
  if (/^37/.test(k) || /^2/.test(k)) return '육아·교육·종교'
  switch (k[0]) {
    case '1':
    case '3':
      return '인문·철학·사회'
    case '4':
    case '5':
    case '6':
      return '과학·교양'
    case '8':
      return '문학·소설'
    case '9':
      return '역사'
    default:
      return '미분류'
  }
}
