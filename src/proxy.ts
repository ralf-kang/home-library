/**
 * Edge 프록시(Next.js 16) — jose만 사용. prisma 등 Node 전용 모듈 import 금지.
 * 공개 경로(랜딩·소개·약관·로그인·초대·인증 콜백) 외에는 로그인 필요.
 * 1차 방어선일 뿐이며, 페이지·서버 액션·API는 각자 requireMember()/requireUser()로 재검증한다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'
import { siteUrl } from '@/lib/request-origin'

const PUBLIC_EXACT = new Set(['/', '/about', '/terms', '/privacy', '/pricing', '/login'])
const PUBLIC_PREFIX = ['/invite/', '/api/auth/', '/api/health']

function isPublic(pathname: string) {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIX.some((p) => pathname.startsWith(p))
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifySession(token) : null

  if (pathname === '/login' && session) return NextResponse.redirect(siteUrl(req, '/dashboard'))
  if (session || isPublic(pathname)) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const login = siteUrl(req, '/login')
  login.searchParams.set('next', pathname + search)
  return NextResponse.redirect(login)
}

export const config = {
  // public/img(영상·포스터·자막)는 로그인 전 랜딩에서도 재생돼야 하므로 제외
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|img/).*)'],
}
