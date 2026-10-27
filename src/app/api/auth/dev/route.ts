import { NextRequest, NextResponse } from 'next/server'
import { safeNext } from '@/lib/google-oidc'
import { finishLogin, isDevLoginEnabled, upsertUser } from '@/server/login'
import { requestOrigin, siteUrl } from '@/lib/request-origin'

export const dynamic = 'force-dynamic'

/**
 * 테스트 로그인 — ENABLE_DEV_LOGIN=1 일 때만 존재한다(아니면 404). 구글 OAuth 키가 오기 전 개발과
 * 랩 스모크 테스트용. 구글 sub 대신 'dev:<email>' 을 써서 실제 구글 계정과 섞이지 않는다.
 */
export async function POST(req: NextRequest) {
  if (!isDevLoginEnabled()) return new NextResponse('Not Found', { status: 404 })
  const form = await req.formData()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const name = String(form.get('name') ?? '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.redirect(siteUrl(req, '/login?error=' + encodeURIComponent('이메일 형식이 올바르지 않습니다.')), 303)
  }
  const user = await upsertUser({ sub: `dev:${email}`, email, name: name || email.split('@')[0], picture: null })
  return finishLogin(user.id, safeNext(String(form.get('next') ?? '')), requestOrigin(req))
}
