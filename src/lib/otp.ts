import 'server-only'
import crypto from 'node:crypto'
import { prisma } from '@/lib/db'

/**
 * 이메일 인증코드(OTP). 코드 원문은 저장하지 않고 AUTH_SECRET 으로 HMAC 한 값만 둔다.
 * 유효 10분, 시도 5회, 재발송 60초 간격, 한 번 쓰면 끝(조건부 updateMany 로 원자적 소비).
 */
const TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5
const COOLDOWN_MS = 60 * 1000
export const OTP_TTL_MIN = TTL_MS / 60_000

export class OtpCooldownError extends Error {
  constructor(public readonly seconds: number) {
    super(`COOLDOWN:${seconds}`)
  }
}

function hmac(recipient: string, code: string): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return crypto.createHmac('sha256', secret).update(`${recipient}:${code}`).digest('hex')
}

/** 새 코드 발급(이전 미사용 코드는 즉시 만료). 반환한 원문은 메일 발송에만 쓰고 버린다. */
export async function createOtp(recipient: string): Promise<string> {
  const now = new Date()
  const latest = await prisma.otpCode.findFirst({ where: { recipient }, orderBy: { createdAt: 'desc' } })
  if (latest) {
    const elapsed = now.getTime() - latest.createdAt.getTime()
    if (elapsed < COOLDOWN_MS) throw new OtpCooldownError(Math.ceil((COOLDOWN_MS - elapsed) / 1000))
  }
  await prisma.otpCode.updateMany({ where: { recipient, consumedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } })
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  await prisma.otpCode.create({ data: { recipient, codeHash: hmac(recipient, code), expiresAt: new Date(now.getTime() + TTL_MS) } })
  // 하루 지난 기록 정리
  await prisma.otpCode.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } })
  return code
}

/** 코드 검증 후 소비. 성공하면 true. */
export async function verifyOtp(recipient: string, input: string): Promise<boolean> {
  if (!/^\d{6}$/.test(input)) return false
  const now = new Date()
  const otp = await prisma.otpCode.findFirst({
    where: { recipient, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  })
  if (!otp) return false
  // 시도 횟수를 먼저 올린다 — 조건부 증가라 동시 요청으로도 한도를 넘지 못한다
  const bumped = await prisma.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  })
  if (bumped.count !== 1) return false
  const a = Buffer.from(hmac(recipient, input), 'hex')
  const b = Buffer.from(otp.codeHash, 'hex')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  const consumed = await prisma.otpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: now } })
  return consumed.count === 1
}
