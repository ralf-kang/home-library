'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import type { NoteKind, ReadingStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { requireMember, type MemberContext } from '@/server/auth'
import { d, n, s, type ActionResult } from '@/server/form'
import { ownedBook } from '@/server/queries'

const STATUSES: ReadingStatus[] = ['WANT', 'READING', 'DONE', 'DROPPED', 'REFERENCE']
const NOTE_KINDS: NoteKind[] = ['REVIEW', 'QUOTE', 'MEMO']

/**
 * 기록 대상 구성원. 기본은 나. asMemberId 가 오면 '계정 없는 구성원(아이)' 대리 입력으로 보고
 * 권한(reading.proxy)과 같은 가구·계정 없음 여부를 확인한다. 계정 있는 가족의 기록은 대신 쓸 수 없다.
 */
async function targetMemberId(ctx: MemberContext, asMemberId: string | null | undefined): Promise<string> {
  if (!asMemberId || asMemberId === ctx.member.id) return ctx.member.id
  if (!can(ctx.member.role, 'reading.proxy')) throw new Error('다른 구성원의 기록은 쓸 수 없습니다.')
  const target = await prisma.member.findFirst({ where: { id: asMemberId, householdId: ctx.household.id } })
  if (!target) throw new Error('없는 구성원입니다.')
  if (target.userId) throw new Error('계정이 있는 가족의 기록은 본인만 쓸 수 있습니다.')
  return target.id
}

async function bookOr404(ctx: MemberContext, bookId: string) {
  if (!(await ownedBook(ctx.household.id, bookId))) notFound()
}

/** 읽기 기록 저장. 상태를 '완독'으로 바꾸면 완독일·읽은 횟수를 채운다. */
export async function saveReading(bookId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ctx = await requireMember()
  await bookOr404(ctx, bookId)
  let memberId: string
  try {
    memberId = await targetMemberId(ctx, s(form, 'asMemberId'))
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  const status = s(form, 'status') as ReadingStatus | null
  if (!status || !STATUSES.includes(status)) {
    // 상태를 비우면 기록 삭제(독후감이 있으면 지우지 않는다)
    const existing = await prisma.reading.findUnique({
      where: { memberId_bookId: { memberId, bookId } },
      include: { _count: { select: { notes: true } } },
    })
    if (existing && existing._count.notes > 0) return { ok: false, error: '독후감·메모가 있어 기록을 지울 수 없습니다.' }
    if (existing) await prisma.reading.delete({ where: { id: existing.id } })
    revalidatePath(`/books/${bookId}`)
    return { ok: true, message: '읽기 기록을 지웠습니다.' }
  }
  const rating = n(form, 'rating')
  const reaction = n(form, 'reaction')
  let finishedAt = d(form, 'finishedAt')
  let readCount = n(form, 'readCount') ?? 0
  if (status === 'DONE') {
    finishedAt ??= new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
    readCount = Math.max(1, readCount)
  }
  const data = {
    status,
    rating: rating && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    reaction: reaction != null && [-1, 0, 1].includes(reaction) ? reaction : null,
    startedAt: d(form, 'startedAt'),
    finishedAt,
    readCount: Math.max(0, Math.round(readCount)),
  }
  await prisma.reading.upsert({
    where: { memberId_bookId: { memberId, bookId } },
    create: { memberId, bookId, ...data },
    update: data,
  })
  revalidatePath(`/books/${bookId}`)
  revalidatePath('/me')
  revalidatePath('/dashboard')
  return { ok: true, message: '저장했습니다.' }
}

/** 아이 책: "한 번 더 읽어 줬어요" 탭 한 번으로 횟수 +1 (기획서 F-11). asMemberId 로 아이 프로필에 기록. */
export async function incrementReadCount(bookId: string, asMemberId?: string) {
  const ctx = await requireMember()
  await bookOr404(ctx, bookId)
  const memberId = await targetMemberId(ctx, asMemberId)
  await prisma.reading.upsert({
    where: { memberId_bookId: { memberId, bookId } },
    create: { memberId, bookId, status: 'DONE', readCount: 1, finishedAt: new Date() },
    update: { readCount: { increment: 1 }, status: 'DONE', finishedAt: new Date() },
  })
  revalidatePath(`/books/${bookId}`)
}

export async function addNote(bookId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ctx = await requireMember()
  await bookOr404(ctx, bookId)
  let memberId: string
  try {
    memberId = await targetMemberId(ctx, s(form, 'asMemberId'))
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  const kind = s(form, 'kind') as NoteKind | null
  const body = s(form, 'body')
  if (!kind || !NOTE_KINDS.includes(kind)) return { ok: false, error: '종류를 골라 주세요.' }
  if (!body) return { ok: false, error: '내용을 입력해 주세요.' }
  if (body.length > 20000) return { ok: false, error: '내용이 너무 깁니다(2만 자 이하).' }
  // 읽기 기록이 없으면 '읽는 중'으로 만들고 거기에 붙인다.
  const reading = await prisma.reading.upsert({
    where: { memberId_bookId: { memberId, bookId } },
    create: { memberId, bookId, status: 'READING' },
    update: {},
  })
  await prisma.note.create({ data: { readingId: reading.id, kind, body, page: n(form, 'page') } })
  revalidatePath(`/books/${bookId}`)
  revalidatePath('/me')
  return { ok: true, message: '기록했습니다.' }
}

/** 본인 기록, 또는 대리 입력 권한이 있으면 계정 없는 구성원의 기록만 지울 수 있다. */
export async function deleteNote(noteId: string) {
  const ctx = await requireMember()
  const note = await prisma.note.findFirst({
    where: { id: noteId, reading: { member: { householdId: ctx.household.id } } },
    include: { reading: { include: { member: true } } },
  })
  if (!note) notFound()
  const owner = note.reading.member
  const allowed = owner.id === ctx.member.id || (!owner.userId && can(ctx.member.role, 'reading.proxy'))
  if (!allowed) throw new Error('본인 기록만 지울 수 있습니다.')
  await prisma.note.delete({ where: { id: noteId } })
  revalidatePath(`/books/${note.reading.bookId}`)
}
