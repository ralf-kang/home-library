import Link from 'next/link'
import BookForm, { EMPTY_BOOK } from '@/components/BookForm'
import { prisma } from '@/lib/db'
import { DEFAULT_CATEGORIES } from '@/lib/format'
import { isClaudeConfigured } from '@/lib/claude'
import { createBook } from '@/server/actions/books'
import { requireAdmin } from '@/server/auth'
import { listCategories, listMembers, loadLocations, shelfOptions } from '@/server/queries'

export default async function AddPage() {
  const me = await requireAdmin()
  const [loc, members, cats, series] = await Promise.all([
    loadLocations(),
    listMembers(),
    listCategories(),
    prisma.series.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
  ])
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...cats.map((c) => c.category)])]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">책 등록</h1>
        <Link href="/add/photo" className="btn-ghost">
          서가 사진으로 일괄 등록{!isClaudeConfigured() && ' (AI 키 필요)'}
        </Link>
      </div>
      <p className="text-sm text-muted">바코드를 찍거나 ISBN을 입력해 조회하면 제목·저자·표지가 채워집니다. ISBN이 없는 책은 직접 입력하세요.</p>
      <BookForm
        mode="create"
        action={createBook}
        initial={EMPTY_BOOK}
        categories={categories}
        seriesNames={series.map((s) => s.name)}
        shelves={shelfOptions(loc)}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        defaultOwnerId={me.id}
      />
    </div>
  )
}
