import 'server-only'
import { createRemoteJWKSet, jwtVerify, SignJWT, base64url } from 'jose'

/**
 * 구글 로그인(OpenID Connect, Authorization Code + PKCE). 외부 인증 라이브러리 없이 jose만 쓴다.
 *
 *  1) /api/auth/google          state·PKCE verifier·nonce·next 를 서명된 단기 쿠키에 담고 구글로 보낸다
 *  2) /api/auth/google/callback code → 토큰 교환 → id_token 서명·iss·aud·exp·nonce·email_verified 검증
 *
 * 리디렉션 URI 규칙(구글): HTTPS 이거나 http://localhost 만 허용, 사설 IP 불가.
 * 그래서 APP_URL 로 공개 주소를 고정한다(랩 테스트는 http://localhost:3503 포트포워딩).
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export const OAUTH_COOKIE = 'hl_oauth'
const OAUTH_TTL_SECONDS = 600

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function appUrl(fallbackOrigin?: string): string {
  return (process.env.APP_URL || fallbackOrigin || 'http://localhost:3000').replace(/\/+$/, '')
}

export function redirectUri(fallbackOrigin?: string): string {
  return `${appUrl(fallbackOrigin)}/api/auth/google/callback`
}

/** 로그인 후 이동할 경로. 같은 사이트 안의 절대 경로만 허용(오픈 리디렉트 방지). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  return next
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(s)
}

function randomToken(bytes = 32): string {
  return base64url.encode(crypto.getRandomValues(new Uint8Array(bytes)))
}

async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url.encode(new Uint8Array(digest))
}

interface OAuthState {
  state: string
  verifier: string
  nonce: string
  next: string | null
}

/** 구글 인증 URL과, 콜백에서 대조할 상태를 담은 서명 쿠키 값을 만든다. */
export async function beginGoogleLogin(next: string | null, fallbackOrigin?: string) {
  const st: OAuthState = { state: randomToken(), verifier: randomToken(48), nonce: randomToken(), next: safeNext(next) }
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(fallbackOrigin),
    response_type: 'code',
    scope: 'openid email profile',
    state: st.state,
    nonce: st.nonce,
    code_challenge: await s256(st.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  const cookie = await new SignJWT({ ...st })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_TTL_SECONDS}s`)
    .sign(secret())
  return { url: `${AUTH_ENDPOINT}?${params}`, cookie, maxAge: OAUTH_TTL_SECONDS }
}

export interface GoogleProfile {
  sub: string
  email: string
  name: string
  picture: string | null
}

export class GoogleLoginError extends Error {}

/** 콜백 처리: 쿠키의 state 대조 → 코드 교환 → id_token 검증. 실패하면 GoogleLoginError. */
export async function completeGoogleLogin(
  params: { code: string | null; state: string | null; error: string | null },
  cookieValue: string | undefined,
  fallbackOrigin?: string,
): Promise<{ profile: GoogleProfile; next: string | null }> {
  if (params.error) throw new GoogleLoginError(params.error === 'access_denied' ? '로그인을 취소했습니다.' : `구글 로그인 오류: ${params.error}`)
  if (!cookieValue || !params.code || !params.state) throw new GoogleLoginError('로그인 요청이 만료되었습니다. 다시 시도해 주세요.')
  let st: OAuthState
  try {
    st = (await jwtVerify<OAuthState & Record<string, unknown>>(cookieValue, secret())).payload
  } catch {
    throw new GoogleLoginError('로그인 요청이 만료되었습니다. 다시 시도해 주세요.')
  }
  if (st.state !== params.state) throw new GoogleLoginError('잘못된 로그인 요청입니다(state 불일치).')

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(fallbackOrigin),
      grant_type: 'authorization_code',
      code_verifier: st.verifier,
    }),
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  })
  const body = (await res.json().catch(() => null)) as { id_token?: string; error?: string } | null
  if (!res.ok || !body?.id_token) throw new GoogleLoginError(`구글 토큰 교환 실패: ${body?.error ?? res.status}`)

  const { payload } = await jwtVerify(body.id_token, JWKS, { issuer: ISSUERS, audience: process.env.GOOGLE_CLIENT_ID! })
  if (payload.nonce !== st.nonce) throw new GoogleLoginError('잘못된 로그인 응답입니다(nonce 불일치).')
  if (payload.email_verified !== true || typeof payload.email !== 'string') {
    throw new GoogleLoginError('이메일 인증이 완료된 구글 계정만 쓸 수 있습니다.')
  }
  return {
    profile: {
      sub: String(payload.sub),
      email: payload.email,
      name: typeof payload.name === 'string' && payload.name ? payload.name : payload.email.split('@')[0],
      picture: typeof payload.picture === 'string' ? payload.picture : null,
    },
    next: st.next,
  }
}
