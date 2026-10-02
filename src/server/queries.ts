import 'server-only'
import type { Prisma, ReadingStatus, AgeGroup } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isChosungQuery, toChosung } from '@/lib/chosung'
import { normalizeIsbn } from '@/lib/isbn'
import { buildLocationIndex, descendantIds, effectiveZone, fullCode, fullName } from '@/lib/location'

/** 조회 전용 함수 모음. 호출하는 페이지가 먼저 requireMember()로 인증을 확인한다. */

export async function loadLocations() {
  const locations = await prisma.location.findMany({ include: { zone: true } })
  const index = buildLocationIndex(locations)
  const describe = (id: string | null | undefined) => {
    if (!id) return null
    return {
      id,
      code: fullCode(id, index.byId),
      name: fullName(id, index.byId),
      zone: effectiveZone(id, index.byId),
    }
  }
  return { locations, ...index, describe }
}

export type LocationIndex = Awaited<ReturnType<typeof loadLocations>>

export const PAGE_SIZE = 30

export interface SearchParams {
  q?: string
  category?: string
  locationId?: string
  ownerId?: string
  ageGroup?: AgeGroup
  /** 로그인한 구성원 기준 읽음 상태. UNREAD = 기록 없음 또는 '읽고 싶음' */
  myStatus?: ReadingStatus | 'UNREAD'
  needsReview?: boolean
  page?: number
}

export async function searchBooks(memberId: string, p: SearchParams, loc: LocationIndex) {
  const and: Prisma.BookWhereInput[] = []
  const q = p.q?.trim()
  if (q) {
    const isbn = normalizeIsbn(q)
    if (isbn) {
      and.push({ isbn13: isbn })
    } else if (isChosungQuery(q)) {
      and.push({ titleChosung: { contains: toChosung(q) } })
    } else {
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { authors: { contains: q, mode: 'insensitive' } },
          { publisher: { contains: q, mode: 'insensitive' } },
          { series: { name: { contains: q, mode: 'insensitive' } } },
          { tags: { has: q } },
          { readings: { some: { notes: { some: { body: { contains: q, mode: 'insensitive' } } } } } },
        ],
      })
    }
  }
  if (p.category) and.push({ category: p.category })
  if (p.ageGroup) and.push({ ageGroup: p.ageGroup })
  if (p.needsReview) and.push({ needsReview: true })
  if (p.locationId) {
    and.push({ copies: { some: { locationId: { in: descendantIds(p.locationId, loc.children) } } } })
  }
  if (p.ownerId) and.push({ copies: { some: { ownerId: p.ownerId } } })
  if (p.myStatus === 'UNREAD') {
    and.push({ readings: { none: { memberId, status: { in: ['READING', 'DONE', 'DROPPED', 'REFERENCE'] } } } })
  } else if (p.myStatus) {
    and.push({ readings: { some: { memberId, status: p.myStatus } } })
  }

  const where: Prisma.BookWhereInput = { AND: and }
  const page = Math.max(1, p.page ?? 1)
  const [total, books] = await Promise.all([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        series: true,
        copies: { select: { id: true, locationId: true, status: true } },
        readings: { where: { memberId }, select: { status: true, rating: true } },
      },
    }),
  ])
  return { total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), books }
}

export async function getBookDetail(id: string) {
  return prisma.book.findUnique({
    where: { id },
    include: {
      series: true,
      copies: {
        orderBy: { seq: 'asc' },
        include: {
          owner: true,
          moves: { orderBy: { movedAt: 'desc' }, take: 5, include: { movedBy: true } },
        },
      },
      readings: {
        include: { member: true, notes: { orderBy: { createdAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  })
}

export async function listCategories() {
  const rows = await prisma.book.groupBy({ by: ['category'], _count: { _all: true }, orderBy: { category: 'asc' } })
  return rows.map((r) => ({ category: r.category, count: r._count._all }))
}

export async function listMembers() {
  return prisma.member.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
}

/** 시리즈별 보유 권차와 빠진 권차(1..max 또는 totalVolumes 기준). */
export async function seriesGaps() {
  const series = await prisma.series.findMany({
    include: { books: { select: { volumeNo: true, copies: { select: { id: true } } } } },
  })
  return series
    .map((s) => {
      const owned = new Set(s.books.filter((b) => b.volumeNo != null && b.copies.length > 0).map((b) => b.volumeNo!))
      const max = s.totalVolumes ?? Math.max(0, ...owned)
      const missing: number[] = []
      for (let v = 1; v <= max; v++) if (!owned.has(v)) missing.push(v)
      return { id: s.id, name: s.name, owned: [...owned].sort((a, b) => a - b), max, missing }
    })
    .filter((s) => s.missing.length > 0)
}

/** 칸(SHELF) 선택지. 칸이 아직 없으면 책장·공간도 고를 수 있게 한다. */
export function shelfOptions(loc: LocationIndex) {
  const shelves = loc.locations.filter((l) => l.kind === 'SHELF')
  const pool = shelves.length > 0 ? shelves : loc.locations
  return pool
    .map((l) => ({ id: l.id, code: loc.describe(l.id)!.code, label: `${loc.describe(l.id)!.code} · ${loc.describe(l.id)!.name}` }))
    .sort((a, b) => a.code.localeCompare(b.code, 'ko', { numeric: true }))
}
