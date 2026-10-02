import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE, verifySession } from '@/lib/session'

/**
 * 모든 페이지·서버 액션 최상단에서 호출한다. proxy.ts가 1차로 막지만, 그것만 믿지 않고
 * 여기서 세션을 다시 검증하고 DB에서 구성원을 재조회한다(삭제된 구성원의 세션 차단).
 */
export async function requireMember() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const session = token ? await verifySession(token) : null
  if (!session) redirect('/login')
  const member = await prisma.member.findUnique({ where: { id: session.memberId } })
  if (!member) redirect('/login')
  return member
}

/** 등록·위치 변경·삭제·설정처럼 집 데이터를 바꾸는 작업은 관리자 구성원만 한다. */
export async function requireAdmin() {
  const member = await requireMember()
  // 페이지·API·서버 액션 어디서 불려도 500 대신 홈으로 돌려보낸다(조작 화면 자체를 막음).
  if (!member.isAdmin) redirect('/?forbidden=1')
  return member
}
