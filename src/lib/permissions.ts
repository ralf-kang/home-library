/**
 * 가구 권한 매트릭스(순수 함수 — 테스트 대상). 화면은 메뉴를 숨기는 데, 서버는 실제 차단에 같은 표를 쓴다.
 *
 *   OWNER  가구 설정·삭제·소유권 이전 + ADMIN 전부
 *   ADMIN  가족 초대·역할 변경, 위치·구역, 책 삭제 + MEMBER 전부
 *   MEMBER 책 등록·수정·이동, 사진 등록, CSV, 계정 없는 아이 기록 대리 입력, 대여 요청
 *   CHILD  내 읽기 기록·독후감·위시리스트만
 * 동네 주민 권한은 별도(동네 공유 서가 열람·대여 요청) — neighborhood 쪽에서 다룬다.
 */
import type { HouseholdRole } from '@prisma/client'

export const ROLE_RANK: Record<HouseholdRole, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, CHILD: 1 }

export const ROLE_LABEL: Record<HouseholdRole, string> = {
  OWNER: '소유자',
  ADMIN: '관리자',
  MEMBER: '구성원',
  CHILD: '아이',
}

export type HouseholdAction =
  | 'household.manage' // 가구 이름·지역·삭제·소유권 이전
  | 'family.invite' // 가족 초대·역할 변경·구성원 삭제
  | 'location.manage' // 공간·책장·칸·구역
  | 'book.write' // 등록·수정·이동·사진 등록·CSV
  | 'book.delete'
  | 'reading.proxy' // 계정 없는 구성원(아이) 기록 대리 입력
  | 'loan.approve' // 동네 대여 요청 승인·반납 처리
  | 'loan.request'
  | 'reading.self' // 내 읽기 기록·독후감·위시

const MIN_ROLE: Record<HouseholdAction, HouseholdRole> = {
  'household.manage': 'OWNER',
  'family.invite': 'ADMIN',
  'location.manage': 'ADMIN',
  'book.delete': 'ADMIN',
  'loan.approve': 'ADMIN',
  'book.write': 'MEMBER',
  'reading.proxy': 'MEMBER',
  'loan.request': 'MEMBER',
  'reading.self': 'CHILD',
}

export function atLeast(role: HouseholdRole, min: HouseholdRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

export function can(role: HouseholdRole, action: HouseholdAction): boolean {
  return atLeast(role, MIN_ROLE[action])
}

export function minRoleFor(action: HouseholdAction): HouseholdRole {
  return MIN_ROLE[action]
}

/** 초대·역할 변경으로 줄 수 있는 역할. OWNER는 초대로 줄 수 없고(소유권 이전은 별도), 자기보다 높은 역할도 못 준다. */
export function assignableRoles(actor: HouseholdRole): HouseholdRole[] {
  return (['ADMIN', 'MEMBER', 'CHILD'] as HouseholdRole[]).filter((r) => ROLE_RANK[r] <= ROLE_RANK[actor])
}
