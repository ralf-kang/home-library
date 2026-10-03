'use server'

import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import type { AgeGroup, CopyStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { toChosung } from '@/lib/chosung'
import { normalizeIsbn } from '@/lib/isbn'
import { requireCan } from '@/server/auth'
import { b, n, s, type ActionResult } from '@/server/form'
import { ownedBook, ownedCopy, ownedLocation, ownedMember } from '@/server/queries'

const COPY_STATUSES: CopyStatus[] = ['ON_SHELF', 'OUT_READING', 'LOANED', 'LOST', 'DISPOSED']

async function upsertSeries(tx: Prisma.TransactionClient, hid: string, name: string | null) {
  if (!name) return null
  const series = await tx.series.upsert({
    where: { householdId_name: { householdId: hid, name } },
    create: { householdId: hid, name },
    update: {},
  })
  return series.id
}

/** 폼의 위치·소유자 id 가 이 가구 소속인지 확인(다른 가구 id 를 넣어 보는 요청 차단). 비어 있으면 null. */
async function checkedRefs(hid: string, form: FormData) {
  const locationId = s(form, 'locationId')
  const ownerId = s(form, 'ownerId')
  if (locationId && !(await ownedLocation(hid, locationId))) throw new Error('없는 위치입니다.')
  if (ownerId && !(await ownedMember(hid, ownerId))) throw new Error('없는 구성원입니다.')
  return { locationId, ownerId }
}

function bookFields(form: FormData) {
  const title = s(form, 'title')
  if (!title) throw new Error('제목은 꼭 입력해야 합니다.')
  const rawIsbn = s(form, 'isbn13')
  const isbn13 = rawIsbn ? normalizeIsbn(rawIsbn) : null
  if (rawIsbn && !isbn13) throw new Error('ISBN 형식이 올바르지 않습니다.')
  const ageGroup: AgeGroup = s(form, 'ageGroup') === 'CHILD' ? 'CHILD' : 'ADULT'
  const tags = (s(form, 'tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return {
    isbn13,
    title,
    titleChosung: toChosung(title),
    authors: s(form, 'authors') ?? '',
    publisher: s(form, 'publisher') ?? '',
    pubYear: n(form, 'pubYear'),
    kdc: s(form, 'kdc'),
    category: s(form, 'category') ?? '미분류',
    coverUrl: s(form, 'coverUrl'),
    description: s(form, 'description'),
    ageGroup,
    tags,
    volumeNo: n(form, 'volumeNo'),
  }
}

/**
 * 책 등록. 같은 가구에 같은 ISBN의 서지가 이미 있으면 서지는 그대로 두고 소장본만 추가한다
 * (같은 책을 두 권 가진 경우 — 서지/소장본 분리 원칙).
 */
export async function createBook(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { member, household } = await requireCan('book.write')
  const hid = household.id
  let bookId: string
  try {
    const fields = bookFields(form)
    const copies = Math.min(10, Math.max(1, n(form, 'copies') ?? 1))
    const { locationId, ownerId } = await checkedRefs(hid, form)
    const lendable = b(form, 'lendable')
    bookId = await prisma.$transaction(async (tx) => {
      const seriesId = await upsertSeries(tx, hid, s(form, 'seriesName'))
      const existing = fields.isbn13
        ? await tx.book.findUnique({ where: { householdId_isbn13: { householdId: hid, isbn13: fields.isbn13 } } })
        : null
      const book = existing ?? (await tx.book.create({ data: { ...fields, householdId: hid, seriesId } }))
      for (let i = 0; i < copies; i++) {
        const copy = await tx.copy.create({ data: { bookId: book.id, locationId, ownerId, lendable } })
        if (locationId) {
          await tx.copyMove.create({ data: { copyId: copy.id, toLocationId: locationId, movedById: member.id } })
        }
      }
      return book.id
    })
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  revalidatePath('/search')
  revalidatePath('/shelves')
  redirect(`/books/${bookId}?added=1`)
}

export async function updateBook(bookId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { household } = await requireCan('book.write')
  const hid = household.id
  if (!(await ownedBook(hid, bookId))) return { ok: false, error: '없는 책입니다.' }
  try {
    const fields = bookFields(form)
    await prisma.$transaction(async (tx) => {
      const seriesId = await upsertSeries(tx, hid, s(form, 'seriesName'))
      await tx.book.update({
        where: { id: bookId },
        data: { ...fields, seriesId, needsReview: b(form, 'needsReview') },
      })
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('Unique constraint')) return { ok: false, error: '같은 ISBN의 책이 이미 있습니다.' }
    return { ok: false, error: msg }
  }
  revalidatePath(`/books/${bookId}`)
  return { ok: true, message: '저장했습니다.' }
}

export async function deleteBook(bookId: string) {
  const { household } = await requireCan('book.delete')
  if (!(await ownedBook(household.id, bookId))) notFound()
  await prisma.book.delete({ where: { id: bookId } })
  revalidatePath('/search')
  redirect('/search?deleted=1')
}

export async function addCopy(bookId: string, form: FormData) {
  const { member, household } = await requireCan('book.write')
  if (!(await ownedBook(household.id, bookId))) notFound()
  const { locationId, ownerId } = await checkedRefs(household.id, form)
  await prisma.$transaction(async (tx) => {
    const copy = await tx.copy.create({ data: { bookId, locationId, ownerId, lendable: true } })
    if (locationId) await tx.copyMove.create({ data: { copyId: copy.id, toLocationId: locationId, movedById: member.id } })
  })
  revalidatePath(`/books/${bookId}`)
}

export async function updateCopy(copyId: string, form: FormData) {
  const { member, household } = await requireCan('book.write')
  const copy = await ownedCopy(household.id, copyId)
  if (!copy) notFound()
  const statusRaw = s(form, 'status') as CopyStatus | null
  const status = statusRaw && COPY_STATUSES.includes(statusRaw) ? statusRaw : undefined
  const { locationId, ownerId } = await checkedRefs(household.id, form)
  await prisma.$transaction(async (tx) => {
    await tx.copy.update({
      where: { id: copyId },
      data: { status, ownerId, lendable: b(form, 'lendable'), note: s(form, 'note'), locationId },
    })
    if ((copy.locationId ?? null) !== locationId) {
      await tx.copyMove.create({
        data: { copyId, fromLocationId: copy.locationId, toLocationId: locationId, movedById: member.id },
      })
    }
  })
  revalidatePath(`/books/${copy.bookId}`)
}

export async function deleteCopy(copyId: string) {
  const { household } = await requireCan('book.delete')
  const copy = await ownedCopy(household.id, copyId)
  if (!copy) notFound()
  await prisma.copy.delete({ where: { id: copyId } })
  revalidatePath(`/books/${copy.bookId}`)
}

/** 서가 화면의 일괄 이동. 이동마다 이력을 남긴다. 다른 가구의 소장본 id 는 조용히 제외된다. */
export async function moveCopies(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { member, household } = await requireCan('book.write')
  const hid = household.id
  const copyIds = form.getAll('copyId').map(String).filter(Boolean)
  const to = s(form, 'toLocationId')
  if (copyIds.length === 0) return { ok: false, error: '옮길 책을 골라 주세요.' }
  if (!to) return { ok: false, error: '옮길 칸을 골라 주세요.' }
  if (!(await ownedLocation(hid, to))) return { ok: false, error: '없는 위치입니다.' }
  const copies = await prisma.copy.findMany({ where: { id: { in: copyIds }, book: { householdId: hid } } })
  const ids = copies.map((c) => c.id)
  await prisma.$transaction([
    ...copies
      .filter((c) => c.locationId !== to)
      .map((c) =>
        prisma.copyMove.create({
          data: { copyId: c.id, fromLocationId: c.locationId, toLocationId: to, movedById: member.id },
        }),
      ),
    prisma.copy.updateMany({ where: { id: { in: ids } }, data: { locationId: to } }),
  ])
  revalidatePath('/shelves')
  return { ok: true, message: `${copies.length}권을 옮겼습니다.` }
}
