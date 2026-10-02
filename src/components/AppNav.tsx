'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/', label: '검색', icon: 'M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z' },
  { href: '/shelves', label: '서가', icon: 'M4 4h4v16H4zM10 4h4v16h-4zM16 6l3.5-.9 3 15-3.5.9z' },
  { href: '/me', label: '내 독서', icon: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5' },
  { href: '/stats', label: '취향', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { href: '/recommend', label: '추천', icon: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z' },
]

function useNav(isAdmin: boolean) {
  const path = usePathname()
  const items = isAdmin ? [...ITEMS.slice(0, 1), { href: '/add', label: '등록', icon: 'M12 5v14M5 12h14' }, ...ITEMS.slice(1)] : ITEMS
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href))
  return { items, active }
}

/** 데스크톱(sm 이상) 상단 메뉴. */
export function DesktopNav({ isAdmin }: { isAdmin: boolean }) {
  const { items, active } = useNav(isAdmin)
  return (
      <nav className="hidden gap-1 sm:flex">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`rounded-lg px-3 py-1.5 text-sm ${active(i.href) ? 'bg-brand-soft font-semibold text-brand' : 'text-muted hover:text-ink'}`}
          >
            {i.label}
          </Link>
        ))}
      </nav>
  )
}

/**
 * 모바일 하단 탭. backdrop-filter가 있는 header 안에 두면 fixed 기준이 header가 되어
 * 위로 붙어 버리므로, 반드시 header 밖(레이아웃 최상위)에서 렌더한다.
 */
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const { items, active } = useNav(isAdmin)
  return (
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active(i.href) ? 'font-semibold text-brand' : 'text-muted'}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={i.icon} />
            </svg>
            {i.label}
          </Link>
        ))}
      </nav>
  )
}
