/**
 * Edge 프록시(Next.js 16) — jose만 사용. prisma 등 Node 전용 모듈 import 금지.
 * 이 앱은 가족 전용이라 /login, /api/health를 뺀 모든 경로가 로그인 필요.
 * 1차 방어선일 뿐이며, 페이지·서버 액션은 각자 requireMember()로 재검증한다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifySession(token) : null

  if (pathname === '/login') {
    return session ? NextResponse.redirect(new URL('/', req.url)) : NextResponse.next()
  }
  if (session) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|api/health).*)'],
}
