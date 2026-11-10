import 'server-only'
import nodemailer from 'nodemailer'

/** 인증코드 메일 발송(SMTP_HOST/PORT/USER/PASS/FROM). 미설정이면 예외 — 호출측에서 처리한다. */
export async function sendOtpEmail(to: string, code: string, ttlMin: number): Promise<void> {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error('SMTP is not configured')
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  await transport.sendMail({
    from: process.env.SMTP_FROM || SMTP_USER,
    to,
    subject: '우리집 서재 인증 코드',
    text: `인증 코드: ${code}\n\n이 코드는 ${ttlMin}분 후 만료됩니다.\n본인이 요청하지 않았다면 이 메일을 무시하세요.`,
    html: `<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:400px;margin:0 auto;padding:24px">
  <h2 style="color:#1f2933;font-size:20px;margin:0 0 16px">우리집 서재 로그인</h2>
  <p style="color:#59626b;margin:0 0 24px">아래 코드를 입력해 로그인을 마치세요.</p>
  <div style="background:#faf8f3;border:1px solid #e5e1d8;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
    <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#2f5d50;font-family:monospace">${code}</span>
  </div>
  <p style="color:#59626b;font-size:14px;margin:0">이 코드는 <strong>${ttlMin}분</strong> 후 만료됩니다. 본인이 요청하지 않았다면 무시하세요.</p>
</div>`,
  })
}
