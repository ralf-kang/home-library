import { afterEach, describe, expect, it } from 'vitest'
import { familyEmail, isEmailLoginConfigured, isFamilyRole } from '@/lib/family-auth'

const KEYS = ['AUTH_HUSBAND_EMAIL', 'AUTH_WIFE_EMAIL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] as const
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('family-auth', () => {
  it('역할 값은 HUSBAND/WIFE만 허용', () => {
    expect(isFamilyRole('HUSBAND')).toBe(true)
    expect(isFamilyRole('WIFE')).toBe(true)
    expect(isFamilyRole('ADMIN')).toBe(false)
    expect(isFamilyRole(undefined)).toBe(false)
  })

  it('주소는 환경변수에서 소문자로, 형식이 틀리면 null', () => {
    process.env.AUTH_HUSBAND_EMAIL = ' Dad@Example.com '
    process.env.AUTH_WIFE_EMAIL = 'not-an-email'
    expect(familyEmail('HUSBAND')).toBe('dad@example.com')
    expect(familyEmail('WIFE')).toBeNull()
  })

  it('SMTP 와 주소가 모두 있어야 메일 로그인 사용 가능', () => {
    for (const k of KEYS) delete process.env[k]
    process.env.AUTH_HUSBAND_EMAIL = 'dad@example.com'
    expect(isEmailLoginConfigured()).toBe(false)
    Object.assign(process.env, { SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', SMTP_PASS: 'p' })
    expect(isEmailLoginConfigured()).toBe(true)
  })
})
