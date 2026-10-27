import Link from 'next/link'
import { redirect } from 'next/navigation'
import ActionForm from '@/components/ActionForm'
import { Illustration, Photo } from '@/components/Art'
import { PublicHeader, SiteFooter } from '@/components/SiteChrome'
import { prisma } from '@/lib/db'
import { createHouseholdAction } from '@/server/actions/household'
import { requireUser } from '@/server/auth'

export const dynamic = 'force-dynamic'

/** 가구가 없는 사용자의 첫 화면: 새 서재 만들기 또는 초대 링크로 참여. ?new=1 이면 가구가 있어도 새로 만들 수 있다. */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser()
  const { new: makeNew } = await searchParams
  const [memberships, neighborhoods] = await Promise.all([
    prisma.member.count({ where: { userId: user.id } }),
    prisma.neighborMembership.count({ where: { userId: user.id } }),
  ])
  if (memberships > 0 && !makeNew) redirect('/dashboard')

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="wrap flex-1 py-10 md:py-14">
        <div className="mx-auto grid max-w-[1000px] gap-10 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
        <div>
          <p className="text-sm text-muted">{user.email}</p>
          <h1 className="text-2xl font-bold">{memberships > 0 ? '새 서재 만들기' : `${user.name}님, 환영합니다`}</h1>
          <p className="mt-1 text-muted">우리 집 책장을 하나의 서재로 만들고, 가족을 초대해 함께 쓰세요.</p>
        </div>

        <section className="card space-y-3 p-6">
          <Illustration name="createLibrary" width={180} />
          <h2 className="text-lg font-semibold">새 서재 만들기</h2>
          <p className="text-sm text-muted">
            만든 사람이 서재의 <b>소유자</b>가 됩니다. 기본 구역(고전·소설·어린이 등)과 예시 공간(거실·서재·아이방)이 함께 만들어지고, 설정에서
            언제든 바꿀 수 있습니다.
          </p>
          <ActionForm action={createHouseholdAction} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="hh-name" className="label">서재 이름</label>
              <input id="hh-name" name="name" defaultValue={`${user.name}네 서재`} className="input" required maxLength={40} />
            </div>
            <div>
              <label htmlFor="hh-owner" className="label">서재에서 쓸 내 이름(호칭)</label>
              <input id="hh-owner" name="ownerName" defaultValue={user.name} placeholder="예: 아빠" className="input" required maxLength={20} />
            </div>
            <div className="sm:col-span-2">
              <button className="btn-primary">서재 만들기</button>
            </div>
          </ActionForm>
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold">초대를 받으셨나요?</h2>
          <p className="text-sm text-muted">
            가족이나 이웃이 보낸 초대 링크(<code>/invite/…</code>)를 열면 이 계정으로 바로 참여합니다. 서재를 따로 만들 필요가 없습니다.
          </p>
          {neighborhoods > 0 && (
            <Link href="/neighborhood" className="btn-ghost">
              참여한 동네로 가기
            </Link>
          )}
        </section>

        <form action="/api/auth/logout" method="post" className="text-center">
          <button className="min-h-11 text-sm text-muted underline">다른 계정으로 로그인</button>
        </form>
        </div>
        <aside className="hidden md:block">
          <Photo name="auth" decorative sizes="320px" className="aspect-[4/5] rounded-[24px] object-cover" />
        </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
