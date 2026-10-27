'use server'

import { revalidatePath } from 'next/cache'
import type { WishSource, WishStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { normalizeIsbn } from '@/lib/isbn'
import { toChosung } from '@/lib/chosung'
import { lookupIsbn, guessCategory } from '@/lib/book-lookup'
import { requireMember } from '@/server/auth'
import { s, type ActionResult } from '@/server/form'

const STATUSES: WishStatus[] = ['INTERESTED', 'PLANNED', 'PURCHASED', 'DISMISSED']

export async function addWish(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { member: me } = await requireMember()
  const title = s(form, 'title')
  if (!title) return { ok: false, error: '제목을 입력해 주세요.' }
  const isbn13 = s(form, 'isbn13') ? normalizeIsbn(s(form, 'isbn13')!) : null
  const source: WishSource = s(form, 'source') === 'RECOMMEND' ? 'RECOMMEND' : 'MANUAL'
  const status: WishStatus = s(form, 'status') === 'DISMISSED' ? 'DISMISSED' : 'INTERESTED'
  const data = {
    title,
    authors: s(form, 'authors') ?? '',
    publisher: s(form, 'publisher') ?? '',
    coverUrl: s(form, 'coverUrl'),
    reason: s(form, 'reason'),
    source,
    status,
  }
  if (isbn13) {
    await prisma.wishItem.upsert({
      where: { memberId_isbn13: { memberId: me.id, isbn13 } },
      create: { memberId: me.id, isbn13, ...data },
      update: { status },
    })
  } else {
    await prisma.wishItem.create({ data: { memberId: me.id, ...data } })
  }
  revalidatePath('/recommend')
  return { ok: true, message: status === 'DISMISSED' ? '다시 추천하지 않을게요.' : '위시리스트에 담았습니다.' }
}

/**
 * 상태 변경. '구매 완료'가 되면 장서로 전환한다 — 서지를 만들고(이미 있으면 재사용)
 * 위치 미지정 소장본 1권을 추가한다. 위치는 나중에 서가 화면에서 지정한다.
 */
export async function setWishStatus(id: string, status: WishStatus) {
  const { member: me, household } = await requireMember()
  if (!STATUSES.includes(status)) throw new Error('잘못된 상태입니다.')
  const wish = await prisma.wishItem.findUnique({ where: { id } })
  if (!wish || wish.memberId !== me.id) throw new Error('본인 위시리스트만 바꿀 수 있습니다.')
  if (status === 'PURCHASED' && wish.status !== 'PURCHASED') {
    const looked = wish.isbn13 ? await lookupIsbn(wish.isbn13) : null
    await prisma.$transaction(async (tx) => {
      const existing = wish.isbn13
        ? await tx.book.findUnique({ where: { householdId_isbn13: { householdId: household.id, isbn13: wish.isbn13 } } })
        : null
      const book =
        existing ??
        (await tx.book.create({
          data: {
            householdId: household.id,
            isbn13: wish.isbn13,
            title: wish.title,
            titleChosung: toChosung(wish.title),
            authors: wish.authors,
            publisher: wish.publisher,
            coverUrl: wish.coverUrl ?? looked?.coverUrl ?? null,
            description: looked?.description ?? null,
            pubYear: looked?.pubYear ?? null,
            kdc: looked?.kdc ?? null,
            category: guessCategory(looked?.kdc),
          },
        }))
      await tx.copy.create({ data: { bookId: book.id, ownerId: me.id } })
      await tx.wishItem.update({ where: { id }, data: { status } })
    })
  } else {
    await prisma.wishItem.update({ where: { id }, data: { status } })
  }
  revalidatePath('/recommend')
}

export async function deleteWish(id: string) {
  const { member: me } = await requireMember()
  await prisma.wishItem.deleteMany({ where: { id, memberId: me.id } })
  revalidatePath('/recommend')
}
