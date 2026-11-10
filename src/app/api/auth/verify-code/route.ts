import { NextRequest, NextResponse } from 'next/server'
import { FAMILY_ROLE_LABEL, familyEmail, isFamilyRole } from '@/lib/family-auth'
import { safeNext } from '@/lib/google-oidc'
import { verifyOtp } from '@/lib/otp'
import { SESSION_COOKIE } from '@/lib/session'
import { joinSoleHousehold, sessionCookieOptions, sessionFor, upsertEmailUser } from '@/server/login'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST { role, code, next? } — 코드가 맞으면 그 역할의 이메일 사용자로 세션을 발급하고 { redirect } 를 돌려준다.
 * 사용자 식별자는 기존 테스트 로그인과 같은 'dev:<email>' 을 써서 이미 만든 계정·서재를 그대로 잇는다.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { role?: unknown; code?: unknown; next?: unknown } | null
  const role = body?.role
  const invalid = () => NextResponse.json({ message: '코드가 올바르지 않거나 만료되었습니다.' }, { status: 401 })
  if (!isFamilyRole(role) || typeof body?.code !== 'string') return invalid()
  const email = familyEmail(role)
  if (!email) return invalid()
  if (!(await verifyOtp(role, body.code.trim()))) return invalid()

  const user = await upsertEmailUser(email, FAMILY_ROLE_LABEL[role])
  await joinSoleHousehold(user.id, FAMILY_ROLE_LABEL[role])
  const { target, token } = await sessionFor(user.id, safeNext(typeof body.next === 'string' ? body.next : null))
  const res = NextResponse.json({ redirect: target })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  return res
}
