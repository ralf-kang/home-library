import Link from 'next/link'
import type { AgeGroup, ReadingStatus } from '@prisma/client'
import BookCover from '@/components/BookCover'
import { READING_STATUS_LABEL } from '@/lib/format'
import { can } from '@/lib/permissions'
import { requireMember } from '@/server/auth'
import { listCategories, listMembers, loadLocations, searchBooks, type SearchParams } from '@/server/queries'

const MY_STATUS: (ReadingStatus | 'UNREAD')[] = ['UNREAD', 'READING', 'DONE', 'WANT', 'DROPPED', 'REFERENCE']

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { member: me, household } = await requireMember()
  const hid = household.id
  const canWrite = can(me.role, 'book.write')
  const sp = await searchParams
  const params: SearchParams = {
    q: sp.q,
    category: sp.category || undefined,
    locationId: sp.loc || undefined,
    ownerId: sp.owner || undefined,
    ageGroup: sp.age === 'ADULT' || sp.age === 'CHILD' ? (sp.age as AgeGroup) : undefined,
    myStatus: MY_STATUS.includes(sp.my as ReadingStatus) ? (sp.my as SearchParams['myStatus']) : undefined,
    needsReview: sp.review === '1',
    page: Number(sp.page) || 1,
  }
  const loc = await loadLocations(hid)
  const [result, categories, members] = await Promise.all([searchBooks(hid, me.id, params, loc), listCategories(hid), listMembers(hid)])
  const hasFilter = Boolean(params.q || params.category || params.locationId || params.ownerId || params.ageGroup || params.myStatus || params.needsReview)
  const pageHref = (page: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => Boolean(e[1])))
    u.set('page', String(page))
    return `/search?${u}`
  }

  return (
    <div className="space-y-4">
      {sp.deleted && <p className="rounded-lg bg-brand-soft p-3 text-sm text-brand">책을 지웠습니다.</p>}
      <form className="space-y-2" action="/search">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="제목·저자·메모, ISBN, 초성(ㅅㅍㅇㅅ)"
            className="input py-3 text-base"
            autoFocus={!hasFilter}
          />
          <button className="btn-primary shrink-0 px-5 whitespace-nowrap">찾기</button>
        </div>
        <details className="text-sm" open={hasFilter && !params.q}>
          <summary className="cursor-pointer text-muted">필터</summary>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <select name="category" defaultValue={params.category ?? ''} className="input">
              <option value="">모든 분야</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category} ({c.count})
                </option>
              ))}
            </select>
            <select name="loc" defaultValue={params.locationId ?? ''} className="input">
              <option value="">모든 위치</option>
              {loc.locations
                .filter((l) => l.kind !== 'SHELF')
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {loc.describe(l.id)!.code} · {l.name}
                  </option>
                ))}
            </select>
            <select name="owner" defaultValue={params.ownerId ?? ''} className="input">
              <option value="">모든 소유자</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select name="my" defaultValue={params.myStatus ?? ''} className="input">
              <option value="">내 읽음 상태 전체</option>
              {MY_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s === 'UNREAD' ? '안 읽음' : READING_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select name="age" defaultValue={params.ageGroup ?? ''} className="input">
              <option value="">어른·어린이</option>
              <option value="ADULT">어른 책</option>
              <option value="CHILD">어린이 책</option>
            </select>
          </div>
          {canWrite && (
            <label className="mt-2 flex items-center gap-2 text-muted">
              <input type="checkbox" name="review" value="1" defaultChecked={params.needsReview} /> 확인 필요한 책만(사진 판독 등록분)
            </label>
          )}
        </details>
      </form>

      <div className="flex items-baseline justify-between text-sm text-muted">
        <span>
          {hasFilter ? '검색 결과' : '최근 등록·수정한 책'} <b className="text-ink">{result.total.toLocaleString()}</b>권
        </span>
        {hasFilter && (
          <Link href="/search" className="underline">
            초기화
          </Link>
        )}
      </div>

      {result.books.length === 0 ? (
        <div className="card text-center text-sm text-muted">
          {hasFilter ? '조건에 맞는 책이 없습니다.' : '아직 등록된 책이 없습니다.'}
          {canWrite && (
            <div className="mt-3">
              <Link href="/add" className="btn-primary">
                책 등록하기
              </Link>
            </div>
          )}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {result.books.map((book) => {
            const mine = book.readings[0]
            const places = [...new Set(book.copies.map((c) => c.locationId))]
            return (
              <li key={book.id} className="min-w-0">
                <Link href={`/books/${book.id}`} className="card flex gap-3 p-3 hover:border-brand/40">
                  <BookCover title={book.title} coverUrl={book.coverUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {book.title}
                      {book.volumeNo != null && <span className="ml-1 text-muted">{book.volumeNo}권</span>}
                    </p>
                    <p className="truncate text-sm text-muted">{[book.authors, book.publisher].filter(Boolean).join(' · ')}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                      {places.map((pid) => {
                        const d = loc.describe(pid)
                        return (
                          <span key={pid ?? 'none'} className="chip bg-paper text-ink ring-1 ring-line">
                            {d ? (
                              <>
                                {d.zone && <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: d.zone.color }} />}
                                {d.code}
                              </>
                            ) : (
                              '위치 미지정'
                            )}
                          </span>
                        )
                      })}
                      {book.copies.length > 1 && <span className="chip bg-paper text-muted">{book.copies.length}권</span>}
                      {mine && <span className="chip bg-brand-soft text-brand">{READING_STATUS_LABEL[mine.status]}</span>}
                      {mine?.rating && <span className="text-accent">{'★'.repeat(mine.rating)}</span>}
                      {book.needsReview && <span className="chip bg-amber-100 text-amber-800">확인 필요</span>}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {result.pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {result.page > 1 && <Link href={pageHref(result.page - 1)} className="btn-ghost">이전</Link>}
          <span className="text-muted">
            {result.page} / {result.pageCount}
          </span>
          {result.page < result.pageCount && <Link href={pageHref(result.page + 1)} className="btn-ghost">다음</Link>}
        </div>
      )}
    </div>
  )
}
