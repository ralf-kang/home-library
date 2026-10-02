import Link from 'next/link'
import type { WishStatus } from '@prisma/client'
import ActionForm from '@/components/ActionForm'
import BookCover from '@/components/BookCover'
import ConfirmButton from '@/components/ConfirmButton'
import { prisma } from '@/lib/db'
import { WISH_STATUS_LABEL, formatDate } from '@/lib/format'
import { isClaudeConfigured } from '@/lib/claude'
import { isKakaoConfigured } from '@/lib/book-lookup'
import { refreshMyRecommendations } from '@/server/actions/recommend'
import { addWish, deleteWish, setWishStatus } from '@/server/actions/wishes'
import { requireMember } from '@/server/auth'
import { buildProfile } from '@/server/profile'
import type { RecItem } from '@/server/recommend'

const SOURCE_LABEL: Record<RecItem['source'], string> = { author: '좋아한 저자', library: '도서관 대출 데이터', series: '시리즈 빈 권' }

export default async function RecommendPage() {
  const me = await requireMember()
  const profile = await buildProfile(me.id)
  const topCats = profile.topCategories.slice(0, 3).map(([c]) => c)

  // "사기 전에, 이 책부터": 취향 상위 분야(기록이 없으면 전체)에서 집에 있는데 아직 안 읽은 책
  const ownedUnread = await prisma.book.findMany({
    where: {
      copies: { some: { status: { in: ['ON_SHELF', 'OUT_READING'] } } },
      ageGroup: me.role === 'CHILD' ? 'CHILD' : 'ADULT',
      readings: { none: { memberId: me.id } },
      ...(topCats.length ? { category: { in: topCats } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  })

  const [run, wishes] = await Promise.all([
    prisma.recommendationRun.findFirst({ where: { memberId: me.id }, orderBy: { createdAt: 'desc' } }),
    prisma.wishItem.findMany({ where: { memberId: me.id, status: { not: 'DISMISSED' } }, orderBy: { updatedAt: 'desc' } }),
  ])
  const items = (run?.items ?? []) as unknown as RecItem[]
  const wished = new Set(wishes.map((w) => w.isbn13 ?? w.title))

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">{me.name}님을 위한 추천</h1>

      <section className="card space-y-2">
        <h2 className="font-semibold">사기 전에, 이 책부터</h2>
        <p className="text-sm text-muted">
          {topCats.length ? `자주 읽는 분야(${topCats.join(', ')}) 중` : '집에 있는 책 중'} 아직 안 읽은 책입니다.
        </p>
        {ownedUnread.length === 0 ? (
          <p className="text-sm text-muted">해당하는 책이 없습니다.</p>
        ) : (
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {ownedUnread.map((b) => (
              <li key={b.id} className="w-20 shrink-0">
                <Link href={`/books/${b.id}`} className="block space-y-1">
                  <BookCover title={b.title} coverUrl={b.coverUrl} />
                  <p className="line-clamp-2 text-xs">{b.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">살 만한 책</h2>
            <p className="text-xs text-muted">
              {run ? `${formatDate(run.createdAt)} 갱신 · ${run.usedAi ? 'AI가 고르고 이유를 붙임' : '규칙 순서'}` : '아직 추천을 만든 적이 없습니다.'}
              {' · '}이미 가진 책과 위시리스트·관심 없음 책은 빠집니다.
            </p>
          </div>
          <ActionForm action={refreshMyRecommendations}>
            <button className="btn-primary">추천 갱신</button>
          </ActionForm>
        </div>
        {(!isKakaoConfigured() || !isClaudeConfigured()) && (
          <p className="rounded-lg bg-paper p-2 text-xs text-muted">
            {!isKakaoConfigured() && '카카오 API 키가 없어 ‘좋아한 저자의 다른 책’ 후보를 찾지 못합니다. '}
            {!isClaudeConfigured() && 'Claude API 키가 없어 AI 선정 없이 규칙 순서로 보여 줍니다.'}
          </p>
        )}
        <ul className="space-y-2">
          {items.map((it, i) => {
            const key = it.isbn13 ?? it.title
            return (
              <li key={`${key}-${i}`} className="flex gap-3 rounded-lg border border-line p-2">
                <BookCover title={it.title} coverUrl={it.coverUrl} size="sm" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{it.title}</p>
                  <p className="text-xs text-muted">{[it.authors, it.publisher].filter(Boolean).join(' · ')}</p>
                  <p className="mt-1">{it.reason}</p>
                  <span className="chip mt-1 bg-paper text-muted ring-1 ring-line">{SOURCE_LABEL[it.source]}</span>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {wished.has(key) ? (
                    <span className="text-xs text-brand">담김</span>
                  ) : (
                    <>
                      <WishButton item={it} status="INTERESTED" label="담기" />
                      <WishButton item={it} status="DISMISSED" label="관심 없음" />
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">위시리스트 {wishes.length}</h2>
        <ActionForm action={addWish} className="flex flex-wrap gap-2" resetOnSuccess>
          <input name="title" placeholder="제목" className="input max-w-xs" required />
          <input name="authors" placeholder="저자" className="input max-w-[10rem]" />
          <input name="isbn13" placeholder="ISBN(선택)" className="input max-w-[10rem]" inputMode="numeric" />
          <button className="btn-ghost">직접 추가</button>
        </ActionForm>
        <ul className="space-y-2">
          {wishes.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
              <BookCover title={w.title} coverUrl={w.coverUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{w.title}</p>
                <p className="text-xs text-muted">
                  {[w.authors, w.source === 'RECOMMEND' ? '추천에서 담음' : null].filter(Boolean).join(' · ')}
                </p>
                {w.reason && <p className="text-xs">{w.reason}</p>}
              </div>
              <span className="chip bg-brand-soft text-brand">{WISH_STATUS_LABEL[w.status]}</span>
              {w.status !== 'PURCHASED' && (
                <div className="flex gap-1">
                  {w.status !== 'PLANNED' && (
                    <form action={setWishStatus.bind(null, w.id, 'PLANNED' as WishStatus)}>
                      <button className="btn-ghost px-2 py-1 text-xs">구매 예정</button>
                    </form>
                  )}
                  <ConfirmButton
                    action={setWishStatus.bind(null, w.id, 'PURCHASED' as WishStatus)}
                    confirm="구매 완료로 바꾸면 장서에 추가됩니다(위치는 나중에 지정). 진행할까요?"
                    className="btn-primary px-2 py-1 text-xs"
                  >
                    구매 완료
                  </ConfirmButton>
                </div>
              )}
              <ConfirmButton action={deleteWish.bind(null, w.id)} confirm="위시리스트에서 뺄까요?" className="text-xs text-muted underline">
                빼기
              </ConfirmButton>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function WishButton({ item, status, label }: { item: RecItem; status: 'INTERESTED' | 'DISMISSED'; label: string }) {
  return (
    <ActionForm action={addWish}>
      <input type="hidden" name="title" value={item.title} />
      <input type="hidden" name="authors" value={item.authors} />
      <input type="hidden" name="publisher" value={item.publisher} />
      <input type="hidden" name="isbn13" value={item.isbn13 ?? ''} />
      <input type="hidden" name="coverUrl" value={item.coverUrl ?? ''} />
      <input type="hidden" name="reason" value={item.reason} />
      <input type="hidden" name="source" value="RECOMMEND" />
      <input type="hidden" name="status" value={status} />
      <button className={status === 'INTERESTED' ? 'btn-primary px-2 py-1 text-xs' : 'btn-ghost px-2 py-1 text-xs'}>{label}</button>
    </ActionForm>
  )
}
