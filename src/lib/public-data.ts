import 'server-only'
import { normalizeIsbn } from './isbn'

/**
 * 공공데이터 연동(docs/public-apis.md 의 P1). 모두 best-effort — 키가 없거나 실패하면 빈 결과를 돌려
 * 위젯만 숨긴다. 자주 바뀌지 않는 데이터라 Next fetch 캐시(revalidate)로 하루 단위 재사용한다.
 *
 *  - 전국도서관표준데이터(data.go.kr 15013109)        DATA_GO_KR_SERVICE_KEY
 *  - 행정안전부 법정동코드(data.go.kr 15077871)       DATA_GO_KR_SERVICE_KEY
 *  - 도서관 정보나루 loanItemSrch / libSrchByBook / bookExist   DATA4LIBRARY_API_KEY
 *  - 국립중앙도서관 사서추천도서(data.go.kr 15064371)   NL_OPEN_API_KEY (없으면 NL_SEOJI_API_KEY 로 시도)
 */

const DAY = 86400

async function getJson(url: string, revalidate = DAY): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate } })
    if (!res.ok) {
      console.warn(`[public-data] ${new URL(url).host} → HTTP ${res.status}`)
      return null
    }
    const text = await res.text()
    // data.go.kr 은 키 오류 시 200 + XML(OpenAPI_ServiceResponse)을 돌려준다
    if (text.trimStart().startsWith('<')) {
      console.warn(`[public-data] ${new URL(url).host} → XML 응답(키·파라미터 확인): ${text.slice(0, 160)}`)
      return null
    }
    return JSON.parse(text)
  } catch (e) {
    console.warn(`[public-data] ${new URL(url).host} 실패:`, (e as Error).message)
    return null
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
}

/** "경기도 성남시 분당구 정자동" → 시도 "경기도", 시군구 "성남시 분당구" */
export function splitRegion(regionName: string | null | undefined): { sido: string; sigungu: string } | null {
  const parts = (regionName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  const sido = parts[0]
  const rest = parts.slice(1)
  // 시군구: '시'+'구' 두 단어(성남시 분당구)거나 한 단어(강남구, 양평군)
  const sigungu = rest.length >= 2 && /시$/.test(rest[0]) && /구$/.test(rest[1]) ? `${rest[0]} ${rest[1]}` : (rest[0] ?? '')
  return { sido, sigungu }
}

// ── 전국도서관표준데이터 ─────────────────────────────────────────────────

export interface Library {
  name: string
  kind: string
  address: string
  phone: string
  homepage: string
  closeDay: string
  weekday: string
  saturday: string
  holiday: string
  lat: number | null
  lng: number | null
  closedToday: boolean
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/** 휴관일 문구("매주 월요일, 법정공휴일")에 오늘 요일이 들어 있으면 휴관으로 본다(공휴일 판단은 하지 않음). */
export function isClosedOn(closeDay: string, date: Date): boolean {
  const d = WEEKDAY_KO[date.getDay()]
  if (/연중무휴/.test(closeDay)) return false
  // "매주 월요일" 또는 구분자로 나뉜 한 글자 요일("월, 공휴일" / "월·화")
  return new RegExp(`${d}요일|(^|[\\s,·/+])${d}($|[\\s,·/+])`).test(closeDay)
}

export async function librariesInRegion(regionName: string | null | undefined, limit = 12): Promise<Library[]> {
  const key = process.env.DATA_GO_KR_SERVICE_KEY
  const region = splitRegion(regionName)
  if (!key || !region?.sigungu) return []
  const params = new URLSearchParams({ serviceKey: key, pageNo: '1', numOfRows: '1000', type: 'json', CTPRVN_NM: region.sido })
  const data = (await getJson(`https://api.data.go.kr/openapi/tn_pubr_public_lbrry_api?${params}`)) as {
    response?: { body?: { items?: Record<string, unknown>[] } }
  } | null
  const now = new Date()
  const hm = (a: unknown, b: unknown) => (str(a) && str(b) ? `${str(a).slice(0, 5)}~${str(b).slice(0, 5)}` : '')
  return (data?.response?.body?.items ?? [])
    .filter((i) => str(i.signguNm).replace(/\s/g, '').includes(region.sigungu.replace(/\s/g, '')))
    .map((i) => {
      const closeDay = str(i.closeDay)
      return {
        name: str(i.lbrryNm),
        kind: str(i.lbrrySe),
        address: str(i.rdnmadr) || str(i.lnmadr),
        phone: str(i.phoneNumber),
        homepage: str(i.homepageUrl),
        closeDay,
        weekday: hm(i.weekdayOperOpenHhmm, i.weekdayOperColseHhmm),
        saturday: hm(i.satOperOperOpenHhmm, i.satOperCloseHhmm),
        holiday: hm(i.holidayOperOpenHhmm, i.holidayCloseOpenHhmm),
        lat: Number(i.latitude) || null,
        lng: Number(i.longitude) || null,
        closedToday: isClosedOn(closeDay, now),
      }
    })
    .filter((l) => l.name)
    .sort((a, b) => Number(a.kind.includes('작은')) - Number(b.kind.includes('작은')) || a.name.localeCompare(b.name, 'ko'))
    .slice(0, limit)
}

// ── 법정동 코드 ──────────────────────────────────────────────────────────

/** 지역명으로 법정동 코드(10자리)를 찾는다. 시군구까지 맞는 첫 코드. */
export async function lookupRegionCode(regionName: string): Promise<string | null> {
  const key = process.env.DATA_GO_KR_SERVICE_KEY
  if (!key || !regionName.trim()) return null
  const params = new URLSearchParams({ serviceKey: key, pageNo: '1', numOfRows: '10', type: 'json', locatadd_nm: regionName.trim() })
  const data = (await getJson(`https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList?${params}`, DAY * 30)) as {
    StanReginCd?: { row?: { region_cd?: string; locatadd_nm?: string }[] }[]
  } | null
  const rows = data?.StanReginCd?.flatMap((x) => x.row ?? []) ?? []
  return rows.find((r) => r.region_cd)?.region_cd ?? null
}

// ── 도서관 정보나루 ──────────────────────────────────────────────────────

// 정보나루 지역 코드(시도)
const D4L_REGION: Record<string, string> = {
  서울: '11', 부산: '21', 대구: '22', 인천: '23', 광주: '24', 대전: '25', 울산: '26', 세종: '29',
  경기: '31', 강원: '32', 충청북: '33', 충북: '33', 충청남: '34', 충남: '34', 전라북: '35', 전북: '35',
  전라남: '36', 전남: '36', 경상북: '37', 경북: '37', 경상남: '38', 경남: '38', 제주: '39',
}

export function d4lRegionCode(regionName: string | null | undefined): string | null {
  const sido = splitRegion(regionName)?.sido ?? ''
  const hit = Object.keys(D4L_REGION).find((k) => sido.startsWith(k))
  return hit ? D4L_REGION[hit] : null
}

export interface PopularBook {
  rank: number
  title: string
  authors: string
  isbn13: string | null
  coverUrl: string | null
  loans: number
}

/** 지역(시도) 인기 대출 도서. age: 0 영유아, 6 유아, 8 초등, 14 청소년(정보나루 연령 코드). */
export async function popularLoans(regionName: string | null | undefined, opts: { age?: number; size?: number } = {}): Promise<PopularBook[]> {
  const key = process.env.DATA4LIBRARY_API_KEY
  const region = d4lRegionCode(regionName)
  if (!key) return []
  const end = new Date()
  const start = new Date(end.getTime() - 30 * DAY * 1000)
  const params = new URLSearchParams({
    authKey: key,
    startDt: start.toISOString().slice(0, 10),
    endDt: end.toISOString().slice(0, 10),
    pageNo: '1',
    pageSize: String(opts.size ?? 10),
    format: 'json',
  })
  if (region) params.set('region', region)
  if (opts.age != null) params.set('age', String(opts.age))
  const data = (await getJson(`http://data4library.kr/api/loanItemSrch?${params}`)) as {
    response?: { docs?: { doc?: Record<string, unknown> }[] }
  } | null
  return (data?.response?.docs ?? [])
    .map((d) => d.doc ?? {})
    .map((b) => ({
      rank: Number(b.ranking) || 0,
      title: str(b.bookname),
      authors: str(b.authors),
      isbn13: normalizeIsbn(str(b.isbn13)),
      coverUrl: str(b.bookImageURL) || null,
      loans: Number(b.loan_count) || 0,
    }))
    .filter((b) => b.title)
}

export interface LibraryHolding {
  name: string
  libCode: string
  address: string
  homepage: string
  loanAvailable: boolean | null
}

/** 이 책을 가진 우리 지역 도서관과 지금 대출 가능 여부(최대 limit곳). */
export async function nearbyHoldings(isbn13: string, regionName: string | null | undefined, limit = 5): Promise<LibraryHolding[]> {
  const key = process.env.DATA4LIBRARY_API_KEY
  const region = d4lRegionCode(regionName)
  if (!key || !region) return []
  const params = new URLSearchParams({ authKey: key, isbn: isbn13, region, pageNo: '1', pageSize: '20', format: 'json' })
  const data = (await getJson(`http://data4library.kr/api/libSrchByBook?${params}`, 3600)) as {
    response?: { libs?: { lib?: Record<string, unknown> }[] }
  } | null
  const sigungu = splitRegion(regionName)?.sigungu.replace(/\s/g, '') ?? ''
  const libs = (data?.response?.libs ?? [])
    .map((l) => l.lib ?? {})
    .map((l) => ({ name: str(l.libName), libCode: str(l.libCode), address: str(l.address), homepage: str(l.homepage) }))
    .filter((l) => l.libCode)
    // 같은 시군구 도서관을 앞으로
    .sort((a, b) => Number(!a.address.replace(/\s/g, '').includes(sigungu)) - Number(!b.address.replace(/\s/g, '').includes(sigungu)))
    .slice(0, limit)
  return Promise.all(
    libs.map(async (l) => {
      const p = new URLSearchParams({ authKey: key, libCode: l.libCode, isbn13, format: 'json' })
      const r = (await getJson(`http://data4library.kr/api/bookExist?${p}`, 600)) as { response?: { result?: { loanAvailable?: string } } } | null
      const v = r?.response?.result?.loanAvailable
      return { ...l, loanAvailable: v === 'Y' ? true : v === 'N' ? false : null }
    }),
  )
}

// ── 국립중앙도서관 사서추천도서 ──────────────────────────────────────────

export interface LibrarianPick {
  title: string
  authors: string
  publisher: string
  isbn13: string | null
  coverUrl: string | null
  summary: string
}

function xmlTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))
  return (m?.[1] ?? '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
}

/** 이달 사서추천도서(XML 응답). */
export async function librarianPicks(size = 6): Promise<LibrarianPick[]> {
  const key = process.env.NL_OPEN_API_KEY || process.env.NL_SEOJI_API_KEY
  if (!key) return []
  const params = new URLSearchParams({ key, startRowNumApi: '1', endRowNumApi: String(size) })
  try {
    const res = await fetch(`https://nl.go.kr/NL/search/openApi/saseoApi.do?${params}`, { signal: AbortSignal.timeout(8000), next: { revalidate: DAY } })
    if (!res.ok) return []
    const xml = await res.text()
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map((m) => m[1])
      .map((b) => ({
        title: xmlTag(b, 'recomtitle') || xmlTag(b, 'recom_title'),
        authors: xmlTag(b, 'recomauthor') || xmlTag(b, 'recom_author'),
        publisher: xmlTag(b, 'recompublisher') || xmlTag(b, 'recom_publisher'),
        isbn13: normalizeIsbn(xmlTag(b, 'recomisbn') || xmlTag(b, 'recom_isbn')),
        coverUrl: xmlTag(b, 'recomfilepath') || xmlTag(b, 'recom_file_path') || null,
        summary: (xmlTag(b, 'recomcontens') || xmlTag(b, 'recom_contents')).slice(0, 140),
      }))
      .filter((p) => p.title)
  } catch (e) {
    console.warn('[public-data] 사서추천 실패:', (e as Error).message)
    return []
  }
}

export function isPublicDataConfigured() {
  return {
    dataGoKr: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
    data4library: Boolean(process.env.DATA4LIBRARY_API_KEY),
    nl: Boolean(process.env.NL_OPEN_API_KEY || process.env.NL_SEOJI_API_KEY),
  }
}
