import Link from 'next/link'
import ActionForm from '@/components/ActionForm'
import BookCover from '@/components/BookCover'
import { prisma } from '@/lib/db'
import { COPY_STATUS_LABEL, LOCATION_KIND_LABEL, formatCopyCode } from '@/lib/format'
import { descendantIds, type LocationNode } from '@/lib/location'
import { moveCopies } from '@/server/actions/books'
import { requireMember } from '@/server/auth'
import { loadLocations, shelfOptions, type LocationIndex } from '@/server/queries'

export default async function ShelvesPage({ searchParams }: { searchParams: Promise<{ loc?: string }> }) {
  const me = await requireMember()
  const { loc: selected } = await searchParams
  const loc = await loadLocations()
  const counts = new Map(
    (await prisma.copy.groupBy({ by: ['locationId'], _count: { _all: true } })).map((r) => [r.locationId, r._count._all]),
  )
  const total = (id: string) => descendantIds(id, loc.children).reduce((sum, d) => sum + (counts.get(d) ?? 0), 0)
  const unplaced = counts.get(null) ?? 0

  const isNone = selected === 'none'
  const current = selected && !isNone ? loc.byId.get(selected) : undefined
  const ids = current ? descendantIds(current.id, loc.children) : []
  const copies =
    current || isNone
      ? await prisma.copy.findMany({
          where: isNone ? { locationId: null } : { locationId: { in: ids } },
          include: { book: true, owner: true },
          orderBy: [{ locationId: 'asc' }, { seq: 'asc' }],
          take: 500,
        })
      : []

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="card h-fit space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold">서가</h1>
          {me.isAdmin && (
            <Link href="/settings#locations" className="text-xs text-muted underline">
              위치 편집
            </Link>
          )}
        </div>
        {loc.locations.length === 0 ? (
          <p className="text-muted">
            아직 위치가 없습니다. {me.isAdmin ? <Link href="/settings#locations" className="underline">설정</Link> : '관리자'}에서 공간·책장·칸을 만드세요.
          </p>
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
      </aside>

      <section className="space-y-3">
        {!current && !isNone ? (
          <p className="card text-sm text-muted">왼쪽에서 공간·책장·칸을 고르면 꽂혀 있는 책이 보입니다.</p>
        ) : (
          <>
            <div className="card">
              <p className="text-xs text-muted">{current ? LOCATION_KIND_LABEL[current.kind] : ''}</p>
              <h2 className="text-lg font-semibold">
                {current ? (
                  <>
                    {loc.describe(current.id)!.code} · {loc.describe(current.id)!.name}
                    {loc.describe(current.id)!.zone && (
                      <span className="chip ml-2 align-middle text-white" style={{ background: loc.describe(current.id)!.zone!.color }}>
                        {loc.describe(current.id)!.zone!.name}
                      </span>
                    )}
                  </>
                ) : (
                  '위치 미지정'
                )}
              </h2>
              <p className="text-sm text-muted">{copies.length}권</p>
              {me.isAdmin && current?.kind === 'SHELF' && (
                <Link href={`/add/photo?loc=${current.id}`} className="mt-2 inline-block text-sm text-brand underline">
                  이 칸 사진으로 일괄 등록
                </Link>
              )}
            </div>
            {copies.length > 0 && (
              <ActionForm action={moveCopies} className="space-y-3">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {copies.map((c) => (
                    <li key={c.id} className="card flex min-w-0 items-center gap-3 p-2">
                      {me.isAdmin && <input type="checkbox" name="copyId" value={c.id} aria-label={`${c.book.title} 선택`} />}
                      <BookCover title={c.book.title} coverUrl={c.book.coverUrl} size="sm" />
                      <div className="min-w-0 text-sm">
                        <Link href={`/books/${c.bookId}`} className="block truncate font-medium hover:underline">
                          {c.book.title}
                          {c.book.volumeNo != null && ` ${c.book.volumeNo}권`}
                        </Link>
                        <p className="truncate text-xs text-muted">
                          {formatCopyCode(c.seq)}
                          {c.locationId && current?.kind !== 'SHELF' && ` · ${loc.describe(c.locationId)?.code}`}
                          {c.owner && ` · ${c.owner.name}`}
                          {c.status !== 'ON_SHELF' && ` · ${COPY_STATUS_LABEL[c.status]}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                {me.isAdmin && (
                  <div className="card sticky bottom-20 flex flex-wrap items-center gap-2 sm:bottom-4">
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
          </>
        )}
      </section>
    </div>
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
            <span className="text-xs text-muted">{total(n.id)}</span>
          </Link>
          <Tree parentId={n.id} loc={loc} selected={selected} total={total} />
        </li>
      ))}
    </ul>
  )
}
