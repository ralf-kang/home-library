'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requirePlatformAdmin } from '@/server/auth'
import { b, s, type ActionResult } from '@/server/form'

function httpUrl(v: string | null): string | null {
  if (!v) return null
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

function date(v: string | null): Date | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+09:00`) : null
}

/** 후원·동네 책방 배너 등록(플랫폼 관리자). */
export async function saveSponsor(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requirePlatformAdmin()
  const title = s(form, 'title')
  if (!title) return { ok: false, error: '제목을 입력해 주세요.' }
  const linkRaw = s(form, 'linkUrl')
  const imageRaw = s(form, 'imageUrl')
  const linkUrl = httpUrl(linkRaw)
  const imageUrl = httpUrl(imageRaw)
  if ((linkRaw && !linkUrl) || (imageRaw && !imageUrl)) return { ok: false, error: '링크·이미지는 http(s) 주소여야 합니다.' }
  const neighborhoodId = s(form, 'neighborhoodId')
  if (neighborhoodId && !(await prisma.neighborhood.findUnique({ where: { id: neighborhoodId } }))) return { ok: false, error: '없는 동네입니다.' }
  await prisma.sponsorSlot.create({
    data: {
      title: title.slice(0, 60),
      body: s(form, 'body')?.slice(0, 200) ?? null,
      linkUrl,
      imageUrl,
      neighborhoodId,
      startsAt: date(s(form, 'startsAt')),
      endsAt: date(s(form, 'endsAt')),
      active: b(form, 'active'),
    },
  })
  revalidatePath('/admin')
  return { ok: true, message: '배너를 등록했습니다.' }
}

export async function toggleSponsor(id: string): Promise<ActionResult> {
  await requirePlatformAdmin()
  const slot = await prisma.sponsorSlot.findUnique({ where: { id } })
  if (!slot) return { ok: false, error: '없는 배너입니다.' }
  await prisma.sponsorSlot.update({ where: { id }, data: { active: !slot.active } })
  revalidatePath('/admin')
  return { ok: true }
}

export async function deleteSponsor(id: string): Promise<ActionResult> {
  await requirePlatformAdmin()
  await prisma.sponsorSlot.deleteMany({ where: { id } })
  revalidatePath('/admin')
  return { ok: true }
}
