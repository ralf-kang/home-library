'use server'

import { timingSafeEqual, createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from '@/lib/session'

// PIN 무차별 대입 방지: 구성원별 10분에 5회. 단일 컨테이너라 in-memory로 충분하다.
const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5
const failures = new Map<string, number[]>()

function sha(s: string) {
  return createHash('sha256').update(s).digest()
}

export interface LoginState {
  error?: string
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const memberId = String(form.get('memberId') ?? '')
  const pin = String(form.get('pin') ?? '')
  const expected = process.env.FAMILY_PIN
  if (!expected) return { error: '서버에 FAMILY_PIN이 설정되지 않았습니다.' }
  if (!memberId) return { error: '누구인지 골라 주세요.' }

  const now = Date.now()
  const recent = (failures.get(memberId) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_ATTEMPTS) return { error: 'PIN을 여러 번 틀렸습니다. 10분 뒤 다시 시도해 주세요.' }

  const member = await prisma.member.findUnique({ where: { id: memberId } })
  if (!member || !timingSafeEqual(sha(pin), sha(expected))) {
    recent.push(now)
    failures.set(memberId, recent)
    return { error: 'PIN이 맞지 않습니다.' }
  }
  failures.delete(memberId)

  ;(await cookies()).set(SESSION_COOKIE, await signSession(member.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  redirect('/')
}

export async function logout() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect('/login')
}
