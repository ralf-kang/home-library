'use server'

import { revalidatePath } from 'next/cache'
import type { NoteKind, ReadingStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireMember } from '@/server/auth'
import { d, n, s, type ActionResult } from '@/server/form'

const STATUSES: ReadingStatus[] = ['WANT', 'READING', 'DONE', 'DROPPED', 'REFERENCE']
const NOTE_KINDS: NoteKind[] = ['REVIEW', 'QUOTE', 'MEMO']

/** 내 읽기 기록 저장(구성원 본인 것만). 상태를 '완독'으로 바꾸면 완독일·읽은 횟수를 채운다. */
export async function saveReading(bookId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await requireMember()
  const status = s(form, 'status') as ReadingStatus | null
  if (!status || !STATUSES.includes(status)) {
    // 상태를 비우면 기록 삭제(독후감이 있으면 지우지 않는다)
    const existing = await prisma.reading.findUnique({
      where: { memberId_bookId: { memberId: me.id, bookId } },
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
    where: { memberId_bookId: { memberId: me.id, bookId } },
    create: { memberId: me.id, bookId, ...data },
    update: data,
  })
  revalidatePath(`/books/${bookId}`)
  revalidatePath('/me')
  return { ok: true, message: '저장했습니다.' }
}

/** 아이 책: "한 번 더 읽어 줬어요" 탭 한 번으로 횟수 +1 (기획서 F-11). */
export async function incrementReadCount(bookId: string) {
  const me = await requireMember()
  await prisma.reading.upsert({
    where: { memberId_bookId: { memberId: me.id, bookId } },
    create: { memberId: me.id, bookId, status: 'DONE', readCount: 1, finishedAt: new Date() },
    update: { readCount: { increment: 1 }, status: 'DONE', finishedAt: new Date() },
  })
  revalidatePath(`/books/${bookId}`)
}

export async function addNote(bookId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await requireMember()
  const kind = s(form, 'kind') as NoteKind | null
  const body = s(form, 'body')
  if (!kind || !NOTE_KINDS.includes(kind)) return { ok: false, error: '종류를 골라 주세요.' }
  if (!body) return { ok: false, error: '내용을 입력해 주세요.' }
  if (body.length > 20000) return { ok: false, error: '내용이 너무 깁니다(2만 자 이하).' }
  // 읽기 기록이 없으면 '읽는 중'으로 만들고 거기에 붙인다.
  const reading = await prisma.reading.upsert({
    where: { memberId_bookId: { memberId: me.id, bookId } },
    create: { memberId: me.id, bookId, status: 'READING' },
    update: {},
  })
  await prisma.note.create({ data: { readingId: reading.id, kind, body, page: n(form, 'page') } })
  revalidatePath(`/books/${bookId}`)
  revalidatePath('/me')
  return { ok: true, message: '기록했습니다.' }
}

export async function deleteNote(noteId: string) {
  const me = await requireMember()
  const note = await prisma.note.findUnique({ where: { id: noteId }, include: { reading: true } })
  if (!note || note.reading.memberId !== me.id) throw new Error('본인 기록만 지울 수 있습니다.')
  await prisma.note.delete({ where: { id: noteId } })
  revalidatePath(`/books/${note.reading.bookId}`)
}
