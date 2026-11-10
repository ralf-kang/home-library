import { redirect } from 'next/navigation'
import LoginCard from '@/components/LoginCard'
import { prisma } from '@/lib/db'
import { getSession } from '@/server/auth'

export const dynamic = 'force-dynamic'

/** 첫 화면: 가족 전용이라 소개 랜딩 없이 바로 로그인 카드. 로그인 상태면 취향 대시보드로 보낸다. */
export default async function HomePage() {
  const session = await getSession()
  if (session && (await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }))) redirect('/dashboard')
  return <LoginCard />
}
