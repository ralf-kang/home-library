import 'server-only'
import type { ExternalHit } from './book-match'

/**
 * Google Books API v1 전문(full-text) 검색 — "책 내용으로 찾기"의 1단계.
 * q= 는 책 본문·설명까지 검색하므로 "공룡이 나오는 그림책" 같은 내용 질의에 관련 책 목록(ISBN 포함)을 돌려준다.
 * 그 목록을 우리 서재 책과 ISBN·제목으로 맞춰 본다(lib/book-match.ts).
 *
 * GOOGLE_BOOKS_API_KEY 는 권장(키 없이도 낮은 한도로 응답하지만 보장되지 않음). 실패하면 빈 배열(best-effort).
 * 참고: Google Custom Search JSON API 는 신규 가입이 막혀 있어(2027-01-01 종료) 쓰지 않는다.
 */
interface Volume {
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    industryIdentifiers?: { type?: string; identifier?: string }[]
    description?: string
  }
  searchInfo?: { textSnippet?: string }
}

function strip(html: string | undefined): string | null {
  if (!html) return null
  return html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim() || null
}

export async function searchGoogleBooks(query: string, maxPages = 2): Promise<ExternalHit[]> {
  const q = query.trim()
  if (!q) return []
  const out: ExternalHit[] = []
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ q, maxResults: '40', startIndex: String(page * 40), printType: 'books' })
    if (process.env.GOOGLE_BOOKS_API_KEY) params.set('key', process.env.GOOGLE_BOOKS_API_KEY)
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, {
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      })
      if (!res.ok) {
        console.warn(`[google-books] HTTP ${res.status}`)
        break
      }
      const data = (await res.json()) as { items?: Volume[] }
      const items = data.items ?? []
      for (const v of items) {
        const info = v.volumeInfo ?? {}
        if (!info.title) continue
        out.push({
          title: info.title,
          authors: info.authors ?? [],
          isbns: (info.industryIdentifiers ?? []).map((i) => i.identifier ?? '').filter(Boolean),
          snippet: strip(v.searchInfo?.textSnippet) ?? strip(info.description)?.slice(0, 160) ?? null,
        })
      }
      if (items.length < 40) break
    } catch (e) {
      console.warn('[google-books] 실패:', (e as Error).message)
      break
    }
  }
  return out
}
