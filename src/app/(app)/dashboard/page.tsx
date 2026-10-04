import { Suspense } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/components/Art'
import BookCover from '@/components/BookCover'
import LibraryCover from '@/components/library/LibraryCover'
import { readLibraryAppearance } from '@/lib/library-appearance'
import FamilyInfo from '@/components/FamilyInfo'
import SponsorBanner from '@/components/SponsorBanner'
import { prisma } from '@/lib/db'
import { NOTE_KIND_LABEL, formatDate } from '@/lib/format'
import { ROLE_LABEL, can } from '@/lib/permissions'
import { requireMember } from '@/server/auth'
import { buildProfile } from '@/server/profile'
import { listMembers } from '@/server/queries'

/**
 * 로그인 후 첫 화면(취향 대시보드).
 *  - 기본 탭 '가족 전체': 가족 요약·구성원별 진행·최근 활동·분야별 장서 대비 완독
 *  - 구성원 탭: 그 사람의 취향(분야·월별 완독·저자·출판사·사 놓고 안 읽은 비율)
 *  - 아래: 우리 가족을 위한 정보(공공데이터, 키가 있을 때만)와 후원 배너 자리
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; welcome?: string; joined?: string; forbidden?: string }>
}) {
  const { member: me, household } = await requireMember()
  const hid = household.id
  const sp = await searchParams
  const members = await listMembers(hid)
  const target = sp.m ? members.find((x) => x.id === sp.m) : undefined

  return (
    <div className="space-y-5">
      <LibraryCover appearance={readLibraryAppearance(me.libraryAppearance)} householdName={household.name} />
      {sp.welcome && (
        <p className="rounded-lg bg-brand-soft p-3 text-sm text-brand">
          {household.name}을 만들었습니다. 책을 등록하고 가족을 초대해 보세요.
        </p>
      )}
      {sp.joined && <p className="rounded-lg bg-brand-soft p-3 text-sm text-brand">{household.name}에 참여했습니다. 반가워요!</p>}
      {sp.forbidden && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">그 화면은 권한이 있는 가족만 쓸 수 있습니다.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-bold">취향 대시보드</h1>
        <Link href="/customize" className="btn-ghost text-xs">서재 꾸미기</Link>
        <Link href="/dashboard" className={`chip px-3 py-1 ${!target ? 'bg-brand text-white' : 'bg-white ring-1 ring-line'}`}>
          가족 전체
        </Link>
        {members.map((x) => (
          <Link
            key={x.id}
            href={`/dashboard?m=${x.id}`}
            className={`chip px-3 py-1 ${x.id === target?.id ? 'bg-brand text-white' : 'bg-white ring-1 ring-line'}`}
          >
            {x.name}
          </Link>
        ))}
      </div>

      {target ? <MemberView hid={hid} member={target} /> : <FamilyView hid={hid} me={me} members={members} />}

      <Suspense fallback={<p className="text-xs text-muted">우리 동네 정보를 불러오는 중…</p>}>
        <FamilyInfo household={household} />
      </Suspense>
      <SponsorBanner neighborhoodId={household.neighborhoodId} />
    </div>
  )
}

// ── 가족 전체 ─────────────────────────────────────────────────────────────

async function FamilyView({
  hid,
  me,
  members,
}: {
  hid: string
  me: { id: string; role: Parameters<typeof can>[0] }
  members: Awaited<ReturnType<typeof listMembers>>
}) {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1))
  const inHousehold = { member: { householdId: hid } }
  const [bookCount, copyCount, locationCount, monthDone, yearDone, readingNow, recentDone, recentNotes, owned, doneByCat] = await Promise.all([
    prisma.book.count({ where: { householdId: hid } }),
    prisma.copy.count({ where: { book: { householdId: hid } } }),
    prisma.location.count({ where: { householdId: hid, kind: 'SHELF' } }),
    prisma.reading.count({ where: { ...inHousehold, status: 'DONE', finishedAt: { gte: monthStart } } }),
    prisma.reading.groupBy({ by: ['memberId'], where: { ...inHousehold, status: 'DONE', finishedAt: { gte: yearStart } }, _count: { _all: true } }),
    prisma.reading.findMany({ where: { ...inHousehold, status: 'READING' }, include: { book: true }, orderBy: { updatedAt: 'desc' } }),
    prisma.reading.findMany({
      where: { ...inHousehold, status: 'DONE', finishedAt: { not: null } },
      include: { book: true, member: true },
      orderBy: { finishedAt: 'desc' },
      take: 8,
    }),
    prisma.note.findMany({
      where: { reading: inHousehold },
      include: { reading: { include: { book: true, member: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.book.groupBy({ by: ['category'], where: { householdId: hid, copies: { some: {} } }, _count: { _all: true } }),
    prisma.book.groupBy({ by: ['category'], where: { householdId: hid, readings: { some: { status: 'DONE' } } }, _count: { _all: true } }),
  ])
  const yearByMember = new Map(yearDone.map((r) => [r.memberId, r._count._all]))
  const yearTotal = yearDone.reduce((s, r) => s + r._count._all, 0)
  const doneCat = new Map(doneByCat.map((r) => [r.category, r._count._all]))
  const rows = owned
    .map((r) => ({ category: r.category, owned: r._count._all, done: doneCat.get(r.category) ?? 0 }))
    .sort((a, b) => b.owned - a.owned)
  const maxOwned = Math.max(1, ...rows.map((r) => r.owned))
  const maxYear = Math.max(1, ...members.map((m) => yearByMember.get(m.id) ?? 0))

  const steps = [
    { done: locationCount > 0, label: '서가 위치(공간·책장·칸) 만들기', href: '/settings#locations', need: can(me.role, 'location.manage') },
    { done: bookCount > 0, label: '첫 책 등록하기(바코드·검색·사진)', href: '/add', need: can(me.role, 'book.write') },
    { done: members.length > 1, label: '가족 초대하기', href: '/settings#invite', need: can(me.role, 'family.invite') },
    { done: readingNow.length + recentDone.length > 0, label: '읽는 중·완독 기록 남기기', href: '/search', need: true },
  ].filter((s) => s.need)

  return (
    <>
      {steps.some((s) => !s.done) && (
        <section className="card space-y-2 border-brand/30 bg-brand-soft/40">
          <h2 className="font-semibold">시작하기</h2>
          <ol className="grid gap-2 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Link href={s.href} className={`flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-line ${s.done ? 'text-muted line-through' : 'hover:ring-brand'}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${s.done ? 'bg-brand text-white' : 'bg-paper'}`}>
                    {s.done ? '✓' : i + 1}
                  </span>
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {bookCount === 0 && (
        <EmptyState
          art="shelvesEmpty"
          title="아직 등록된 책이 없어요"
          action={can(me.role, 'book.write') ? { href: '/add', label: '첫 책 등록하기' } : undefined}
        >
          바코드·제목 검색으로 한 권씩, 또는 책장 한 칸을 사진으로 찍어 여러 권을 한 번에 등록할 수 있습니다.
        </EmptyState>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="우리 집 장서" value={`${bookCount.toLocaleString()}종`} sub={`소장본 ${copyCount.toLocaleString()}권`} />
        <Tile label="이번 달 가족 완독" value={`${monthDone}권`} />
        <Tile label={`${now.getFullYear()}년 가족 완독`} value={`${yearTotal}권`} />
        <Tile label="지금 읽는 중" value={`${readingNow.length}권`} />
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">구성원별 올해 독서</h2>
        <ul className="space-y-2">
          {members.map((m) => {
            const n = yearByMember.get(m.id) ?? 0
            const now = readingNow.find((r) => r.memberId === m.id)
            return (
              <li key={m.id} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-sm">
                <Link href={`/dashboard?m=${m.id}`} className="truncate font-medium hover:underline">
                  {m.name}
                  <span className="ml-1 text-[10px] text-muted">{ROLE_LABEL[m.role]}</span>
                </Link>
                <div className="h-3 rounded bg-brand-soft">
                  <div className="h-3 rounded bg-brand" style={{ width: `${(n / maxYear) * 100}%`, minWidth: n ? 6 : 0 }} />
                </div>
                <span className="w-40 truncate text-right text-xs text-muted">
                  완독 {n}권{now && ` · 읽는 중 『${now.book.title}』`}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-2">
          <h2 className="font-semibold">최근 완독</h2>
          {recentDone.length === 0 ? (
            <p className="text-sm text-muted">완독을 기록하면 가족 모두에게 보입니다.</p>
          ) : (
            <ul className="grid grid-cols-4 gap-3">
              {recentDone.map((r) => (
                <li key={r.id}>
                  <Link href={`/books/${r.bookId}`} className="block space-y-1">
                    <BookCover title={r.book.title} coverUrl={r.book.coverUrl} size="fill" />
                    <p className="line-clamp-1 text-xs">{r.book.title}</p>
                    <p className="text-[10px] text-muted">
                      {r.member.name} · {formatDate(r.finishedAt)}
                      {r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card space-y-2">
          <h2 className="font-semibold">가족의 최근 기록</h2>
          {recentNotes.length === 0 ? (
            <p className="text-sm text-muted">독후감·인용구를 남기면 여기에 모입니다.</p>
          ) : (
            <ul className="space-y-3">
              {recentNotes.map((n) => (
                <li key={n.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                  <div className="mb-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="chip bg-brand-soft text-brand">{NOTE_KIND_LABEL[n.kind]}</span>
                    <span>{n.reading.member.name}</span>
                    <Link href={`/books/${n.reading.bookId}`} className="font-medium text-ink hover:underline">
                      {n.reading.book.title}
                    </Link>
                  </div>
                  <p className="line-clamp-2 text-sm">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CategoryBars title="분야별 장서와 가족 완독" rows={rows} maxOwned={maxOwned} note="진한 부분 = 가족 중 누군가 완독한 책" />
    </>
  )
}

// ── 구성원별 ─────────────────────────────────────────────────────────────

async function MemberView({ hid, member }: { hid: string; member: { id: string; name: string } }) {
  const profile = await buildProfile(hid, member.id)
  const owned = await prisma.book.groupBy({ by: ['category'], _count: { _all: true }, where: { householdId: hid, copies: { some: {} } } })
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
    <>
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

      <CategoryBars title={`분야별 장서와 ${member.name}님의 완독`} rows={rows} maxOwned={maxOwned} note="막대 = 집에 있는 책, 진한 부분 = 완독" />

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
        <RankList title="자주 읽고 높게 평가한 저자" items={profile.topAuthors.map(([a, s]) => [a, `${Math.round(s)}점`])} link={(a) => `/search?q=${encodeURIComponent(a)}`} />
        <RankList title="자주 읽은 출판사" items={profile.topPublishers.map(([p, n]) => [p, `${n}권`])} link={(p) => `/search?q=${encodeURIComponent(p)}`} />
      </div>
      <p className="text-xs text-muted">점수 = 완독 1권당 별점(없으면 3점), 최근 12개월 완독은 2배. 완독·별점을 기록할수록 정확해집니다.</p>
    </>
  )
}

// ── 공통 ──────────────────────────────────────────────────────────────────

function CategoryBars({
  title,
  rows,
  maxOwned,
  note,
}: {
  title: string
  rows: { category: string; owned: number; done: number }[]
  maxOwned: number
  note: string
}) {
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-muted">{note}</p>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted">등록된 책이 없습니다.</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.category} className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-2 text-sm">
            <Link href={`/search?category=${encodeURIComponent(r.category)}`} className="truncate hover:underline">
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
