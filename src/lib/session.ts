/**
 * 세션 서명/검증 — jose만 사용(Edge 런타임 안전). proxy.ts에서도 import하므로
 * prisma/node crypto 등 Node 전용 모듈을 절대 import하지 말 것.
 *
 * 세션에는 로그인한 구글 계정(userId)과 지금 보고 있는 가구(householdId)만 담는다.
 * 가구 권한(역할)은 담지 않는다 — 서버가 매 요청 DB에서 Member를 다시 조회해 확인한다(server/auth.ts).
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export const SESSION_COOKIE = 'hl_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30일 — 가족 전용 기기에서 매번 로그인하지 않도록

export interface SessionPayload extends JWTPayload {
  userId: string
  householdId?: string
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: { userId: string; householdId?: string | null }): Promise<string> {
  const claims: Record<string, string> = { userId: payload.userId }
  if (payload.householdId) claims.householdId = payload.householdId
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecret())
    return typeof payload.userId === 'string' ? payload : null
  } catch {
    return null
  }
}
