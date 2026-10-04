import Link from 'next/link'
import { Photo } from '@/components/Art'
import BookCover from '@/components/BookCover'
import { prisma } from '@/lib/db'
import { NOTE_KIND_LABEL, formatDate } from '@/lib/format'
import { requireMember } from '@/server/auth'

type ShelfItem = { id: string; bookId: string; rating: number | null; book: { title: string; coverUrl: string | null } }

export default async function MePage() {
  const { member: me } = await requireMember()
  const yearStart = new Date(`${new Date().getFullYear()}-01-01T00:00:00.000Z`)
  const [reading, doneThisYear, want, notes] = await Promise.all([
    prisma.reading.findMany({ where: { memberId: me.id, status: 'READING' }, include: { book: true }, orderBy: { updatedAt: 'desc' } }),
    prisma.reading.findMany({
      where: { memberId: me.id, status: 'DONE', finishedAt: { gte: yearStart } },
      include: { book: true },
      orderBy: { finishedAt: 'desc' },
    }),
    prisma.reading.findMany({ where: { memberId: me.id, status: 'WANT' }, include: { book: true }, orderBy: { updatedAt: 'desc' }, take: 20 }),
    prisma.note.findMany({
      where: { reading: { memberId: me.id } },
      include: { reading: { include: { book: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{me.name}님의 독서</h1>
      {reading.length + doneThisYear.length + want.length + notes.length === 0 && (
        <section className="card grid items-center gap-5 md:grid-cols-[minmax(0,480px)_1fr]">
          <Photo name="journal" sizes="(max-width: 767px) calc(100vw - 64px), 480px" className="aspect-video rounded-2xl object-cover" />
          <div className="space-y-2">
            <p className="text-lg font-semibold">아직 독서 기록이 없어요</p>
            <p className="text-sm text-muted">책 상세 화면에서 읽는 중·완독·별점·독후감을 남기면 여기에 모이고 취향 대시보드에도 반영됩니다.</p>
            <Link href="/shelves" className="btn-primary">서가에서 책 고르기</Link>
          </div>
        </section>
      )}
      <Shelf title="읽는 중" items={reading} empty="책 상세 화면에서 ‘읽는 중’으로 표시해 보세요." />
      <Shelf title={`${new Date().getFullYear()}년 완독`} items={doneThisYear} empty="올해 완독한 책이 아직 없습니다." />
      <Shelf title="읽고 싶음" items={want} empty="읽고 싶은 책을 표시해 두면 여기에 모입니다." />
      <section className="card space-y-3">
        <h2 className="font-semibold">최근 기록</h2>
        {notes.length === 0 && <p className="text-sm text-muted">아직 남긴 독후감·인용구가 없습니다.</p>}
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="chip bg-brand-soft text-brand">{NOTE_KIND_LABEL[n.kind]}</span>
                <Link href={`/books/${n.reading.bookId}`} className="font-medium text-ink hover:underline">
                  {n.reading.book.title}
                </Link>
                <span>{formatDate(n.createdAt)}</span>
              </div>
              <p className="line-clamp-4 text-sm whitespace-pre-line">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Shelf({ title, items, empty }: { title: string; items: ShelfItem[]; empty: string }) {
  return (
    <section className="card space-y-2">
      <h2 className="font-semibold">
        {title} <span className="text-muted">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {items.map((r) => (
            <li key={r.id} className="w-20 shrink-0">
              <Link href={`/books/${r.bookId}`} className="block space-y-1">
                <BookCover title={r.book.title} coverUrl={r.book.coverUrl} />
                <p className="line-clamp-2 text-xs">{r.book.title}</p>
                {r.rating && <p className="text-xs text-accent">{'★'.repeat(r.rating)}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
