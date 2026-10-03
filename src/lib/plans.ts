/**
 * 요금제 골격(수익화 준비). 지금은 모든 가구가 FREE이고 모든 기능이 무료다.
 * MONETIZATION_ENABLED=1 일 때만 한도를 실제로 검사한다 — 가입자 수를 보고 켤지 결정한다(docs/monetization.md).
 */
import type { Plan } from '@prisma/client'

export interface PlanLimits {
  /** 서재당 서지 수 */
  books: number
  /** 계정 있는 가족 수 */
  members: number
  /** 구성원별 AI 추천 갱신 횟수(월) */
  aiRecommendPerMonth: number
  /** 서가 사진 판독(월) */
  photoScanPerMonth: number
}

export const PLAN_INFO: Record<Plan, { name: string; priceKrwMonthly: number; limits: PlanLimits; perks: string[] }> = {
  FREE: {
    name: '무료',
    priceKrwMonthly: 0,
    limits: { books: 3000, members: 6, aiRecommendPerMonth: 10, photoScanPerMonth: 30 },
    perks: ['책 관리·위치·검색', '가족 초대(역할별 권한)', '읽기 기록·독후감·취향 대시보드', '동네 공유 서가·대여 요청', 'CSV 내보내기'],
  },
  PLUS: {
    name: '가족 Plus(예정)',
    priceKrwMonthly: 3900,
    limits: { books: 20000, members: 12, aiRecommendPerMonth: 200, photoScanPerMonth: 500 },
    perks: ['AI 추천·서가 사진 판독 확대', '가족 독서 리포트(월간)', '자동 백업·복원', '여러 서재(본가·외가) 묶어 보기'],
  },
}

export function isMonetizationEnabled(): boolean {
  return process.env.MONETIZATION_ENABLED === '1'
}

/** 한도 확인. 수익화가 꺼져 있으면 언제나 허용(null). 넘으면 사용자에게 보여 줄 메시지. */
export function limitProblem(plan: Plan, key: keyof PlanLimits, current: number): string | null {
  if (!isMonetizationEnabled()) return null
  const limit = PLAN_INFO[plan].limits[key]
  return current >= limit ? `${PLAN_INFO[plan].name} 요금제 한도(${limit.toLocaleString()})에 도달했습니다.` : null
}
