import { NextRequest, NextResponse } from 'next/server'
import { GoogleLoginError, OAUTH_COOKIE, completeGoogleLogin } from '@/lib/google-oidc'
import { finishLogin, upsertUser } from '@/server/login'
import { requestOrigin, siteUrl } from '@/lib/request-origin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  try {
    const { profile, next } = await completeGoogleLogin(
      { code: q.get('code'), state: q.get('state'), error: q.get('error') },
      req.cookies.get(OAUTH_COOKIE)?.value,
      requestOrigin(req),
    )
    const user = await upsertUser(profile)
    const res = await finishLogin(user.id, next, requestOrigin(req))
    res.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth' })
    return res
  } catch (e) {
    const msg = e instanceof GoogleLoginError ? e.message : '구글 로그인 중 오류가 났습니다. 잠시 뒤 다시 시도해 주세요.'
    if (!(e instanceof GoogleLoginError)) console.error('[auth/google/callback]', e)
    const res = NextResponse.redirect(siteUrl(req, `/login?error=${encodeURIComponent(msg)}`), 303)
    res.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth' })
    return res
  }
}
