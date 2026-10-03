import { describe, expect, it } from 'vitest'
import { assignableRoles, can } from '../src/lib/permissions'
import { inviteProblem, maskEmail, uniqueName } from '../src/lib/invite'

describe('권한 매트릭스', () => {
  it('소유자만 가구 설정을 바꾼다', () => {
    expect(can('OWNER', 'household.manage')).toBe(true)
    expect(can('ADMIN', 'household.manage')).toBe(false)
  })
  it('관리자 이상만 가족 초대·위치 관리·책 삭제·대여 승인', () => {
    for (const a of ['family.invite', 'location.manage', 'book.delete', 'loan.approve'] as const) {
      expect(can('ADMIN', a)).toBe(true)
      expect(can('MEMBER', a)).toBe(false)
    }
  })
  it('구성원은 책 등록·대리 입력·대여 요청, 아이는 자기 기록만', () => {
    expect(can('MEMBER', 'book.write')).toBe(true)
    expect(can('MEMBER', 'reading.proxy')).toBe(true)
    expect(can('CHILD', 'book.write')).toBe(false)
    expect(can('CHILD', 'loan.request')).toBe(false)
    expect(can('CHILD', 'reading.self')).toBe(true)
  })
  it('초대로 OWNER를 줄 수 없고 자기보다 높은 역할도 못 준다', () => {
    expect(assignableRoles('OWNER')).toEqual(['ADMIN', 'MEMBER', 'CHILD'])
    expect(assignableRoles('ADMIN')).toEqual(['ADMIN', 'MEMBER', 'CHILD'])
    expect(assignableRoles('MEMBER')).toEqual(['MEMBER', 'CHILD'])
  })
})

describe('초대 규칙', () => {
  const now = new Date('2026-10-04T00:00:00Z')
  const base = { expiresAt: new Date('2026-10-10T00:00:00Z'), maxUses: 1, usedCount: 0, revokedAt: null, email: null }
  it('유효한 초대는 통과', () => {
    expect(inviteProblem(base, 'a@b.com', now)).toBeNull()
  })
  it('만료·취소·사용 완료는 거부', () => {
    expect(inviteProblem({ ...base, expiresAt: new Date('2026-10-01T00:00:00Z') }, 'a@b.com', now)).toMatch('기간')
    expect(inviteProblem({ ...base, revokedAt: now }, 'a@b.com', now)).toMatch('취소')
    expect(inviteProblem({ ...base, usedCount: 1 }, 'a@b.com', now)).toMatch('사용')
  })
  it('이메일 지정 초대는 그 계정만(대소문자 무시)', () => {
    const inv = { ...base, email: 'Mom@Gmail.com' }
    expect(inviteProblem(inv, 'mom@gmail.com', now)).toBeNull()
    expect(inviteProblem(inv, 'dad@gmail.com', now)).toMatch('전용')
    expect(inviteProblem(inv, null, now)).toMatch('전용')
  })
  it('이메일 가림·이름 중복 회피', () => {
    expect(maskEmail('family@gmail.com')).toBe('fa****@gmail.com')
    expect(uniqueName('엄마', ['엄마', '엄마 2'])).toBe('엄마 3')
    expect(uniqueName('아빠', [])).toBe('아빠')
  })
})
