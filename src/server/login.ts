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
 * 세션 발급 후 이동. next(초대 링크 등)가 있으면 그쪽으로, 없으면 가구가 있으면 대시보드·없으면 온보딩.
 * 기본 가구는 가장 먼저 가입한 가구.
 */
export async function finishLogin(userId: string, next: string | null, origin: string) {
  const first = await prisma.member.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } })
  const target = safeNext(next) ?? (first ? '/dashboard' : '/onboarding')
  const res = NextResponse.redirect(new URL(target, origin), 303)
  res.cookies.set(SESSION_COOKIE, await signSession({ userId, householdId: first?.householdId }), sessionCookieOptions())
  return res
}

/** 테스트 로그인 허용 여부. 운영(NODE_ENV=production)에서도 ENABLE_DEV_LOGIN=1 을 명시해야만 켜진다. */
export function isDevLoginEnabled(): boolean {
  return process.env.ENABLE_DEV_LOGIN === '1'
}
