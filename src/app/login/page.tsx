import { prisma } from '@/lib/db'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const members = await prisma.member.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
        <h1 className="text-2xl font-bold">우리집 서재</h1>
        <p className="mt-1 text-sm text-muted">누구인지 고르고 가족 PIN을 입력하세요.</p>
      </div>
      {members.length === 0 ? (
        <p className="card text-sm text-muted">
          등록된 구성원이 없습니다. 서버에서 <code>npm run db:seed</code>(컨테이너는 기동 시 자동)를 실행해 첫
          관리자를 만드세요.
        </p>
      ) : (
        <LoginForm members={members.map((m) => ({ id: m.id, name: m.name }))} />
      )}
    </main>
  )
}
