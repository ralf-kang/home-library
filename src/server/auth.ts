import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { HouseholdRole } from '@prisma/client'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE, verifySession } from '@/lib/session'
import { atLeast, minRoleFor, type HouseholdAction } from '@/lib/permissions'

/**
 * 모든 페이지·서버 액션·API 최상단에서 호출한다. proxy.ts가 1차로 막지만 그것만 믿지 않고,
 * 세션을 다시 검증하고 DB에서 User·Member를 재조회한다(탈퇴·삭제된 구성원의 세션 차단).
 *
 * 테넌트 경계: requireMember()가 돌려준 household.id 를 모든 조회·변경 조건에 넣는다.
 * 클라이언트가 보낸 id(bookId·copyId·locationId 등)는 반드시 그 가구 소속인지 확인한 뒤 쓴다.
 */

export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return token ? await verifySession(token) : null
})

/** 로그인한 구글 계정. 없으면 /login. */
export const requireUser = cache(async () => {
  const session = await getSession()
  if (!session) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  // 서명은 유효한데 사용자가 없으면(탈퇴·DB 초기화) 쿠키를 지워야 리디렉트가 돌지 않는다
  if (!user) redirect('/api/auth/logout')
  return user
})

/**
 * 세션의 가구에서 내 구성원 정보를 찾는다. 세션의 가구가 없거나 더 이상 소속이 아니면
 * 내가 속한 다른 가구(가장 먼저 가입한 곳)를 쓴다. 가구가 하나도 없으면 null.
 */
export const currentMembership = cache(async () => {
  const user = await requireUser()
  const session = await getSession()
  const include = { household: true } as const
  const preferred = session?.householdId
    ? await prisma.member.findFirst({ where: { userId: user.id, householdId: session.householdId }, include })
    : null
  const member =
    preferred ?? (await prisma.member.findFirst({ where: { userId: user.id }, include, orderBy: { createdAt: 'asc' } }))
  if (!member) return { user, member: null, household: null }
  const { household, ...rest } = member
  return { user, member: rest, household }
})

/** 가구 구성원 필수. 가구가 없으면 온보딩, 역할이 모자라면 대시보드로 돌려보낸다(500 대신). */
export async function requireMember(min: HouseholdRole = 'CHILD') {
  const { user, member, household } = await currentMembership()
  if (!member || !household) redirect('/onboarding')
  if (!atLeast(member.role, min)) redirect('/dashboard?forbidden=1')
  return { user, member, household }
}

/** 권한 매트릭스(lib/permissions.ts)의 행동 이름으로 확인한다. */
export function requireCan(action: HouseholdAction) {
  return requireMember(minRoleFor(action))
}

export type MemberContext = Awaited<ReturnType<typeof requireMember>>

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const list = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(email.toLowerCase())
}

export async function requirePlatformAdmin() {
  const user = await requireUser()
  if (!isPlatformAdmin(user.email)) redirect('/dashboard?forbidden=1')
  return user
}
