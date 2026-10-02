import { Fragment } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ActionForm from '@/components/ActionForm'
import BookCover from '@/components/BookCover'
import ConfirmButton from '@/components/ConfirmButton'
import {
  COPY_STATUS_LABEL,
  NOTE_KIND_LABEL,
  READING_STATUS_LABEL,
  formatCopyCode,
  formatDate,
} from '@/lib/format'
import { addCopy, deleteBook, deleteCopy, updateCopy } from '@/server/actions/books'
import { addNote, deleteNote, incrementReadCount, saveReading } from '@/server/actions/readings'
import { requireMember } from '@/server/auth'
import { getBookDetail, listMembers, loadLocations, shelfOptions } from '@/server/queries'

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ added?: string }>
}) {
  const me = await requireMember()
  const { id } = await params
  const { added } = await searchParams
  const [book, loc, members] = await Promise.all([getBookDetail(id), loadLocations(), listMembers()])
  if (!book) notFound()
  const shelves = shelfOptions(loc)
  const mine = book.readings.find((r) => r.memberId === me.id)
  const others = book.readings.filter((r) => r.memberId !== me.id)
  const allNotes = book.readings.flatMap((r) => r.notes.map((n) => ({ ...n, member: r.member, mine: r.memberId === me.id })))
  allNotes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return (
    <div className="space-y-5">
      {added && <p className="rounded-lg bg-brand-soft p-3 text-sm text-brand">등록했습니다.</p>}

      <section className="flex flex-col gap-4 sm:flex-row">
        <div className="flex justify-center">
          <BookCover title={book.title} coverUrl={book.coverUrl} size="lg" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-bold">
            {book.title}
            {book.volumeNo != null && <span className="ml-2 text-lg text-muted">{book.volumeNo}권</span>}
          </h1>
          <p className="text-muted">{[book.authors, book.publisher, book.pubYear].filter(Boolean).join(' · ')}</p>
          <div className="flex flex-wrap gap-1 text-xs">
            <Link href={`/?category=${encodeURIComponent(book.category)}`} className="chip bg-brand-soft text-brand">
              {book.category}
            </Link>
            <span className="chip bg-paper ring-1 ring-line">{book.ageGroup === 'CHILD' ? '어린이 책' : '어른 책'}</span>
            {book.series && (
              <Link href={`/?q=${encodeURIComponent(book.series.name)}`} className="chip bg-paper ring-1 ring-line">
                시리즈 · {book.series.name}
              </Link>
            )}
            {book.isbn13 && <span className="chip bg-paper text-muted ring-1 ring-line">ISBN {book.isbn13}</span>}
            {book.kdc && <span className="chip bg-paper text-muted ring-1 ring-line">KDC {book.kdc}</span>}
            {book.tags.map((t) => (
              <Link key={t} href={`/?q=${encodeURIComponent(t)}`} className="chip bg-paper ring-1 ring-line">
                #{t}
              </Link>
            ))}
          </div>
          {book.needsReview && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              사진 판독으로 들어온 책입니다. 제목·저자를 확인하고 수정 화면에서 &lsquo;확인 필요&rsquo;를 해제하세요.
            </p>
          )}
          {book.description && <p className="text-sm leading-relaxed whitespace-pre-line text-ink/80">{book.description}</p>}
          {me.isAdmin && (
            <div className="flex gap-2 pt-1">
              <Link href={`/books/${book.id}/edit`} className="btn-ghost">
                서지 수정
              </Link>
              <ConfirmButton action={deleteBook.bind(null, book.id)} confirm="이 책과 모든 소장본·읽기 기록을 지울까요?">
                삭제
              </ConfirmButton>
            </div>
          )}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">소장본 {book.copies.length}권</h2>
        {book.copies.length === 0 && <p className="text-sm text-muted">소장본이 없습니다.</p>}
        <ul className="space-y-3">
          {book.copies.map((c) => {
            const place = loc.describe(c.locationId)
            return (
              <li key={c.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted">{formatCopyCode(c.seq)}</span>
                  {place ? (
                    <Link href={`/shelves?loc=${c.locationId}`} className="font-semibold">
                      {place.zone && <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: place.zone.color }} />}
                      {place.code} <span className="font-normal text-muted">· {place.name}{place.zone && ` · ${place.zone.name}`}</span>
                    </Link>
                  ) : (
                    <span className="text-amber-800">위치 미지정</span>
                  )}
                  <span className="chip bg-paper ring-1 ring-line">{COPY_STATUS_LABEL[c.status]}</span>
                  {c.owner && <span className="chip bg-paper ring-1 ring-line">소유 · {c.owner.name}</span>}
                  {!c.lendable && <span className="chip bg-red-50 text-red-700">대여 안 함</span>}
                </div>
                {c.note && <p className="mt-1 text-sm text-muted">{c.note}</p>}
                {me.isAdmin && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-muted">위치·상태 바꾸기</summary>
                    <form action={updateCopy.bind(null, c.id)} className="mt-2 grid gap-2 sm:grid-cols-4">
                      <select name="locationId" defaultValue={c.locationId ?? ''} className="input sm:col-span-2">
                        <option value="">위치 미지정</option>
                        {shelves.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <select name="status" defaultValue={c.status} className="input">
                        {Object.entries(COPY_STATUS_LABEL).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <select name="ownerId" defaultValue={c.ownerId ?? ''} className="input">
                        <option value="">가족 공용</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <input name="note" defaultValue={c.note ?? ''} placeholder="메모(예: 사인본)" className="input sm:col-span-2" />
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="lendable" defaultChecked={c.lendable} /> 대여 가능
                      </label>
                      <div className="flex gap-2">
                        <button className="btn-primary">저장</button>
                        <ConfirmButton action={deleteCopy.bind(null, c.id)} confirm="이 소장본 한 권을 지울까요?">
                          지우기
                        </ConfirmButton>
                      </div>
                    </form>
                    {c.moves.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted">
                        {c.moves.map((m) => (
                          <li key={m.id}>
                            {formatDate(m.movedAt)} · {loc.describe(m.fromLocationId)?.code ?? '미지정'} → {loc.describe(m.toLocationId)?.code ?? '미지정'}
                            {m.movedBy && ` · ${m.movedBy.name}`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                )}
              </li>
            )
          })}
        </ul>
        {me.isAdmin && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">같은 책 한 권 더 추가</summary>
            <form action={addCopy.bind(null, book.id)} className="mt-2 flex flex-wrap gap-2">
              <select name="locationId" className="input max-w-xs" defaultValue="">
                <option value="">위치 미지정</option>
                {shelves.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select name="ownerId" className="input max-w-[10rem]" defaultValue={me.id}>
                <option value="">가족 공용</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button className="btn-ghost">추가</button>
            </form>
          </details>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">내 읽기 기록</h2>
          {book.ageGroup === 'CHILD' && (
            <form action={incrementReadCount.bind(null, book.id)}>
              <button className="btn-ghost">한 번 더 읽어 줬어요 ({mine?.readCount ?? 0}회)</button>
            </form>
          )}
        </div>
        <ActionForm action={saveReading.bind(null, book.id)} className="grid gap-2 sm:grid-cols-6">
          {/* 저장 후 서버가 다시 그린 값으로 기본값을 갱신하려고 필드만 다시 마운트한다(결과 메시지는 유지) */}
          <Fragment key={mine ? mine.updatedAt.toISOString() : 'none'}>
          <div className="sm:col-span-2">
            <label className="label">상태</label>
            <select name="status" defaultValue={mine?.status ?? ''} className="input">
              <option value="">기록 없음</option>
              {Object.entries(READING_STATUS_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">별점</label>
            <select name="rating" defaultValue={mine?.rating ?? ''} className="input">
              <option value="">-</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {'★'.repeat(r)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">시작일</label>
            <input type="date" name="startedAt" defaultValue={formatDate(mine?.startedAt)} className="input" />
          </div>
          <div>
            <label className="label">완독일</label>
            <input type="date" name="finishedAt" defaultValue={formatDate(mine?.finishedAt)} className="input" />
          </div>
          <div>
            <label className="label">읽은 횟수</label>
            <input type="number" min={0} name="readCount" defaultValue={mine?.readCount ?? 0} className="input" />
          </div>
          {book.ageGroup === 'CHILD' && (
            <div className="sm:col-span-2">
              <label className="label">아이 반응</label>
              <select name="reaction" defaultValue={mine?.reaction ?? ''} className="input">
                <option value="">-</option>
                <option value="1">좋아함</option>
                <option value="0">보통</option>
                <option value="-1">싫어함</option>
              </select>
            </div>
          )}
          </Fragment>
          <div className="flex items-end sm:col-span-6">
            <button className="btn-primary">기록 저장</button>
          </div>
        </ActionForm>
        {others.length > 0 && (
          <p className="text-sm text-muted">
            가족 기록:{' '}
            {others.map((r) => `${r.member.name} ${READING_STATUS_LABEL[r.status]}${r.rating ? ` ${'★'.repeat(r.rating)}` : ''}`).join(' · ')}
          </p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">독후감 · 인용구 · 메모</h2>
        <ActionForm action={addNote.bind(null, book.id)} className="space-y-2" resetOnSuccess>
          <div className="flex gap-2">
            <select name="kind" defaultValue="REVIEW" className="input max-w-[8rem]">
              {Object.entries(NOTE_KIND_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <input name="page" type="number" min={1} placeholder="쪽" className="input max-w-[6rem]" />
          </div>
          <textarea name="body" required className="input min-h-28" placeholder="밑줄 친 문장, 한 줄 평, 독후감…" />
          <button className="btn-primary">남기기</button>
        </ActionForm>
        <ul className="space-y-3">
          {allNotes.map((n) => (
            <li key={n.id} className="border-t border-line pt-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                <span className="chip bg-brand-soft text-brand">{NOTE_KIND_LABEL[n.kind]}</span>
                <span>{n.member.name}</span>
                <span>{formatDate(n.createdAt)}</span>
                {n.page && <span>p.{n.page}</span>}
                {n.mine && (
                  <span className="ml-auto">
                    <ConfirmButton action={deleteNote.bind(null, n.id)} confirm="이 기록을 지울까요?" className="text-xs text-red-700 underline">
                      지우기
                    </ConfirmButton>
                  </span>
                )}
              </div>
              <p className={`text-sm leading-relaxed whitespace-pre-line ${n.kind === 'QUOTE' ? 'border-l-2 border-accent pl-3 italic' : ''}`}>{n.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
