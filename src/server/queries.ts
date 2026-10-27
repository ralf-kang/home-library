import 'server-only'
import type { Prisma, ReadingStatus, AgeGroup } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isChosungQuery, toChosung } from '@/lib/chosung'
import { normalizeIsbn } from '@/lib/isbn'
import { buildLocationIndex, descendantIds, effectiveZone, fullCode, fullName } from '@/lib/location'

/**
 * 조회 전용 함수 모음. 호출하는 페이지가 먼저 requireMember()로 인증을 확인하고,
 * **모든 함수는 첫 인자로 가구 id(hid)를 받아 그 가구 데이터만 돌려준다**(테넌트 경계).
 */

// ── 테넌트 가드: 클라이언트가 보낸 id가 이 가구 소속인지 확인 ─────────────────────
// 없거나 다른 가구 것이면 null — 호출하는 쪽은 404/거부로 처리한다.

export function ownedBook(hid: string, id: string | null | undefined) {
  return id ? prisma.book.findFirst({ where: { id, householdId: hid } }) : Promise.resolve(null)
}

export function ownedCopy(hid: string, id: string | null | undefined) {
  return id ? prisma.copy.findFirst({ where: { id, book: { householdId: hid } }, include: { book: true } }) : Promise.resolve(null)
}

export function ownedLocation(hid: string, id: string | null | undefined) {
  return id ? prisma.location.findFirst({ where: { id, householdId: hid } }) : Promise.resolve(null)
}

export function ownedMember(hid: string, id: string | null | undefined) {
  return id ? prisma.member.findFirst({ where: { id, householdId: hid } }) : Promise.resolve(null)
}

export function ownedZone(hid: string, id: string | null | undefined) {
  return id ? prisma.zone.findFirst({ where: { id, householdId: hid } }) : Promise.resolve(null)
}

// ── 위치 ──────────────────────────────────────────────────────────────────

export async function loadLocations(hid: string) {
  const locations = await prisma.location.findMany({ where: { householdId: hid }, include: { zone: true } })
  const index = buildLocationIndex(locations)
  const describe = (id: string | null | undefined) => {
    if (!id || !index.byId.has(id)) return null
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
  /** 내용 검색(Google Books) 등으로 찾은 책 id 로 한정 */
  ids?: string[]
  page?: number
}

export async function searchBooks(hid: string, memberId: string, p: SearchParams, loc: LocationIndex) {
  const and: Prisma.BookWhereInput[] = [{ householdId: hid }]
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
          { description: { contains: q, mode: 'insensitive' } },
          { series: { name: { contains: q, mode: 'insensitive' } } },
          { tags: { has: q } },
          { copies: { some: { note: { contains: q, mode: 'insensitive' } } } },
          { readings: { some: { notes: { some: { body: { contains: q, mode: 'insensitive' } } } } } },
        ],
      })
    }
  }
  if (p.ids) and.push({ id: { in: p.ids } })
  if (p.category) and.push({ category: p.category })
  if (p.ageGroup) and.push({ ageGroup: p.ageGroup })
  if (p.needsReview) and.push({ needsReview: true })
  if (p.locationId && loc.byId.has(p.locationId)) {
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

export async function getBookDetail(hid: string, id: string) {
  return prisma.book.findFirst({
    where: { id, householdId: hid },
    include: {
      series: true,
      copies: {
        orderBy: { seq: 'asc' },
        include: {
          owner: true,
          moves: { orderBy: { movedAt: 'desc' }, take: 5, include: { movedBy: true } },
          loans: { where: { returnedAt: null }, take: 1 },
        },
      },
      readings: {
        include: { member: true, notes: { orderBy: { createdAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  })
}

export async function listCategories(hid: string) {
  const rows = await prisma.book.groupBy({
    by: ['category'],
    where: { householdId: hid },
    _count: { _all: true },
    orderBy: { category: 'asc' },
  })
  return rows.map((r) => ({ category: r.category, count: r._count._all }))
}

export async function listMembers(hid: string) {
  return prisma.member.findMany({
    where: { householdId: hid },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { user: { select: { email: true, avatarUrl: true } } },
  })
}

/** 시리즈별 보유 권차와 빠진 권차(1..max 또는 totalVolumes 기준). */
export async function seriesGaps(hid: string) {
  const series = await prisma.series.findMany({
    where: { householdId: hid },
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

/** 위치별 소장본 수(서가·설정 화면). */
export async function copyCountsByLocation(hid: string) {
  const rows = await prisma.copy.groupBy({ by: ['locationId'], where: { book: { householdId: hid } }, _count: { _all: true } })
  return new Map(rows.map((r) => [r.locationId, r._count._all]))
}
