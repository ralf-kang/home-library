import { NextRequest, NextResponse } from 'next/server'
import { OAUTH_COOKIE, beginGoogleLogin, isGoogleConfigured } from '@/lib/google-oidc'
import { requestOrigin, siteUrl } from '@/lib/request-origin'

export const dynamic = 'force-dynamic'

/** 구글 로그인 시작. ?next=/invite/… 처럼 로그인 후 돌아갈 경로를 받을 수 있다. */
export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(siteUrl(req, '/login?error=google_not_configured'), 303)
  }
  const { url, cookie, maxAge } = await beginGoogleLogin(req.nextUrl.searchParams.get('next'), requestOrigin(req))
  const res = NextResponse.redirect(url, 303)
  res.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    sameSite: 'lax', // 구글에서 돌아오는 top-level GET 에 쿠키가 실려야 한다
    secure: process.env.COOKIE_SECURE === '1',
    path: '/api/auth',
    maxAge,
  })
  return res
}
