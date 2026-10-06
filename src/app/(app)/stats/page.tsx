import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireMember } from '@/server/auth'
import { buildProfile } from '@/server/profile'
import { listMembers } from '@/server/queries'

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const me = await requireMember()
  const { m } = await searchParams
  const members = await listMembers()
  const member = members.find((x) => x.id === m) ?? me
  const profile = await buildProfile(member.id)

  const owned = await prisma.book.groupBy({ by: ['category'], _count: { _all: true }, where: { copies: { some: {} } } })
  const totalBooks = owned.reduce((s, r) => s + r._count._all, 0)
  const rows = owned
    .map((r) => ({ category: r.category, owned: r._count._all, done: profile.categoryDone.get(r.category) ?? 0 }))
    .sort((a, b) => b.owned - a.owned)
  const maxOwned = Math.max(1, ...rows.map((r) => r.owned))

  const months: { key: string; label: string; n: number }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
    const key = d.toISOString().slice(0, 7)
    months.push({ key, label: `${d.getUTCMonth() + 1}월`, n: profile.monthly.get(key) ?? 0 })
  }
  const maxMonth = Math.max(1, ...months.map((x) => x.n))
  const yearDone = months.reduce((s, x) => s + x.n, 0)
  const unreadPct = profile.owned ? Math.round((profile.ownedUnread / profile.owned) * 100) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-bold">취향 대시보드</h1>
        {members.map((x) => (
          <Link key={x.id} href={`/stats?m=${x.id}`} className={`chip px-3 py-1 ${x.id === member.id ? 'bg-brand text-white' : 'bg-white ring-1 ring-line'}`}>
            {x.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="최근 12개월 완독" value={`${yearDone}권`} />
        <Tile label="전체 완독" value={`${profile.doneCount}권`} />
        <Tile label="평균 별점" value={profile.avgRating ? `★ ${profile.avgRating}` : '-'} />
        <Tile
          label="사 놓고 안 읽은 비율"
          value={unreadPct == null ? '-' : `${unreadPct}%`}
          sub={profile.owned ? `소유 ${profile.owned}권 중 ${profile.ownedUnread}권` : '소유자로 지정된 책이 없습니다'}
        />
      </div>

      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold">분야별 장서와 {member.name}님의 완독</h2>
          <p className="text-xs text-muted">막대 = 집에 있는 책(전체 {totalBooks}권), 진한 부분 = 완독</p>
        </div>
        {rows.length === 0 && <p className="text-sm text-muted">등록된 책이 없습니다.</p>}
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.category} className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-2 text-sm">
              <Link href={`/?category=${encodeURIComponent(r.category)}`} className="truncate hover:underline">
                {r.category}
              </Link>
              <div className="relative h-4 rounded bg-brand-soft" style={{ width: `${(r.owned / maxOwned) * 100}%` }} title={`${r.owned}권 중 ${r.done}권 완독`}>
                <div className="absolute inset-y-0 left-0 rounded bg-brand" style={{ width: `${(Math.min(r.done, r.owned) / r.owned) * 100}%` }} />
              </div>
              <span className="text-right text-xs text-muted">
                {r.done}/{r.owned}권
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">월별 완독(최근 12개월)</h2>
        <div className="flex h-36 items-end gap-1">
          {months.map((x) => (
            <div key={x.key} className="flex flex-1 flex-col items-center gap-1" title={`${x.key}: ${x.n}권`}>
              <span className="text-[10px] text-muted">{x.n || ''}</span>
              <div className="w-full rounded-t bg-brand" style={{ height: `${(x.n / maxMonth) * 100}px`, minHeight: x.n ? 4 : 1, opacity: x.n ? 1 : 0.2 }} />
              <span className="text-[10px] text-muted">{x.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <RankList title="자주 읽고 높게 평가한 저자" items={profile.topAuthors.map(([a, s]) => [a, `${Math.round(s)}점`])} link={(a) => `/?q=${encodeURIComponent(a)}`} />
        <RankList title="자주 읽은 출판사" items={profile.topPublishers.map(([p, n]) => [p, `${n}권`])} link={(p) => `/?q=${encodeURIComponent(p)}`} />
      </div>
      <p className="text-xs text-muted">점수 = 완독 1권당 별점(없으면 3점), 최근 12개월 완독은 2배. 완독·별점을 기록할수록 정확해집니다.</p>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  )
}

function RankList({ title, items, link }: { title: string; items: [string, string][]; link: (k: string) => string }) {
  return (
    <section className="card space-y-2">
      <h2 className="font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">완독 기록이 쌓이면 보입니다.</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {items.map(([k, v], i) => (
            <li key={k} className="flex justify-between">
              <Link href={link(k)} className="hover:underline">
                {i + 1}. {k}
              </Link>
              <span className="text-muted">{v}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
