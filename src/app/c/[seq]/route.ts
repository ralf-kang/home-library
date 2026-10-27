import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { siteUrl } from '@/lib/request-origin'
import { SESSION_COOKIE, signSession } from '@/lib/session'
import { currentMembership } from '@/server/auth'
import { sessionCookieOptions } from '@/server/login'

export const dynamic = 'force-dynamic'

/**
 * 책 라벨 QR 짧은 주소 /c/{관리번호} → 책 상세. 로그인과 가구 소속을 확인한다.
 * - 내가 속하지 않은 가구의 책이면 존재 여부도 알리지 않고 404(관리번호는 전역 일련번호라 추측 가능).
 * - 내가 속한 다른 서재의 책이면 그 서재로 전환한 뒤 보낸다.
 * (proxy.ts 가 비로그인 요청을 /login?next=/c/… 로 보내므로 로그인 후 이 주소로 돌아온다.)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ seq: string }> }) {
  const { seq } = await params
  const n = Number(seq)
  if (!Number.isInteger(n) || n < 1) return new NextResponse('Not Found', { status: 404 })
  const { user, household } = await currentMembership()
  const copy = await prisma.copy.findFirst({
    where: { seq: n, book: { household: { members: { some: { userId: user.id } } } } },
    select: { bookId: true, book: { select: { householdId: true } } },
  })
  if (!copy) return new NextResponse('Not Found', { status: 404 })
  const res = NextResponse.redirect(siteUrl(req, `/books/${copy.bookId}?copy=${n}`), 303)
  if (copy.book.householdId !== household?.id) {
    res.cookies.set(SESSION_COOKIE, await signSession({ userId: user.id, householdId: copy.book.householdId }), sessionCookieOptions())
  }
  return res
}
