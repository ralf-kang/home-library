/**
 * 초대 링크 규칙(순수 함수 — 테스트 대상). 토큰 생성·해시는 server/invites.ts(Node crypto)에서 한다.
 */

export const INVITE_TTL_DAYS = 7
export const INVITE_MAX_USES_LIMIT = 20

export interface InviteState {
  expiresAt: Date
  maxUses: number
  usedCount: number
  revokedAt: Date | null
  email: string | null
}

/** 받을 수 없는 초대면 사용자에게 보여 줄 이유를, 받을 수 있으면 null. */
export function inviteProblem(inv: InviteState, userEmail: string | null, now = new Date()): string | null {
  if (inv.revokedAt) return '취소된 초대입니다.'
  if (inv.expiresAt.getTime() <= now.getTime()) return '기간이 지난 초대입니다. 초대한 분께 새 링크를 요청해 주세요.'
  if (inv.usedCount >= inv.maxUses) return '이미 사용된 초대입니다.'
  if (inv.email && (!userEmail || inv.email.trim().toLowerCase() !== userEmail.trim().toLowerCase())) {
    return `이 초대는 ${maskEmail(inv.email)} 계정 전용입니다. 그 구글 계정으로 로그인해 주세요.`
  }
  return null
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const head = local.slice(0, Math.min(2, local.length))
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length))}@${domain}`
}

/** 같은 가구 안에서 겹치지 않는 구성원 이름(이름, 이름 2, 이름 3 …). */
export function uniqueName(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const name = base.trim() || '구성원'
  if (!used.has(name)) return name
  for (let i = 2; ; i++) if (!used.has(`${name} ${i}`)) return `${name} ${i}`
}
