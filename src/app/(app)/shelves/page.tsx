import Link from 'next/link'
import type { CopyStatus, ReadingStatus } from '@prisma/client'
import ActionForm from '@/components/ActionForm'
import { EmptyState } from '@/components/Art'
import BookCover from '@/components/BookCover'
import LibraryCover from '@/components/library/LibraryCover'
import { readLibraryAppearance } from '@/lib/library-appearance'
import { prisma } from '@/lib/db'
import { COPY_STATUS_LABEL, LOCATION_KIND_LABEL, READING_STATUS_LABEL, formatCopyCode } from '@/lib/format'
import { descendantIds, type LocationNode } from '@/lib/location'
import { can } from '@/lib/permissions'
import { moveCopies } from '@/server/actions/books'
import { requireMember } from '@/server/auth'
import { copyCountsByLocation, loadLocations, shelfOptions, type LocationIndex } from '@/server/queries'

const MAX_COPIES = 600

/**
 * 서가 — 표지 중심 화면. 칸마다 한 줄(선반)로 표지를 늘어놓는다.
 * 왼쪽 트리에서 공간·책장을 고르면 그 아래 칸만, 아무것도 고르지 않으면 집 전체 서가를 보여 준다.
 * ?select=1 이면 표지마다 체크박스가 생겨 여러 권을 한 번에 다른 칸으로 옮길 수 있다(구성원 이상).
 */
export default async function ShelvesPage({ searchParams }: { searchParams: Promise<{ loc?: string; select?: string }> }) {
  const { member: me, household } = await requireMember()
  const hid = household.id
  const { loc: selected, select } = await searchParams
  const canWrite = can(me.role, 'book.write')
  const selecting = canWrite && select === '1'
  const [loc, counts] = await Promise.all([loadLocations(hid), copyCountsByLocation(hid)])
  const total = (id: string) => descendantIds(id, loc.children).reduce((sum, d) => sum + (counts.get(d) ?? 0), 0)
  const unplaced = counts.get(null) ?? 0
  const allCount = [...counts.values()].reduce((a, b) => a + b, 0)

  const isNone = selected === 'none'
  const current = selected && !isNone ? loc.byId.get(selected) : undefined
  const scope = current ? descendantIds(current.id, loc.children) : null
  const copies = await prisma.copy.findMany({
    where: {
      book: { householdId: hid },
      ...(isNone ? { locationId: null } : scope ? { locationId: { in: scope } } : {}),
    },
    include: { book: { select: { id: true, title: true, coverUrl: true, volumeNo: true, authors: true } }, owner: true },
    orderBy: [{ locationId: 'asc' }, { seq: 'asc' }],
    take: MAX_COPIES,
  })
  const myReadings = new Map(
    (
      await prisma.reading.findMany({
        where: { memberId: me.id, bookId: { in: [...new Set(copies.map((c) => c.bookId))] } },
        select: { bookId: true, status: true },
      })
    ).map((r) => [r.bookId, r.status]),
  )

  // 칸(또는 위치 미지정) 단위로 묶어 선반 한 줄씩 그린다. 순서는 위치 코드 순.
  const groups = new Map<string | null, typeof copies>()
  for (const c of copies) groups.set(c.locationId, [...(groups.get(c.locationId) ?? []), c])
  const shelves = [...groups.entries()].sort(([a], [b]) => {
    if (a === null) return 1
    if (b === null) return -1
    return (loc.describe(a)?.code ?? '').localeCompare(loc.describe(b)?.code ?? '', 'ko', { numeric: true })
  })
  const selfHref = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams()
    if (selected) u.set('loc', selected)
    for (const [k, v] of Object.entries(extra)) if (v) u.set(k, v)
    else u.delete(k)
    const qs = u.toString()
    return qs ? `/shelves?${qs}` : '/shelves'
  }

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="h-fit text-sm md:sticky md:top-20">
        <details className="card space-y-2" open>
          <summary className="flex cursor-pointer items-center justify-between font-semibold">
            서가 위치
            {can(me.role, 'location.manage') && (
              <Link href="/settings#locations" className="text-xs font-normal text-muted underline">
                위치 편집
              </Link>
            )}
          </summary>
          <Link
            href="/shelves"
            className={`flex justify-between rounded px-2 py-1 ${!selected ? 'bg-brand-soft font-semibold text-brand' : 'hover:bg-paper'}`}
          >
            <span>집 전체</span>
            <span className="text-muted">{allCount}</span>
          </Link>
          {loc.locations.length === 0 ? (
            <p className="px-2 text-muted">아직 위치가 없습니다. 설정에서 공간·책장·칸을 만드세요.</p>
          ) : (
            <Tree parentId={null} loc={loc} selected={selected} total={total} />
          )}
          <Link
            href="/shelves?loc=none"
            className={`flex justify-between rounded px-2 py-1 ${isNone ? 'bg-brand-soft font-semibold text-brand' : 'hover:bg-paper'}`}
          >
            <span>위치 미지정</span>
            <span className="text-muted">{unplaced}</span>
          </Link>
        </details>
      </aside>

      <section className="min-w-0 space-y-4">
        <LibraryCover appearance={readLibraryAppearance(me.libraryAppearance)} householdName={household.name} />
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs text-muted">{current ? LOCATION_KIND_LABEL[current.kind] : isNone ? '' : '우리 집'}</p>
            <h1 className="text-xl font-bold">
              {current ? `${loc.describe(current.id)!.code} · ${loc.describe(current.id)!.name}` : isNone ? '위치 미지정' : '집 전체 서가'}
            </h1>
            <p className="text-sm text-muted">
              {copies.length}권{copies.length >= MAX_COPIES && ` (최대 ${MAX_COPIES}권까지 표시 — 왼쪽에서 범위를 좁혀 보세요)`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/customize" className="btn-ghost">서재 꾸미기</Link>
            {canWrite && current?.kind === 'SHELF' && (
              <Link href={`/add/photo?loc=${current.id}`} className="btn-ghost">
                이 칸 사진으로 등록
              </Link>
            )}
            {canWrite && copies.length > 0 && (
              <Link href={selfHref({ select: selecting ? undefined : '1' })} className={selecting ? 'btn-primary' : 'btn-ghost'}>
                {selecting ? '선택 끝내기' : '여러 권 옮기기'}
              </Link>
            )}
          </div>
        </div>

        {loc.locations.length === 0 ? (
          <EmptyState
            art="shelvesEmpty"
            title="서가 위치를 먼저 만들어 주세요"
            action={can(me.role, 'location.manage') ? { href: '/settings#locations', label: '공간·책장·칸 만들기' } : undefined}
          >
            거실·서재·아이방 같은 공간과 책장, 칸을 정해 두면 책마다 꽂힌 자리를 기록할 수 있습니다.
          </EmptyState>
        ) : copies.length === 0 ? (
          <EmptyState
            art="shelvesEmpty"
            title={allCount === 0 ? '아직 등록된 책이 없어요' : '이 위치에 꽂힌 책이 없어요'}
            action={canWrite ? { href: current?.kind === 'SHELF' ? `/add/photo?loc=${current.id}` : '/add', label: allCount === 0 ? '첫 책 등록하기' : '책 등록하기' } : undefined}
          />
        ) : (
          <ActionForm action={moveCopies} className="space-y-5">
            {shelves.map(([locationId, items]) => {
              const d = loc.describe(locationId)
              return (
                <div key={locationId ?? 'none'} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {d?.zone && <span className="inline-block h-3 w-3 rounded-full" style={{ background: d.zone.color }} />}
                    <Link href={locationId ? `/shelves?loc=${locationId}` : '/shelves?loc=none'} className="font-semibold hover:underline">
                      {d ? d.code : '위치 미지정'}
                    </Link>
                    <span className="truncate text-muted">{d ? `${d.name}${d.zone ? ` · ${d.zone.name}` : ''}` : ''}</span>
                    <span className="ml-auto text-xs text-muted">{items.length}권</span>
                  </div>
                  {/* 선반: 표지를 바닥선 위에 세운다 */}
                  <ul className="library-shelf-row">
                    {items.map((c) => (
                      <CoverTile
                        key={c.id}
                        copy={c}
                        reading={myReadings.get(c.bookId)}
                        selecting={selecting}
                      />
                    ))}
                  </ul>
                </div>
              )
            })}
            {selecting && (
              <div className="card sticky bottom-20 z-10 flex flex-wrap items-center gap-2 shadow-lg sm:bottom-4">
                <span className="text-sm text-muted">고른 책을</span>
                <select name="toLocationId" className="input max-w-xs" required defaultValue="">
                  <option value="">옮길 칸</option>
                  {shelfOptions(loc).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button className="btn-primary">옮기기</button>
              </div>
            )}
          </ActionForm>
        )}
      </section>
    </div>
  )
}

const READ_BADGE: Partial<Record<ReadingStatus, string>> = { DONE: 'bg-brand text-white', READING: 'bg-accent text-white' }

function CoverTile({
  copy: c,
  reading,
  selecting,
}: {
  copy: {
    id: string
    seq: number
    bookId: string
    status: CopyStatus
    book: { title: string; coverUrl: string | null; volumeNo: number | null; authors: string }
    owner: { name: string } | null
  }
  reading?: ReadingStatus
  selecting: boolean
}) {
  const away = c.status !== 'ON_SHELF'
  const title = `${c.book.title}${c.book.volumeNo != null ? ` ${c.book.volumeNo}권` : ''}`
  const inner = (
    <>
      <div className={`relative transition group-hover:-translate-y-1 ${away ? 'opacity-50' : ''}`}>
        <BookCover title={title} coverUrl={c.book.coverUrl} size="fill" />
        {reading && READ_BADGE[reading] && (
          <span className={`chip absolute top-1 left-1 text-[10px] shadow ${READ_BADGE[reading]}`}>{READING_STATUS_LABEL[reading]}</span>
        )}
        {away && <span className="chip absolute right-1 bottom-1 bg-white/90 text-[10px] text-ink">{COPY_STATUS_LABEL[c.status]}</span>}
        {/* 마우스를 올리면(모바일은 표지 아래 제목) 제목·저자 */}
        <div className="pointer-events-none absolute inset-0 hidden flex-col justify-end rounded bg-gradient-to-t from-black/75 to-transparent p-2 text-white group-hover:flex">
          <p className="line-clamp-3 text-xs font-semibold">{title}</p>
          {c.book.authors && <p className="truncate text-[10px] opacity-80">{c.book.authors}</p>}
        </div>
      </div>
      <p className="shelf-book-title mt-1 line-clamp-2 text-[11px] leading-tight text-ink/80">{title}</p>
    </>
  )
  return (
    <li className="group min-w-0" title={`${title} · ${formatCopyCode(c.seq)}${c.owner ? ` · ${c.owner.name}` : ''}`}>
      {selecting ? (
        <label className="group/pick block cursor-pointer">
          <input type="checkbox" name="copyId" value={c.id} className="peer sr-only" />
          <div className="relative rounded-md ring-brand ring-offset-2 peer-checked:ring-4 peer-focus-visible:outline-3 peer-focus-visible:outline-accent">
            {inner}
            {/* 선택 상태는 색만이 아니라 체크 표시로도 알린다 */}
            <span aria-hidden className="absolute top-1 right-1 hidden h-6 w-6 items-center group-has-[:checked]/pick:flex justify-center rounded-full bg-brand text-sm font-bold text-white shadow">✓</span>
          </div>
        </label>
      ) : (
        <Link href={`/books/${c.bookId}`} className="block">
          {inner}
        </Link>
      )}
    </li>
  )
}

function Tree({
  parentId,
  loc,
  selected,
  total,
}: {
  parentId: string | null
  loc: LocationIndex
  selected?: string
  total: (id: string) => number
}) {
  const nodes: LocationNode[] = loc.children.get(parentId) ?? []
  if (nodes.length === 0) return null
  return (
    <ul className={parentId ? 'ml-3 border-l border-line pl-2' : ''}>
      {nodes.map((n) => (
        <li key={n.id}>
          <Link
            href={`/shelves?loc=${n.id}`}
            className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${selected === n.id ? 'bg-brand-soft font-semibold text-brand' : 'hover:bg-paper'}`}
          >
            <span className="truncate">
              {n.zone && <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: n.zone.color }} />}
              <span className="font-mono text-xs text-muted">{n.code}</span> {n.name}
            </span>
            <span className="shrink-0 text-xs text-muted tabular-nums">{total(n.id)}</span>
          </Link>
          <Tree parentId={n.id} loc={loc} selected={selected} total={total} />
        </li>
      ))}
    </ul>
  )
}
