import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from '@/lib/session'
import { safeNext, type GoogleProfile } from '@/lib/google-oidc'

/** 구글(또는 테스트) 프로필로 사용자를 찾거나 만든다. 회원가입 절차 없이 첫 로그인이 곧 가입이다. */
export async function upsertUser(profile: GoogleProfile) {
  return prisma.user.upsert({
    where: { googleSub: profile.sub },
    create: { googleSub: profile.sub, email: profile.email, name: profile.name, avatarUrl: profile.picture, lastLoginAt: new Date() },
    update: { email: profile.email, name: profile.name, avatarUrl: profile.picture, lastLoginAt: new Date() },
  })
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.COOKIE_SECURE === '1',
    path: '/',
    maxAge,
  }
}

/**
 * 이메일 인증 로그인 사용자. 식별자는 기존 테스트 로그인과 같은 'dev:<email>'(이미 만든 계정·서재를 잇는다).
 * 이름은 처음 만들 때만 정하고, 이후에는 사용자가 바꾼 이름을 덮어쓰지 않는다.
 */
export async function upsertEmailUser(email: string, defaultName: string) {
  return prisma.user.upsert({
    where: { googleSub: `dev:${email}` },
    create: { googleSub: `dev:${email}`, email, name: defaultName, lastLoginAt: new Date() },
    update: { lastLoginAt: new Date() },
  })
}

/**
 * 가족 전용 배포: 아직 어느 서재에도 속하지 않은 사용자가 로그인하면, 서재가 정확히 하나일 때 그 서재에
 * 관리자(ADMIN)로 합류시킨다(두 번째 서재가 생기지 않도록). 같은 이름의 계정 없는 구성원이 있으면 그 프로필에 연결한다.
 */
export async function joinSoleHousehold(userId: string, name: string) {
  if (await prisma.member.findFirst({ where: { userId }, select: { id: true } })) return
  const households = await prisma.household.findMany({ select: { id: true }, take: 2 })
  if (households.length !== 1) return
  const householdId = households[0].id
  const linked = await prisma.member.updateMany({ where: { householdId, name, userId: null }, data: { userId } })
  if (linked.count > 0) return
  const taken = await prisma.member.findFirst({ where: { householdId, name }, select: { id: true } })
  await prisma.member.create({ data: { householdId, userId, name: taken ? `${name}(${userId.slice(-4)})` : name, role: 'ADMIN' } })
}

/** 로그인 후 이동할 곳과 세션 토큰. next(초대 링크 등)가 있으면 그쪽, 없으면 가구가 있으면 대시보드·없으면 온보딩. */
export async function sessionFor(userId: string, next: string | null) {
  const first = await prisma.member.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } })
  const target = safeNext(next) ?? (first ? '/dashboard' : '/onboarding')
  return { target, token: await signSession({ userId, householdId: first?.householdId }) }
}

/** 세션 발급 후 이동(리디렉트 응답). 기본 가구는 가장 먼저 가입한 가구. */
export async function finishLogin(userId: string, next: string | null, origin: string) {
  const { target, token } = await sessionFor(userId, next)
  const res = NextResponse.redirect(new URL(target, origin), 303)
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  return res
}

/** 테스트 로그인 허용 여부. 운영(NODE_ENV=production)에서도 ENABLE_DEV_LOGIN=1 을 명시해야만 켜진다. */
export function isDevLoginEnabled(): boolean {
  return process.env.ENABLE_DEV_LOGIN === '1'
}
