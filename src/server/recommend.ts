import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { kakaoSearch, type BookCandidate } from '@/lib/book-lookup'
import { normalizeIsbn } from '@/lib/isbn'
import { isClaudeConfigured, pickRecommendations } from '@/lib/claude'
import { buildProfile, describeProfile } from '@/server/profile'
import { seriesGaps } from '@/server/queries'

export interface RecItem {
  isbn13: string | null
  title: string
  authors: string
  publisher: string
  coverUrl: string | null
  reason: string
  source: 'author' | 'library' | 'series'
}

const LIMIT = 10

/** 도서관 정보나루 '마니아/다독자 추천도서'. 키가 없거나 실패하면 빈 배열. */
async function libraryRecommendations(isbn13: string, type: 'mania' | 'reader'): Promise<BookCandidate[]> {
  const key = process.env.DATA4LIBRARY_API_KEY
  if (!key) return []
  const params = new URLSearchParams({ authKey: key, isbn13, type, format: 'json' })
  try {
    const res = await fetch(`http://data4library.kr/api/recommandList?${params}`, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { response?: { docs?: { book?: Record<string, unknown> }[] } }
    return (data.response?.docs ?? [])
      .map((d) => d.book ?? {})
      .map((b) => ({
        isbn13: normalizeIsbn(String(b.isbn13 ?? '')),
        title: String(b.bookname ?? '').trim(),
        authors: String(b.authors ?? '').trim(),
        publisher: String(b.publisher ?? '').trim(),
        pubYear: Number(b.publication_year) || null,
        coverUrl: (b.bookImageURL as string) || null,
        description: null,
        kdc: null,
        source: 'data4library' as const,
      }))
      .filter((b) => b.title)
  } catch {
    return []
  }
}

/**
 * 추천 갱신(기획서 "후보 모으기 → 걸러내기 → 고르기"):
 *  1) 후보: 좋아한 저자의 다른 책(카카오), 도서관 대출 데이터 추천(정보나루), 시리즈 빈 권
 *  2) 걸러내기: 이미 가진 책(ISBN), 위시리스트에 있거나 '관심 없음'을 누른 책 제외
 *  3) 고르기: Claude가 있으면 최대 10권+이유, 없으면 규칙 순서대로 10권
 * '집에 있는데 안 읽은 책'은 매번 DB에서 바로 계산하므로 여기 저장하지 않는다(recommend 페이지).
 */
export async function refreshRecommendations(hid: string, memberId: string) {
  const member = await prisma.member.findFirstOrThrow({ where: { id: memberId, householdId: hid } })
  const profile = await buildProfile(hid, memberId)

  const [ownedIsbns, wishes] = await Promise.all([
    prisma.book.findMany({ where: { householdId: hid, isbn13: { not: null } }, select: { isbn13: true } }),
    prisma.wishItem.findMany({ where: { memberId }, select: { isbn13: true, title: true } }),
  ])
  const excluded = new Set<string>([
    ...ownedIsbns.map((b) => b.isbn13!),
    ...wishes.map((w) => w.isbn13).filter((x): x is string => Boolean(x)),
  ])
  const excludedTitles = new Set(wishes.map((w) => w.title.replace(/\s/g, '')))

  const pool: (BookCandidate & { why: string; kind: RecItem['source'] })[] = []
  const seen = new Set<string>()
  const push = (c: BookCandidate, why: string, kind: RecItem['source']) => {
    const key = c.isbn13 ?? c.title.replace(/\s/g, '')
    if (seen.has(key) || (c.isbn13 && excluded.has(c.isbn13)) || excludedTitles.has(c.title.replace(/\s/g, ''))) return
    seen.add(key)
    pool.push({ ...c, why, kind })
  }

  // 1-a. 좋아한 저자의 다른 책
  for (const [author] of profile.topAuthors.slice(0, 4)) {
    for (const c of await kakaoSearch(author, 'person', 10)) {
      if (c.isbn13) push(c, `좋아하신 ${author}의 다른 책`, 'author')
    }
  }
  // 1-b. 도서관 대출 데이터(좋아한 책을 빌린 사람들이 함께 빌린 책)
  for (const fav of profile.favoriteBooks.slice(0, 3)) {
    if (!fav.isbn13) continue
    for (const c of await libraryRecommendations(fav.isbn13, member.ageGroup === 'CHILD' ? 'reader' : 'mania')) {
      push(c, `『${fav.title}』을 읽은 도서관 이용자들이 함께 빌린 책`, 'library')
    }
  }
  // 1-c. 시리즈 빈 권
  for (const s of (await seriesGaps(hid)).slice(0, 5)) {
    push(
      { isbn13: null, title: `${s.name} ${s.missing.slice(0, 5).join('·')}권`, authors: '', publisher: '', pubYear: null, coverUrl: null, description: null, kdc: null, source: 'kakao' },
      `가진 시리즈의 빠진 권(${s.missing.length}권)`,
      'series',
    )
  }

  let items: RecItem[] = []
  let usedAi = false
  if (isClaudeConfigured() && pool.length > LIMIT) {
    try {
      const notes = await prisma.note.findMany({
        where: { reading: { memberId }, kind: { in: ['REVIEW', 'QUOTE'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { body: true },
      })
      const picks = await pickRecommendations({
        memberName: member.name,
        isChild: member.ageGroup === 'CHILD',
        profileSummary: describeProfile(profile),
        recentNotes: notes.map((n) => n.body.slice(0, 200)),
        candidates: pool.slice(0, 60).map((c) => ({ title: c.title, authors: c.authors, publisher: c.publisher, source: c.why })),
        limit: LIMIT,
      })
      items = picks.map((p) => toItem(pool[p.index], p.reason))
      usedAi = items.length > 0
    } catch (e) {
      console.warn('[recommend] Claude 선정 실패, 규칙 순서로 대체:', (e as Error).message)
    }
  }
  if (items.length === 0) items = pool.slice(0, LIMIT).map((c) => toItem(c, c.why))

  return prisma.recommendationRun.create({
    data: { memberId, items: items as unknown as Prisma.InputJsonValue, usedAi },
  })
}

function toItem(c: BookCandidate & { kind: RecItem['source'] }, reason: string): RecItem {
  return {
    isbn13: c.isbn13,
    title: c.title,
    authors: c.authors,
    publisher: c.publisher,
    coverUrl: c.coverUrl,
    reason,
    source: c.kind,
  }
}
