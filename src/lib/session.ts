/**
 * 세션 서명/검증 — jose만 사용(Edge 런타임 안전). proxy.ts에서도 import하므로
 * prisma/node crypto 등 Node 전용 모듈을 절대 import하지 말 것.
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export const SESSION_COOKIE = 'hl_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30일 — 가족 전용 기기에서 매번 로그인하지 않도록

export interface SessionPayload extends JWTPayload {
  memberId: string
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signSession(memberId: string): Promise<string> {
  return new SignJWT({ memberId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecret())
    return typeof payload.memberId === 'string' ? payload : null
  } catch {
    return null
  }
}
