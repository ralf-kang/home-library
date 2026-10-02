'use server'

import { revalidatePath } from 'next/cache'
import type { LocationKind, MemberRole } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/server/auth'
import { b, n, s, type ActionResult } from '@/server/form'

const CHILD_KIND: Record<LocationKind, LocationKind | null> = { ROOM: 'BOOKCASE', BOOKCASE: 'SHELF', SHELF: null }
const CODE_RE = /^[A-Za-z0-9]{1,8}$/

function done(message: string): ActionResult {
  revalidatePath('/settings')
  revalidatePath('/shelves')
  return { ok: true, message }
}

function fail(e: unknown): ActionResult {
  const msg = (e as Error).message ?? String(e)
  if (msg.includes('Unique constraint')) return { ok: false, error: '같은 이름(또는 같은 상위 안의 같은 코드)이 이미 있습니다.' }
  if (msg.includes('Foreign key constraint')) return { ok: false, error: '연결된 데이터가 있어 지울 수 없습니다.' }
  return { ok: false, error: msg }
}

// ── 구성원 ────────────────────────────────────────────────────────────────

export async function saveMember(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin()
  const id = s(form, 'id')
  const name = s(form, 'name')
  if (!name) return { ok: false, error: '이름을 입력해 주세요.' }
  const role: MemberRole = s(form, 'role') === 'CHILD' ? 'CHILD' : 'ADULT'
  const isAdmin = b(form, 'isAdmin')
  try {
    if (id) {
      if (id === admin.id && !isAdmin) return { ok: false, error: '자기 자신의 관리자 권한은 뺄 수 없습니다.' }
      await prisma.member.update({ where: { id }, data: { name, role, isAdmin, sortOrder: n(form, 'sortOrder') ?? 0 } })
      return done('구성원을 저장했습니다.')
    }
    await prisma.member.create({ data: { name, role, isAdmin, sortOrder: n(form, 'sortOrder') ?? 0 } })
    return done('구성원을 추가했습니다.')
  } catch (e) {
    return fail(e)
  }
}

export async function deleteMember(id: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (id === admin.id) return { ok: false, error: '자기 자신은 지울 수 없습니다.' }
  try {
    // 읽기 기록·독후감도 함께 지워진다(Cascade). 소장본 소유자는 비워진다(SetNull).
    await prisma.member.delete({ where: { id } })
    return done('구성원을 지웠습니다.')
  } catch (e) {
    return fail(e)
  }
}

// ── 구역 ──────────────────────────────────────────────────────────────────

export async function saveZone(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const id = s(form, 'id')
  const name = s(form, 'name')
  const color = s(form, 'color') ?? '#64748b'
  if (!name) return { ok: false, error: '구역 이름을 입력해 주세요.' }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { ok: false, error: '색상은 #RRGGBB 형식이어야 합니다.' }
  try {
    if (id) await prisma.zone.update({ where: { id }, data: { name, color } })
    else await prisma.zone.create({ data: { name, color } })
    return done('구역을 저장했습니다.')
  } catch (e) {
    return fail(e)
  }
}

export async function deleteZone(id: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.zone.delete({ where: { id } }) // 칸의 구역 연결은 비워진다(SetNull)
    return done('구역을 지웠습니다.')
  } catch (e) {
    return fail(e)
  }
}

// ── 위치(공간 › 책장 › 칸) ────────────────────────────────────────────────

/**
 * 위치 추가/수정. 부모의 종류에 따라 자식 종류가 정해진다(공간→책장→칸).
 * 코드는 영문·숫자 1~8자(LV, B2, S3). 같은 부모 안에서 코드가 겹치면 안 된다.
 */
export async function saveLocation(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin()
  const id = s(form, 'id')
  const code = (s(form, 'code') ?? '').toUpperCase()
  const name = s(form, 'name')
  const zoneId = s(form, 'zoneId')
  const parentId = s(form, 'parentId')
  if (!CODE_RE.test(code)) return { ok: false, error: '코드는 영문·숫자 1~8자로 입력해 주세요(예: LV, B2, S3).' }
  if (!name) return { ok: false, error: '이름을 입력해 주세요.' }
  try {
    if (id) {
      await prisma.location.update({ where: { id }, data: { code, name, zoneId, sortOrder: n(form, 'sortOrder') ?? undefined } })
      return done('위치를 저장했습니다.')
    }
    let kind: LocationKind = 'ROOM'
    if (parentId) {
      const parent = await prisma.location.findUnique({ where: { id: parentId } })
      if (!parent) return { ok: false, error: '상위 위치가 없습니다.' }
      const child = CHILD_KIND[parent.kind]
      if (!child) return { ok: false, error: '칸 아래에는 위치를 만들 수 없습니다.' }
      kind = child
    }
    const siblings = await prisma.location.count({ where: { parentId } })
    await prisma.location.create({ data: { kind, code, name, zoneId, parentId, sortOrder: siblings } })
    return done('위치를 추가했습니다.')
  } catch (e) {
    return fail(e)
  }
}

/** 칸 여러 개를 한 번에 만든다(책장에 S1..Sn). 서가 초기 구축용. */
export async function addShelves(bookcaseId: string, form: FormData): Promise<void> {
  await requireAdmin()
  const count = Math.min(20, Math.max(1, n(form, 'count') ?? 1))
  const bookcase = await prisma.location.findUnique({ where: { id: bookcaseId }, include: { children: true } })
  if (!bookcase || bookcase.kind !== 'BOOKCASE') throw new Error('책장에만 칸을 추가할 수 있습니다.')
  const used = new Set(bookcase.children.map((c) => c.code))
  let next = 1
  const data = []
  for (let i = 0; i < count; i++) {
    while (used.has(`S${next}`)) next++
    used.add(`S${next}`)
    data.push({ kind: 'SHELF' as const, code: `S${next}`, name: `${next}칸`, parentId: bookcaseId, sortOrder: next })
  }
  await prisma.location.createMany({ data })
  revalidatePath('/settings')
  revalidatePath('/shelves')
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  await requireAdmin()
  const loc = await prisma.location.findUnique({
    where: { id },
    include: { _count: { select: { children: true, copies: true } } },
  })
  if (!loc) return { ok: false, error: '없는 위치입니다.' }
  if (loc._count.children > 0) return { ok: false, error: '하위 위치가 있어 지울 수 없습니다. 하위부터 지워 주세요.' }
  if (loc._count.copies > 0) return { ok: false, error: `이 위치에 책 ${loc._count.copies}권이 있습니다. 먼저 다른 칸으로 옮겨 주세요.` }
  try {
    await prisma.location.delete({ where: { id } })
    return done('위치를 지웠습니다.')
  } catch (e) {
    return fail(e)
  }
}
