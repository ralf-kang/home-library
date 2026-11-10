import { NextRequest, NextResponse } from 'next/server'
import { familyEmail, isFamilyRole } from '@/lib/family-auth'
import { sendOtpEmail } from '@/lib/mailer'
import { createOtp, OTP_TTL_MIN, OtpCooldownError } from '@/lib/otp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST { role: 'HUSBAND'|'WIFE' } — 그 역할의 등록 주소로만 6자리 코드를 보낸다. 주소·코드는 응답에 넣지 않는다. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { role?: unknown } | null
  const role = body?.role
  if (!isFamilyRole(role)) return NextResponse.json({ message: '요청을 처리할 수 없습니다.' }, { status: 400 })
  const email = familyEmail(role)
  if (!email) return NextResponse.json({ message: '이 사람의 인증 메일 주소가 서버에 설정되지 않았습니다.' }, { status: 400 })
  try {
    const code = await createOtp(role)
    await sendOtpEmail(email, code, OTP_TTL_MIN)
    return NextResponse.json({ message: '인증 코드를 메일로 보냈습니다.' })
  } catch (err) {
    if (err instanceof OtpCooldownError) {
      return NextResponse.json({ message: `요청이 너무 잦습니다. ${err.seconds}초 후 다시 시도하세요.` }, { status: 429 })
    }
    console.error('[send-code]', err instanceof Error ? err.message : err)
    return NextResponse.json({ message: '메일을 보내지 못했습니다. 잠시 후 다시 시도하세요.' }, { status: 500 })
  }
}
