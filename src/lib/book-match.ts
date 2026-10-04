/**
 * 외부 검색 결과(Google Books 등)를 우리 서재 책과 맞춰 보는 순수 함수(테스트 대상).
 * ISBN-13 이 같으면 확실한 일치, 아니면 정규화한 제목(+저자 성)으로 비교한다.
 */
import { normalizeIsbn } from './isbn'

export interface ExternalHit {
  isbns: string[]
  title: string
  authors: string[]
  snippet: string | null
}

export interface LibraryBook {
  id: string
  isbn13: string | null
  title: string
  authors: string
}

/** 비교용 제목: 괄호·부제·권차 숫자·공백·문장부호를 없애고 소문자로. */
export function normalizeTitle(title: string): string {
  return title
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .split(/[:：\-–—]/)[0]
    .replace(/\d+\s*(권|편|부)?\s*$/u, '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
}

function authorKey(a: string): string {
  return a.replace(/\s|지음|옮김|글|그림/g, '').toLowerCase()
}

export function matchLibrary(hits: ExternalHit[], books: LibraryBook[]): Map<string, ExternalHit> {
  const byIsbn = new Map<string, LibraryBook>()
  const byTitle = new Map<string, LibraryBook[]>()
  for (const b of books) {
    if (b.isbn13) byIsbn.set(b.isbn13, b)
    const t = normalizeTitle(b.title)
    if (t.length >= 2) byTitle.set(t, [...(byTitle.get(t) ?? []), b])
  }
  const out = new Map<string, ExternalHit>()
  for (const h of hits) {
    const isbnHit = h.isbns.map((i) => byIsbn.get(normalizeIsbn(i) ?? '')).find(Boolean)
    if (isbnHit) {
      if (!out.has(isbnHit.id)) out.set(isbnHit.id, h)
      continue
    }
    const candidates = byTitle.get(normalizeTitle(h.title)) ?? []
    if (candidates.length === 0) continue
    // 제목이 같은 책이 여러 권이면 저자로 좁힌다. 저자 정보가 없으면 제목만으로 인정.
    const hAuthors = h.authors.map(authorKey).filter(Boolean)
    const picked =
      candidates.length === 1 && hAuthors.length === 0
        ? candidates
        : candidates.filter((b) => hAuthors.length === 0 || hAuthors.some((a) => authorKey(b.authors).includes(a) || a.includes(authorKey(b.authors))))
    for (const b of picked) if (!out.has(b.id)) out.set(b.id, h)
  }
  return out
}
