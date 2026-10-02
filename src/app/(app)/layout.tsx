import Link from 'next/link'
import { DesktopNav, MobileNav } from '@/components/AppNav'
import { requireMember } from '@/server/auth'
import { logout } from '@/app/login/actions'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember()
  return (
    <div className="min-h-dvh pb-20 sm:pb-8">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="hidden sm:inline">우리집 서재</span>
          </Link>
          <div className="flex-1">
            <DesktopNav isAdmin={me.isAdmin} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            {me.isAdmin && (
              <Link href="/settings" className="text-muted hover:text-ink" title="설정">
                설정
              </Link>
            )}
            <span className="chip bg-brand-soft text-brand">{me.name}</span>
            <form action={logout}>
              <button className="text-muted hover:text-ink">나가기</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
      <MobileNav isAdmin={me.isAdmin} />
    </div>
  )
}
