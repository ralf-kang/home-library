import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { matchLibrary } from '@/lib/book-match'
import { isClaudeConfigured, matchByContent } from '@/lib/claude'
import { searchGoogleBooks } from '@/lib/google-books'
import { requireMember } from '@/server/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Claude 보조 단계 비용 통제: 가구별 1시간에 20회(단일 컨테이너라 in-memory)
const aiCalls = new Map<string, number[]>()
const AI_LIMIT = 20

/**
 * 책 내용으로 우리 서재 찾기. ?q=질문
 *  1) Google Books 전문 검색(최대 80건) → ISBN·제목으로 우리 서재 책과 매칭
 *  2) 1에서 0건이고 Claude 키가 있으면, 우리 서재 목록 안에서 내용 관련 책을 고르게 한다(지어내기 불가)
 * 응답에는 우리 가구 책만 담긴다.
 */
export async function GET(req: NextRequest) {
  const { household } = await requireMember()
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 200)
  if (q.length < 2) return Response.json({ error: '두 글자 이상 입력해 주세요.' }, { status: 400 })

  const books = await prisma.book.findMany({
    where: { householdId: household.id },
    select: { id: true, isbn13: true, title: true, authors: true, coverUrl: true, volumeNo: true },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  })
  const hits = await searchGoogleBooks(q)
  const matched = matchLibrary(hits, books)
  let results: { id: string; reason: string | null; via: 'google' | 'ai' }[] = [...matched.entries()].map(([id, h]) => ({
    id,
    reason: h.snippet,
    via: 'google',
  }))

  let aiUsed = false
  if (results.length === 0 && isClaudeConfigured() && books.length > 0) {
    const now = Date.now()
    const recent = (aiCalls.get(household.id) ?? []).filter((t) => now - t < 3600_000)
    if (recent.length < AI_LIMIT) {
      aiCalls.set(household.id, [...recent, now])
      try {
        const pool = books.slice(0, 800)
        results = (await matchByContent(q, pool)).map((m) => ({ id: pool[m.index].id, reason: m.reason, via: 'ai' as const }))
        aiUsed = true
      } catch (e) {
        console.warn('[content-search] Claude 보조 실패:', (e as Error).message)
      }
    }
  }

  const byId = new Map(books.map((b) => [b.id, b]))
  return Response.json({
    q,
    googleHits: hits.length,
    aiUsed,
    items: results.slice(0, 30).map((r) => {
      const b = byId.get(r.id)!
      return { id: b.id, title: b.title, authors: b.authors, coverUrl: b.coverUrl, volumeNo: b.volumeNo, reason: r.reason, via: r.via }
    }),
  })
}
