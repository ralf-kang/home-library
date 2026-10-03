import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

export const dynamic = 'force-dynamic'

function logout(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/', req.url), 303)
  res.cookies.delete({ name: SESSION_COOKIE, path: '/' })
  return res
}

/** 로그아웃 버튼(폼 POST). */
export async function POST(req: NextRequest) {
  return logout(req)
}

/**
 * 서명은 유효하지만 사용자가 지워진 세션(stale)을 정리하는 용도 — requireUser()가 여기로 보낸다.
 * 그렇지 않으면 proxy(/login → /dashboard)와 requireUser(→ /login) 사이에서 무한 리디렉트가 생긴다.
 */
export async function GET(req: NextRequest) {
  return logout(req)
}
