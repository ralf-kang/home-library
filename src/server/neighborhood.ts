import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

/**
 * 동네 조회. 동네 주민에게 보이는 것은 '대여 가능' 소장본의 표지·제목·저자·출판사·가구 이름뿐이다.
 * 위치·읽기 기록·독후감·구성원 정보는 select 하지 않는다 — 이 파일의 select 를 넓히지 말 것.
 */

/** 이 사용자가 볼 수 있는 동네: 직접 가입한 동네 + 내가 속한 가구가 참여한 동네. */
export async function accessibleNeighborhoods(userId: string) {
  const [direct, viaHousehold] = await Promise.all([
    prisma.neighborMembership.findMany({ where: { userId }, include: { neighborhood: true } }),
    prisma.member.findMany({
      where: { userId, household: { neighborhoodId: { not: null } } },
      include: { household: { include: { neighborhood: true } } },
    }),
  ])
  const map = new Map<string, { id: string; name: string; regionName: string | null; role: 'ORGANIZER' | 'RESIDENT' | 'FAMILY' }>()
  for (const m of direct) map.set(m.neighborhoodId, { ...pick(m.neighborhood), role: m.role })
  for (const m of viaHousehold) {
    const n = m.household.neighborhood!
    if (!map.has(n.id)) map.set(n.id, { ...pick(n), role: 'FAMILY' })
  }
  return [...map.values()]
}

function pick(n: { id: string; name: string; regionName: string | null }) {
  return { id: n.id, name: n.name, regionName: n.regionName }
}

export async function canAccessNeighborhood(userId: string, neighborhoodId: string) {
  const [direct, viaHousehold] = await Promise.all([
    prisma.neighborMembership.findUnique({ where: { neighborhoodId_userId: { neighborhoodId, userId } } }),
    prisma.member.findFirst({ where: { userId, household: { neighborhoodId } } }),
  ])
  return Boolean(direct || viaHousehold)
}

export async function isOrganizer(userId: string, neighborhoodId: string) {
  const m = await prisma.neighborMembership.findUnique({ where: { neighborhoodId_userId: { neighborhoodId, userId } } })
  return m?.role === 'ORGANIZER'
}

export const SHARED_PAGE_SIZE = 42

/** 동네 공유 서가. 최소 필드만 select 한다. */
export async function sharedShelf(neighborhoodId: string, q: string | undefined, page = 1) {
  const where: Prisma.CopyWhereInput = {
    lendable: true,
    status: { in: ['ON_SHELF', 'LOANED', 'OUT_READING'] },
    book: {
      household: { neighborhoodId },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { authors: { contains: q, mode: 'insensitive' } },
              { publisher: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
  }
  const [total, copies] = await Promise.all([
    prisma.copy.count({ where }),
    prisma.copy.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (Math.max(1, page) - 1) * SHARED_PAGE_SIZE,
      take: SHARED_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        book: {
          select: {
            title: true,
            authors: true,
            publisher: true,
            coverUrl: true,
            ageGroup: true,
            volumeNo: true,
            householdId: true,
            household: { select: { name: true } },
          },
        },
      },
    }),
  ])
  return { total, copies, pageCount: Math.max(1, Math.ceil(total / SHARED_PAGE_SIZE)) }
}

export async function neighborhoodSummary(neighborhoodId: string) {
  const [n, households, residents] = await Promise.all([
    prisma.neighborhood.findUnique({ where: { id: neighborhoodId } }),
    prisma.household.findMany({ where: { neighborhoodId }, select: { id: true, name: true } }),
    prisma.neighborMembership.count({ where: { neighborhoodId } }),
  ])
  return n ? { ...n, households, residents } : null
}
