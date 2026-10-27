import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { callNumber, compareCode, labelState, type LabelState } from '@/lib/labels'
import { descendantIds } from '@/lib/location'
import type { LocationIndex } from '@/server/queries'

/**
 * 칸에 새로 들어온 소장본에 '맨 뒤' 순번을 준다(createBook·addCopy·updateCopy·moveCopies·사진 등록).
 * 이미 그 칸에 있는 소장본은 건드리지 않는다. 위치가 없으면(미지정) 순번을 비운다.
 */
export async function appendToShelf(tx: Prisma.TransactionClient, locationId: string | null, copyIds: string[]) {
  if (copyIds.length === 0) return
  if (!locationId) {
    await tx.copy.updateMany({ where: { id: { in: copyIds } }, data: { shelfPos: null } })
    return
  }
  const max = await tx.copy.aggregate({ where: { locationId, id: { notIn: copyIds } }, _max: { shelfPos: true } })
  let next = (max._max.shelfPos ?? 0) + 1
  for (const id of copyIds) {
    await tx.copy.update({ where: { id }, data: { shelfPos: next++ } })
  }
}

export type LabelFilter = 'todo' | 'never' | 'stale' | 'all'

export const LABEL_FILTER_TEXT: Record<LabelFilter, string> = {
  todo: '뽑을 라벨(새 라벨 + 다시 뽑을 라벨)',
  never: '아직 안 뽑은 라벨',
  stale: '다시 뽑을 라벨(위치·순번 바뀜)',
  all: '전체',
}

export interface LabelItem {
  copyId: string
  seq: number
  bookId: string
  title: string
  volumeNo: number | null
  fullCode: string
  locationName: string
  zoneName: string | null
  shelfPos: number | null
  callNumber: string | null
  state: LabelState
}

/**
 * 라벨 출력 대기열. 가구 경계 안에서 범위(위치와 그 하위)의 소장본을
 * 위치 코드 자연 정렬 → 칸 안 순번 순서로 돌려준다. 순번이 없는 책은 'unplaced'로 따로 센다.
 */
export async function loadLabelQueue(hid: string, loc: LocationIndex, scopeId: string | null, filter: LabelFilter) {
  const scope = scopeId && loc.byId.has(scopeId) ? descendantIds(scopeId, loc.children) : null
  const copies = await prisma.copy.findMany({
    where: { book: { householdId: hid }, locationId: scope ? { in: scope } : { not: null }, status: { notIn: ['LOST', 'DISPOSED'] } },
    select: { id: true, seq: true, shelfPos: true, labelCode: true, locationId: true, book: { select: { id: true, title: true, volumeNo: true } } },
  })
  const all: LabelItem[] = copies.map((c) => {
    const d = loc.describe(c.locationId)!
    const cn = callNumber(d?.code, c.shelfPos)
    return {
      copyId: c.id,
      seq: c.seq,
      bookId: c.book.id,
      title: c.book.title,
      volumeNo: c.book.volumeNo,
      fullCode: d?.code ?? '',
      locationName: d?.name ?? '',
      zoneName: d?.zone?.name ?? null,
      shelfPos: c.shelfPos,
      callNumber: cn,
      state: labelState(cn, c.labelCode),
    }
  })
  all.sort((a, b) => compareCode(a.fullCode, b.fullCode) || (a.shelfPos ?? Infinity) - (b.shelfPos ?? Infinity) || a.seq - b.seq)
  const counts = { never: 0, stale: 0, ok: 0, unplaced: 0 } satisfies Record<LabelState, number>
  for (const it of all) counts[it.state]++
  const items = all.filter((it) =>
    it.state === 'unplaced' ? false : filter === 'all' ? true : filter === 'todo' ? it.state !== 'ok' : it.state === filter,
  )
  return { items, counts }
}

/** 칸 이름표 목록(범위 안의 칸, 코드 순). */
export function shelfTags(loc: LocationIndex, scopeId: string | null) {
  const ids = scopeId && loc.byId.has(scopeId) ? new Set(descendantIds(scopeId, loc.children)) : null
  return loc.locations
    .filter((l) => l.kind === 'SHELF' && (!ids || ids.has(l.id)))
    .map((l) => {
      const d = loc.describe(l.id)!
      return { id: l.id, code: d.code, name: d.name, zone: d.zone?.name ?? null }
    })
    .sort((a, b) => compareCode(a.code, b.code))
}
