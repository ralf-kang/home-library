'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { SHELF_ORDER_LABEL, callNumber, renumber, type ShelfOrderMode } from '@/lib/labels'
import { descendantIds } from '@/lib/location'
import { requireCan } from '@/server/auth'
import { s, type ActionResult } from '@/server/form'
import { loadLocations } from '@/server/queries'

const MODES = Object.keys(SHELF_ORDER_LABEL) as ShelfOrderMode[]

/**
 * 칸 순서 정하기. 범위(공간·책장·칸, 없으면 집 전체)의 칸마다 정렬 기준대로 1부터 다시 매긴다.
 * 순번이 바뀐 책은 청구기호가 달라지므로 '다시 뽑을 라벨'이 된다.
 */
export async function assignShelfOrder(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { household } = await requireCan('book.write')
  const hid = household.id
  const mode = (s(form, 'mode') ?? 'keep') as ShelfOrderMode
  if (!MODES.includes(mode)) return { ok: false, error: '정렬 기준을 골라 주세요.' }
  const loc = await loadLocations(hid)
  const scopeId = s(form, 'scope')
  const scope = scopeId && loc.byId.has(scopeId) ? descendantIds(scopeId, loc.children) : loc.locations.map((l) => l.id)
  const copies = await prisma.copy.findMany({
    where: { book: { householdId: hid }, locationId: { in: scope } },
    select: {
      id: true,
      seq: true,
      shelfPos: true,
      locationId: true,
      book: { select: { title: true, authors: true, category: true, volumeNo: true, series: { select: { name: true } } } },
    },
  })
  const byShelf = new Map<string, typeof copies>()
  for (const c of copies) byShelf.set(c.locationId!, [...(byShelf.get(c.locationId!) ?? []), c])
  // 바뀐 순번만 모아 한 번의 UPDATE … FROM (VALUES …) 로 반영한다(수백 권을 한 줄씩 고치면 1분 넘게 걸림)
  const updates: { id: string; pos: number }[] = []
  for (const items of byShelf.values()) {
    const order = renumber(
      items.map((c) => ({
        id: c.id,
        shelfPos: c.shelfPos,
        seq: c.seq,
        title: c.book.title,
        authors: c.book.authors,
        category: c.book.category,
        series: c.book.series?.name ?? null,
        volumeNo: c.book.volumeNo,
      })),
      mode,
    )
    for (const c of items) {
      const pos = order.get(c.id)!
      if (pos !== c.shelfPos) updates.push({ id: c.id, pos })
    }
  }
  // id 는 위에서 이 가구 소속으로 조회한 소장본에서만 나온다(테넌트 경계)
  for (let i = 0; i < updates.length; i += 1000) {
    const chunk = updates.slice(i, i + 1000)
    await prisma.$executeRaw`
      UPDATE copies AS c SET shelf_pos = v.pos
      FROM (VALUES ${Prisma.join(chunk.map((u) => Prisma.sql`(${u.id}, ${u.pos}::int)`))}) AS v(id, pos)
      WHERE c.id = v.id`
  }
  revalidatePath('/labels')
  revalidatePath('/shelves')
  // 순번을 매기면 '칸 순서 정하기' 패널이 닫힌 상태로 다시 그려져 결과가 가려진다 → 결과를 주소로 넘겨 위쪽 안내로 보여 준다
  const back = new URLSearchParams()
  for (const k of ['kind', 'filter', 'size', 'scope']) {
    const v = s(form, k)
    if (v) back.set(k, v)
  }
  back.set('ordered', `${mode}:${byShelf.size}:${copies.length}:${updates.length}`)
  redirect(`/labels?${back}`)
}

/**
 * 인쇄 완료 기록: 지금 청구기호를 labelCode 로 저장한다. 다른 가구의 소장본 id 는 무시된다.
 * 인쇄 창 경로는 사용자가 확인 버튼으로, 블루투스 경로는 한 장 인쇄가 끝날 때마다 부른다.
 */
export async function markLabelsPrinted(copyIds: string[]): Promise<ActionResult> {
  const { household } = await requireCan('book.write')
  if (!Array.isArray(copyIds) || copyIds.length === 0) return { ok: false, error: '표시할 라벨이 없습니다.' }
  const ids = copyIds.filter((x) => typeof x === 'string').slice(0, 2000)
  const loc = await loadLocations(household.id)
  const copies = await prisma.copy.findMany({
    where: { id: { in: ids }, book: { householdId: household.id } },
    select: { id: true, locationId: true, shelfPos: true },
  })
  const now = new Date()
  // 한 번의 UPDATE … FROM (VALUES …). id 는 이 가구 소속으로 조회한 것만 쓴다.
  for (let i = 0; i < copies.length; i += 1000) {
    const rows = copies.slice(i, i + 1000).map((c) => Prisma.sql`(${c.id}, ${callNumber(loc.describe(c.locationId)?.code, c.shelfPos)})`)
    await prisma.$executeRaw`
      UPDATE copies AS c SET label_code = v.code, label_printed_at = ${now}
      FROM (VALUES ${Prisma.join(rows)}) AS v(id, code)
      WHERE c.id = v.id`
  }
  revalidatePath('/labels')
  return { ok: true, message: `라벨 ${copies.length}장을 붙인 것으로 기록했습니다.` }
}
