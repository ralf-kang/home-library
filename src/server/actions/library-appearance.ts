'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { appearanceSchema, type LibraryAppearance } from '@/lib/library-appearance'
import { requireMember } from '@/server/auth'

type Result = { ok: true; appearance: LibraryAppearance } | { ok: false; error: string }

export async function saveLibraryAppearance(expectedHouseholdId: string, input: unknown): Promise<Result> {
  const { user, member, household } = await requireMember()
  // A tab left open before switching households must not update the new household.
  if (expectedHouseholdId !== household.id) return { ok: false, error: '서재가 전환되었습니다. 페이지를 새로 열고 다시 꾸며 주세요.' }
  const parsed = appearanceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: '선택한 꾸미기 항목과 문구 길이(40자 이내)를 확인해 주세요.' }
  try {
    const result = await prisma.member.updateMany({
      where: { id: member.id, userId: user.id, householdId: household.id },
      data: { libraryAppearance: parsed.data },
    })
    if (result.count !== 1) return { ok: false, error: '현재 서재의 구성원인지 확인한 후 다시 시도해 주세요.' }
  } catch {
    return { ok: false, error: '꾸미기 설정을 저장하지 못했습니다. 선택한 내용은 유지되니 잠시 후 다시 시도해 주세요.' }
  }
  revalidatePath('/', 'layout')
  return { ok: true, appearance: parsed.data }
}
