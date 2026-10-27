import 'server-only'
import { prisma } from '@/lib/db'

/**
 * 구성원 취향 프로필(기획서 "취향 점수"):
 *  - 분야 점수 = Σ(완독 1권당 별점, 별점 없으면 3) × 최근 12개월이면 2배
 *  - 저자 점수도 같은 방식
 *  - '사 놓고 안 읽은 비율' = 소유한 책 중 읽음 기록이 없는 비율
 *
 * hid: 가구 id(테넌트 경계). memberId 는 호출하는 쪽이 같은 가구 소속인지 확인한 값이어야 한다.
 */
export async function buildProfile(hid: string, memberId: string) {
  const yearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000)
  const readings = await prisma.reading.findMany({
    where: { memberId, book: { householdId: hid } },
    include: { book: { select: { id: true, title: true, authors: true, category: true, publisher: true, isbn13: true } } },
  })
  const categoryScore = new Map<string, number>()
  const authorScore = new Map<string, number>()
  const publisherCount = new Map<string, number>()
  const categoryDone = new Map<string, number>()
  let ratingSum = 0
  let ratingN = 0
  const monthly = new Map<string, number>()

  for (const r of readings) {
    if (r.status !== 'DONE') continue
    const w = (r.rating ?? 3) * (r.finishedAt && r.finishedAt >= yearAgo ? 2 : 1)
    categoryScore.set(r.book.category, (categoryScore.get(r.book.category) ?? 0) + w)
    categoryDone.set(r.book.category, (categoryDone.get(r.book.category) ?? 0) + 1)
    for (const a of splitAuthors(r.book.authors)) authorScore.set(a, (authorScore.get(a) ?? 0) + w)
    if (r.book.publisher) publisherCount.set(r.book.publisher, (publisherCount.get(r.book.publisher) ?? 0) + 1)
    if (r.rating) {
      ratingSum += r.rating
      ratingN++
    }
    if (r.finishedAt) {
      const key = r.finishedAt.toISOString().slice(0, 7)
      monthly.set(key, (monthly.get(key) ?? 0) + 1)
    }
  }

  const owned = await prisma.book.count({ where: { householdId: hid, copies: { some: { ownerId: memberId } } } })
  const ownedUnread = await prisma.book.count({
    where: {
      householdId: hid,
      copies: { some: { ownerId: memberId } },
      readings: { none: { memberId, status: { in: ['READING', 'DONE', 'DROPPED', 'REFERENCE'] } } },
    },
  })

  const sortDesc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])
  return {
    doneCount: readings.filter((r) => r.status === 'DONE').length,
    readingNow: readings.filter((r) => r.status === 'READING').length,
    avgRating: ratingN ? Math.round((ratingSum / ratingN) * 10) / 10 : null,
    topCategories: sortDesc(categoryScore).slice(0, 5),
    categoryDone,
    topAuthors: sortDesc(authorScore).slice(0, 8),
    topPublishers: sortDesc(publisherCount).slice(0, 5),
    monthly,
    owned,
    ownedUnread,
    readIsbns: new Set(readings.map((r) => r.book.isbn13).filter((x): x is string => Boolean(x))),
    favoriteBooks: readings
      .filter((r) => r.status === 'DONE' && (r.rating ?? 0) >= 4)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .map((r) => r.book),
  }
}

export type Profile = Awaited<ReturnType<typeof buildProfile>>

export function splitAuthors(authors: string): string[] {
  return authors
    .split(/[,·;/]/)
    .map((a) => a.replace(/\(.*?\)/g, '').trim().replace(ROLE_SUFFIX, '').trim())
    .filter((a) => a.length >= 2)
}

// 이름 뒤에 붙는 역할 표기('지음', '외' 등)만 떼어 낸다. 이름 속 글자(예: '저스틴')는 건드리지 않는다.
const ROLE_SUFFIX = /(\s+(지음|저|글|그림|옮김|역|편|엮음|외))+$/

export function describeProfile(p: Profile): string {
  const lines = [
    `완독 ${p.doneCount}권, 읽는 중 ${p.readingNow}권, 평균 별점 ${p.avgRating ?? '없음'}`,
    `선호 분야: ${p.topCategories.map(([c]) => c).join(', ') || '기록 부족'}`,
    `선호 저자: ${p.topAuthors.map(([a]) => a).join(', ') || '기록 부족'}`,
    `높게 평가한 책: ${p.favoriteBooks.slice(0, 8).map((b) => b.title).join(', ') || '없음'}`,
  ]
  return lines.join('\n')
}
