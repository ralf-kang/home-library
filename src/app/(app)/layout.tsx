import Link from 'next/link'
import { DesktopNav, MobileNav } from '@/components/AppNav'
import { prisma } from '@/lib/db'
import { ROLE_LABEL, can } from '@/lib/permissions'
import { currentMembership, isPlatformAdmin } from '@/server/auth'
import { switchHousehold } from '@/server/actions/household'
import { appearanceStyle, readLibraryAppearance } from '@/lib/library-appearance'

export const dynamic = 'force-dynamic'

/**
 * 로그인 후 화면 공통 틀. 동네 주민만 하고 가구가 없는 사용자도 들어오므로 여기서는 로그인만 요구하고,
 * 가구가 필요한 페이지는 각자 requireMember()를 부른다(없으면 /onboarding).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, member, household } = await currentMembership()
  const others = await prisma.member.findMany({
    where: { userId: user.id, ...(household ? { householdId: { not: household.id } } : {}) },
    include: { household: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const canWrite = member ? can(member.role, 'book.write') : false
  const appearance = readLibraryAppearance(member?.libraryAppearance)
  return (
    <div className="library-surface min-h-dvh bg-paper pb-20 text-ink sm:pb-8" style={appearanceStyle(appearance)} data-density={appearance.density} data-titles={appearance.showTitles}>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={household ? '/dashboard' : '/neighborhood'} className="flex min-w-0 items-center gap-2 font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-7 w-7 shrink-0" />
            <span className="truncate">{household?.name ?? '우리집 서재'}</span>
          </Link>
          <div className="flex-1">
            <DesktopNav hasHousehold={Boolean(household)} canWrite={canWrite} />
          </div>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pr-1 pl-1 hover:bg-white">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                  {user.name.slice(0, 1)}
                </span>
              )}
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-64 space-y-1 rounded-xl border border-line bg-white p-2 text-sm shadow-lg">
              <div className="px-2 py-1.5">
                <p className="font-semibold">{member?.name ?? user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
                {member && <p className="mt-1 text-xs text-muted">{household?.name} · {ROLE_LABEL[member.role]}</p>}
              </div>
              {others.length > 0 && (
                <div className="border-t border-line pt-1">
                  <p className="px-2 py-1 text-xs text-muted">다른 서재로 전환</p>
                  {others.map((o) => (
                    <form key={o.householdId} action={switchHousehold.bind(null, o.householdId)}>
                      <button className="w-full rounded px-2 py-1.5 text-left hover:bg-paper">{o.household.name}</button>
                    </form>
                  ))}
                </div>
              )}
              <div className="border-t border-line pt-1">
                {member && <Link href="/customize" className="block rounded px-2 py-1.5 hover:bg-paper">나의 서재 꾸미기</Link>}
                {member && can(member.role, 'family.invite') && (
                  <Link href="/settings" className="block rounded px-2 py-1.5 hover:bg-paper">서재 설정·가족 초대</Link>
                )}
                <Link href="/onboarding?new=1" className="block rounded px-2 py-1.5 hover:bg-paper">새 서재 만들기</Link>
                {isPlatformAdmin(user.email) && (
                  <Link href="/admin" className="block rounded px-2 py-1.5 hover:bg-paper">플랫폼 관리</Link>
                )}
                <form action="/api/auth/logout" method="post">
                  <button className="w-full rounded px-2 py-1.5 text-left text-muted hover:bg-paper">로그아웃</button>
                </form>
              </div>
            </div>
          </details>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <MobileNav hasHousehold={Boolean(household)} canWrite={canWrite} />
    </div>
  )
}
