'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { HouseholdRole } from '@prisma/client'
import { prisma } from '@/lib/db'
import { appUrl } from '@/lib/google-oidc'
import { INVITE_MAX_USES_LIMIT, INVITE_TTL_DAYS, inviteProblem, uniqueName } from '@/lib/invite'
import { ROLE_RANK, assignableRoles } from '@/lib/permissions'
import { requireCan, requireMember, requireUser } from '@/server/auth'
import { b, n, s, type ActionResult } from '@/server/form'
import { createHousehold, findInviteByToken, hashInviteToken, newInviteToken, setSessionHousehold } from '@/server/households'

async function origin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return appUrl(host ? `${proto}://${host}` : undefined)
}

// ── 가구 만들기·전환·설정 ─────────────────────────────────────────────────

export async function createHouseholdAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireUser()
  const name = s(form, 'name')
  const ownerName = s(form, 'ownerName') ?? user.name
  if (!name) return { ok: false, error: '서재 이름을 입력해 주세요.' }
  if (name.length > 40 || ownerName.length > 20) return { ok: false, error: '이름이 너무 깁니다.' }
  const household = await prisma.$transaction((tx) => createHousehold(tx, user.id, name, ownerName))
  await setSessionHousehold(user.id, household.id)
  redirect('/dashboard?welcome=1')
}

export async function switchHousehold(householdId: string) {
  const user = await requireUser()
  const member = await prisma.member.findFirst({ where: { userId: user.id, householdId } })
  if (!member) throw new Error('소속된 서재가 아닙니다.')
  await setSessionHousehold(user.id, householdId)
  redirect('/dashboard')
}

export async function updateHousehold(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { household } = await requireCan('household.manage')
  const name = s(form, 'name')
  if (!name) return { ok: false, error: '서재 이름을 입력해 주세요.' }
  await prisma.household.update({
    where: { id: household.id },
    data: { name, regionName: s(form, 'regionName'), regionCode: s(form, 'regionCode') },
  })
  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { ok: true, message: '서재 정보를 저장했습니다.' }
}

// ── 가족 구성원 ───────────────────────────────────────────────────────────

/**
 * 계정 없는 구성원(아이 등) 추가·수정, 또는 계정 있는 구성원의 역할 변경.
 * 자기보다 높은 역할은 줄 수 없고, OWNER 역할은 이 화면에서 바꾸지 않는다(소유권 이전은 별도).
 */
export async function saveMember(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { member: me, household } = await requireCan('family.invite')
  const id = s(form, 'id')
  const name = s(form, 'name')
  if (!name) return { ok: false, error: '이름을 입력해 주세요.' }
  const role = (s(form, 'role') ?? 'CHILD') as HouseholdRole
  const ageGroup = s(form, 'ageGroup') === 'CHILD' ? 'CHILD' : 'ADULT'
  const sortOrder = n(form, 'sortOrder') ?? 0
  try {
    if (id) {
      const target = await prisma.member.findFirst({ where: { id, householdId: household.id } })
      if (!target) return { ok: false, error: '없는 구성원입니다.' }
      const roleChange = target.role === 'OWNER' ? 'OWNER' : role
      if (target.role !== 'OWNER' && !assignableRoles(me.role).includes(roleChange)) {
        return { ok: false, error: '그 역할은 줄 수 없습니다.' }
      }
      if (target.role !== 'OWNER' && ROLE_RANK[target.role] > ROLE_RANK[me.role]) {
        return { ok: false, error: '나보다 높은 역할의 구성원은 바꿀 수 없습니다.' }
      }
      await prisma.member.update({ where: { id }, data: { name, role: roleChange, ageGroup, sortOrder } })
      revalidatePath('/settings')
      return { ok: true, message: '구성원을 저장했습니다.' }
    }
    // 새 구성원은 계정 없는 프로필(아이 기록용). 계정 있는 가족은 초대 링크로 들어온다.
    await prisma.member.create({ data: { householdId: household.id, name, role: 'CHILD', ageGroup, sortOrder } })
    revalidatePath('/settings')
    return { ok: true, message: `${name} 프로필을 만들었습니다. 구글 계정이 있으면 초대 링크로 연결할 수 있습니다.` }
  } catch (e) {
    if ((e as Error).message.includes('Unique constraint')) return { ok: false, error: '같은 이름의 구성원이 이미 있습니다.' }
    throw e
  }
}

export async function deleteMember(id: string): Promise<ActionResult> {
  const { member: me, household } = await requireCan('family.invite')
  const target = await prisma.member.findFirst({ where: { id, householdId: household.id } })
  if (!target) return { ok: false, error: '없는 구성원입니다.' }
  if (target.id === me.id) return { ok: false, error: '자기 자신은 지울 수 없습니다.' }
  if (target.role === 'OWNER') return { ok: false, error: '소유자는 지울 수 없습니다.' }
  if (ROLE_RANK[target.role] > ROLE_RANK[me.role]) return { ok: false, error: '나보다 높은 역할의 구성원은 지울 수 없습니다.' }
  // 읽기 기록·독후감도 함께 지워진다(Cascade). 소장본 소유자는 비워진다(SetNull).
  await prisma.member.delete({ where: { id } })
  revalidatePath('/settings')
  return { ok: true, message: '구성원을 지웠습니다.' }
}

/** 탈퇴(이 서재에서 나가기). 소유자는 나갈 수 없다. */
export async function leaveHousehold(): Promise<ActionResult> {
  const { user, member } = await requireMember()
  if (member.role === 'OWNER') return { ok: false, error: '소유자는 나갈 수 없습니다. 소유권을 넘기거나 서재를 삭제해 주세요.' }
  // 기록은 남기고 계정 연결만 끊는다(가족이 기록을 계속 볼 수 있게).
  await prisma.member.update({ where: { id: member.id }, data: { userId: null } })
  await setSessionHousehold(user.id, null)
  redirect('/dashboard')
}

// ── 초대 ──────────────────────────────────────────────────────────────────

/** 가족 초대 링크 만들기. memberName이 계정 없는 기존 구성원과 같으면, 받는 사람이 그 프로필에 연결된다. */
export async function createFamilyInvite(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { user, member, household } = await requireCan('family.invite')
  const role = (s(form, 'role') ?? 'MEMBER') as HouseholdRole
  if (!assignableRoles(member.role).includes(role)) return { ok: false, error: '그 역할로는 초대할 수 없습니다.' }
  const maxUses = Math.min(INVITE_MAX_USES_LIMIT, Math.max(1, n(form, 'maxUses') ?? 1))
  const email = s(form, 'email')?.toLowerCase() ?? null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: '이메일 형식이 올바르지 않습니다.' }
  const token = newInviteToken()
  await prisma.invite.create({
    data: {
      kind: 'FAMILY',
      tokenHash: hashInviteToken(token),
      householdId: household.id,
      role,
      memberName: s(form, 'memberName'),
      email,
      maxUses,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000),
      createdById: user.id,
    },
  })
  revalidatePath('/settings')
  return {
    ok: true,
    message: `초대 링크를 만들었습니다(${INVITE_TTL_DAYS}일 유효, ${maxUses}회). 이 링크는 지금 한 번만 보입니다 — 카카오톡 등으로 보내 주세요.`,
    link: `${await origin()}/invite/${token}`,
  }
}

export async function revokeInvite(id: string): Promise<ActionResult> {
  const { user, household } = await requireMember()
  const inv = await prisma.invite.findUnique({ where: { id }, include: { neighborhood: { include: { memberships: true } } } })
  if (!inv) return { ok: false, error: '없는 초대입니다.' }
  const familyOk = inv.householdId === household.id
  const neighborOk = inv.neighborhood?.memberships.some((m) => m.userId === user.id && m.role === 'ORGANIZER')
  if (!familyOk && !neighborOk) return { ok: false, error: '취소할 권한이 없습니다.' }
  await prisma.invite.update({ where: { id }, data: { revokedAt: new Date() } })
  revalidatePath('/settings')
  revalidatePath('/neighborhood')
  return { ok: true, message: '초대를 취소했습니다.' }
}

/**
 * 초대 수락. 사용 횟수 증가는 조건부 updateMany로 원자적으로 처리해 동시에 눌러도 maxUses를 넘지 않는다.
 *  - FAMILY: 그 가구의 구성원이 된다(이미 구성원이면 전환만).
 *  - NEIGHBOR: 동네 주민이 된다. shareHousehold를 켜고 내가 관리자 이상인 가구가 있으면 그 가구도 동네 공유 서가에 참여.
 */
export async function acceptInvite(token: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireUser()
  const inv = await findInviteByToken(token)
  if (!inv) return { ok: false, error: '없는 초대입니다.' }
  const problem = inviteProblem(inv, user.email)
  if (problem) return { ok: false, error: problem }

  const claim = () =>
    prisma.invite.updateMany({
      where: { id: inv.id, revokedAt: null, usedCount: { lt: inv.maxUses }, expiresAt: { gt: new Date() } },
      data: { usedCount: { increment: 1 } },
    })

  if (inv.kind === 'FAMILY' && inv.householdId) {
    const existing = await prisma.member.findFirst({ where: { householdId: inv.householdId, userId: user.id } })
    if (!existing) {
      if ((await claim()).count === 0) return { ok: false, error: '이미 사용된 초대입니다.' }
      const members = await prisma.member.findMany({ where: { householdId: inv.householdId } })
      const placeholder = inv.memberName ? members.find((m) => m.name === inv.memberName && !m.userId) : undefined
      if (placeholder) {
        await prisma.member.update({ where: { id: placeholder.id }, data: { userId: user.id, role: inv.role ?? 'MEMBER' } })
      } else {
        await prisma.member.create({
          data: {
            householdId: inv.householdId,
            userId: user.id,
            name: uniqueName(inv.memberName ?? user.name, members.map((m) => m.name)),
            role: inv.role && inv.role !== 'OWNER' ? inv.role : 'MEMBER',
            ageGroup: inv.role === 'CHILD' ? 'CHILD' : 'ADULT',
          },
        })
      }
    }
    await setSessionHousehold(user.id, inv.householdId)
    redirect('/dashboard?joined=1')
  }

  if (inv.kind === 'NEIGHBOR' && inv.neighborhoodId) {
    const existing = await prisma.neighborMembership.findUnique({
      where: { neighborhoodId_userId: { neighborhoodId: inv.neighborhoodId, userId: user.id } },
    })
    if (!existing) {
      if ((await claim()).count === 0) return { ok: false, error: '이미 사용된 초대입니다.' }
      await prisma.neighborMembership.create({ data: { neighborhoodId: inv.neighborhoodId, userId: user.id, role: 'RESIDENT' } })
    }
    const shareId = b(form, 'shareHousehold') ? s(form, 'householdId') : null
    if (shareId) {
      const admin = await prisma.member.findFirst({
        where: { userId: user.id, householdId: shareId, role: { in: ['OWNER', 'ADMIN'] } },
        include: { household: true },
      })
      if (admin && !admin.household.neighborhoodId) {
        await prisma.household.update({ where: { id: shareId }, data: { neighborhoodId: inv.neighborhoodId } })
      }
    }
    redirect(`/neighborhood?n=${inv.neighborhoodId}&joined=1`)
  }
  return { ok: false, error: '잘못된 초대입니다.' }
}
