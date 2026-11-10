/**
 * 가족 전용 이메일 인증 로그인 — 남편/아내 두 사람만 쓴다. 수신 주소는 서버 환경변수로만 둔다(저장소에 커밋 금지).
 * 클라이언트에는 역할만 보이고 이메일 주소는 내보내지 않는다.
 */
export const FAMILY_ROLES = ['HUSBAND', 'WIFE'] as const
export type FamilyRole = (typeof FAMILY_ROLES)[number]

export const FAMILY_ROLE_LABEL: Record<FamilyRole, string> = { HUSBAND: '남편', WIFE: '아내' }

export function isFamilyRole(v: unknown): v is FamilyRole {
  return typeof v === 'string' && (FAMILY_ROLES as readonly string[]).includes(v)
}

/** 역할의 인증 메일 수신 주소(AUTH_HUSBAND_EMAIL / AUTH_WIFE_EMAIL). 없거나 형식이 틀리면 null. */
export function familyEmail(role: FamilyRole): string | null {
  const v = (role === 'HUSBAND' ? process.env.AUTH_HUSBAND_EMAIL : process.env.AUTH_WIFE_EMAIL)?.trim().toLowerCase()
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null
}

/** 메일 로그인을 쓸 수 있는가 — SMTP 와 최소 한 명의 주소가 있어야 한다. */
export function isEmailLoginConfigured(): boolean {
  const smtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  return smtp && FAMILY_ROLES.some((r) => familyEmail(r) !== null)
}
