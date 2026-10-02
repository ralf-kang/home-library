'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/server/auth'
import { refreshRecommendations } from '@/server/recommend'
import type { ActionResult } from '@/server/form'

// 외부 API·Claude 비용 통제: 구성원별 10분에 1회
const lastRun = new Map<string, number>()

export async function refreshMyRecommendations(): Promise<ActionResult> {
  const me = await requireMember()
  const prev = lastRun.get(me.id) ?? 0
  if (Date.now() - prev < 10 * 60 * 1000) return { ok: false, error: '추천은 10분에 한 번만 갱신할 수 있습니다.' }
  lastRun.set(me.id, Date.now())
  try {
    const run = await refreshRecommendations(me.id)
    revalidatePath('/recommend')
    const n = (run.items as unknown[]).length
    return { ok: true, message: n ? `추천 ${n}권을 새로 골랐습니다.` : '새 후보를 찾지 못했습니다. 완독·별점 기록을 늘리거나 서지 API 키를 설정하세요.' }
  } catch (e) {
    lastRun.delete(me.id)
    return { ok: false, error: `추천 갱신 실패: ${(e as Error).message}` }
  }
}
