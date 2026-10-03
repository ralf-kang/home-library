import Link from 'next/link'
import { notFound } from 'next/navigation'
import BookForm from '@/components/BookForm'
import { prisma } from '@/lib/db'
import { DEFAULT_CATEGORIES } from '@/lib/format'
import { updateBook } from '@/server/actions/books'
import { requireCan } from '@/server/auth'
import { listCategories } from '@/server/queries'

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { household } = await requireCan('book.write')
  const hid = household.id
  const { id } = await params
  const [book, cats, series] = await Promise.all([
    prisma.book.findFirst({ where: { id, householdId: hid }, include: { series: true } }),
    listCategories(hid),
    prisma.series.findMany({ where: { householdId: hid }, select: { name: true }, orderBy: { name: 'asc' } }),
  ])
  if (!book) notFound()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">서지 수정</h1>
        <Link href={`/books/${id}`} className="text-sm text-muted underline">
          돌아가기
        </Link>
      </div>
      <BookForm
        mode="edit"
        action={updateBook.bind(null, id)}
        initial={{
          isbn13: book.isbn13 ?? '',
          title: book.title,
          authors: book.authors,
          publisher: book.publisher,
          pubYear: book.pubYear ? String(book.pubYear) : '',
          kdc: book.kdc ?? '',
          category: book.category,
          coverUrl: book.coverUrl ?? '',
          description: book.description ?? '',
          ageGroup: book.ageGroup,
          seriesName: book.series?.name ?? '',
          volumeNo: book.volumeNo != null ? String(book.volumeNo) : '',
          tags: book.tags.join(', '),
          needsReview: book.needsReview,
        }}
        categories={[...new Set([...DEFAULT_CATEGORIES, ...cats.map((c) => c.category)])]}
        seriesNames={series.map((s) => s.name)}
      />
    </div>
  )
}
