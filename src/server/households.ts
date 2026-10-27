import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE, signSession } from '@/lib/session'
import { sessionCookieOptions } from '@/server/login'

// 새 서재의 기본 구역(색 라벨). 가족이 설정 화면에서 바꾼다.
const DEFAULT_ZONES: { name: string; color: string }[] = [
  { name: '고전', color: '#9acd32' },
  { name: '소설', color: '#e8a33d' },
  { name: '인문', color: '#8a5a44' },
  { name: '경영·경제', color: '#2f6a7a' },
  { name: 'IT', color: '#4b5d8a' },
  { name: '자격증', color: '#7a6a2f' },
  { name: '어린이-한글', color: '#e07a9a' },
  { name: '어린이-영어', color: '#5aa0d8' },
]

// 기획서 '서가 위치 체계'의 예시 공간. 실제 집 구조에 맞게 설정 화면에서 고치면 된다.
const EXAMPLE_ROOMS = [
  { code: 'LV', name: '거실' },
  { code: 'ST', name: '서재' },
  { code: 'KD', name: '아이방' },
]

/** 새 서재(가구) — 만든 사람이 OWNER. 기본 구역·예시 공간을 함께 만든다. */
export async function createHousehold(tx: Prisma.TransactionClient, userId: string, name: string, ownerName: string) {
  const household = await tx.household.create({ data: { name } })
  await tx.member.create({ data: { householdId: household.id, userId, name: ownerName, role: 'OWNER' } })
  await tx.zone.createMany({ data: DEFAULT_ZONES.map((z, i) => ({ ...z, householdId: household.id, sortOrder: i })) })
  await tx.location.createMany({
    data: EXAMPLE_ROOMS.map((r, i) => ({ ...r, kind: 'ROOM' as const, householdId: household.id, sortOrder: i })),
  })
  return household
}

/** 세션의 '지금 보는 가구'를 바꾼다(서버 액션·라우트에서만). 호출 전에 소속 여부를 확인할 것. */
export async function setSessionHousehold(userId: string, householdId: string | null) {
  ;(await cookies()).set(SESSION_COOKIE, await signSession({ userId, householdId }), sessionCookieOptions())
}

// ── 초대 토큰 ──────────────────────────────────────────────────────────────

export function newInviteToken(): string {
  return randomBytes(24).toString('base64url')
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function findInviteByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  return prisma.invite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { household: true, neighborhood: true, createdBy: { select: { name: true } } },
  })
}
