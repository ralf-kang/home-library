'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { appUrl } from '@/lib/google-oidc'
import { INVITE_MAX_USES_LIMIT, INVITE_TTL_DAYS } from '@/lib/invite'
import { can } from '@/lib/permissions'
import { currentMembership, requireCan, requireUser } from '@/server/auth'
import { b, n, s, type ActionResult } from '@/server/form'
import { hashInviteToken, newInviteToken } from '@/server/households'
import { canAccessNeighborhood, isOrganizer } from '@/server/neighborhood'

function refresh() {
  revalidatePath('/neighborhood')
}

// ── 동네 만들기·초대·가구 참여 ────────────────────────────────────────────

export async function createNeighborhood(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireUser()
  const name = s(form, 'name')
  if (!name) return { ok: false, error: '동네 이름을 입력해 주세요.' }
  if (name.length > 40) return { ok: false, error: '이름이 너무 깁니다.' }
  const { member, household } = await currentMembership()
  const shareMine = b(form, 'shareHousehold') && member && household && can(member.role, 'household.manage') && !household.neighborhoodId
  const nb = await prisma.$transaction(async (tx) => {
    const created = await tx.neighborhood.create({ data: { name, regionName: s(form, 'regionName'), createdById: user.id } })
    await tx.neighborMembership.create({ data: { neighborhoodId: created.id, userId: user.id, role: 'ORGANIZER' } })
    if (shareMine) await tx.household.update({ where: { id: household.id }, data: { neighborhoodId: created.id } })
    return created
  })
  redirect(`/neighborhood?n=${nb.id}&created=1`)
}

export async function createNeighborInvite(neighborhoodId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireUser()
  if (!(await isOrganizer(user.id, neighborhoodId))) return { ok: false, error: '동네 운영자만 이웃을 초대할 수 있습니다.' }
  const maxUses = Math.min(INVITE_MAX_USES_LIMIT, Math.max(1, n(form, 'maxUses') ?? 10))
  const email = s(form, 'email')?.toLowerCase() ?? null
  const token = newInviteToken()
  await prisma.invite.create({
    data: {
      kind: 'NEIGHBOR',
      tokenHash: hashInviteToken(token),
      neighborhoodId,
      email,
      maxUses,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000),
      createdById: user.id,
    },
  })
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  refresh()
  return {
    ok: true,
    message: `이웃 초대 링크를 만들었습니다(${INVITE_TTL_DAYS}일 유효, ${maxUses}회). 지금 한 번만 보입니다.`,
    link: `${appUrl(host ? `${h.get('x-forwarded-proto') ?? 'http'}://${host}` : undefined)}/invite/${token}`,
  }
}

/** 지금 서재를 동네 공유 서가에 참여시키거나 빼기(가구 소유자만). */
export async function setHouseholdSharing(neighborhoodId: string, share: boolean): Promise<ActionResult> {
  const { user, household } = await requireCan('household.manage')
  if (!(await canAccessNeighborhood(user.id, neighborhoodId))) return { ok: false, error: '참여하지 않은 동네입니다.' }
  if (share && household.neighborhoodId && household.neighborhoodId !== neighborhoodId) {
    return { ok: false, error: '서재는 한 동네에만 참여할 수 있습니다. 먼저 다른 동네에서 빼 주세요.' }
  }
  await prisma.household.update({ where: { id: household.id }, data: { neighborhoodId: share ? neighborhoodId : null } })
  // 가구가 참여하면 소유자를 동네 주민으로도 등록해 둔다(가구가 빠져도 동네 열람 유지)
  if (share) {
    await prisma.neighborMembership.upsert({
      where: { neighborhoodId_userId: { neighborhoodId, userId: user.id } },
      create: { neighborhoodId, userId: user.id, role: 'RESIDENT' },
      update: {},
    })
  }
  refresh()
  return { ok: true, message: share ? '우리 서재의 대여 가능 책을 동네에 공유했습니다.' : '동네 공유를 멈췄습니다.' }
}

export async function leaveNeighborhood(neighborhoodId: string) {
  const user = await requireUser()
  await prisma.neighborMembership.deleteMany({ where: { neighborhoodId, userId: user.id } })
  redirect('/neighborhood')
}

// ── 대여 요청 ─────────────────────────────────────────────────────────────

export async function requestLoan(copyId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireUser()
  const copy = await prisma.copy.findUnique({
    where: { id: copyId },
    select: { lendable: true, status: true, book: { select: { title: true, householdId: true, household: { select: { neighborhoodId: true } } } } },
  })
  const nid = copy?.book.household.neighborhoodId
  if (!copy || !nid || !copy.lendable || !(await canAccessNeighborhood(user.id, nid))) return { ok: false, error: '빌릴 수 없는 책입니다.' }
  if (copy.status !== 'ON_SHELF') return { ok: false, error: '지금은 다른 분이 보고 있는 책입니다.' }
  const mine = await prisma.member.findFirst({ where: { userId: user.id, householdId: copy.book.householdId } })
  if (mine) return { ok: false, error: '우리 서재의 책입니다.' }
  const open = await prisma.loanRequest.findFirst({ where: { copyId, requesterUserId: user.id, status: { in: ['REQUESTED', 'APPROVED'] } } })
  if (open) return { ok: false, error: '이미 요청한 책입니다.' }
  await prisma.loanRequest.create({ data: { copyId, requesterUserId: user.id, message: s(form, 'message')?.slice(0, 300) ?? null } })
  refresh()
  return { ok: true, message: `『${copy.book.title}』 대여를 요청했습니다. 책 주인 가족이 승인하면 알려 드려요.` }
}

export async function cancelLoanRequest(requestId: string): Promise<ActionResult> {
  const user = await requireUser()
  const r = await prisma.loanRequest.updateMany({
    where: { id: requestId, requesterUserId: user.id, status: 'REQUESTED' },
    data: { status: 'CANCELED', decidedAt: new Date() },
  })
  refresh()
  return r.count ? { ok: true, message: '요청을 취소했습니다.' } : { ok: false, error: '취소할 수 없는 요청입니다.' }
}

/** 우리 서재로 들어온 요청을 승인·거절(관리자 이상). 다른 가구의 요청 id 는 거부된다. */
export async function decideLoanRequest(requestId: string, approve: boolean): Promise<ActionResult> {
  const { member, household } = await requireCan('loan.approve')
  const req = await prisma.loanRequest.findFirst({
    where: { id: requestId, status: 'REQUESTED', copy: { book: { householdId: household.id } } },
    include: { requester: true, copy: true },
  })
  if (!req) return { ok: false, error: '처리할 수 없는 요청입니다.' }
  if (!approve) {
    await prisma.loanRequest.update({ where: { id: requestId }, data: { status: 'REJECTED', decidedAt: new Date() } })
    refresh()
    return { ok: true, message: '요청을 거절했습니다.' }
  }
  if (req.copy.status !== 'ON_SHELF') return { ok: false, error: '이미 대여 중이거나 서가에 없는 책입니다.' }
  await prisma.$transaction([
    prisma.loanRequest.update({ where: { id: requestId }, data: { status: 'APPROVED', decidedAt: new Date() } }),
    prisma.loan.create({
      data: {
        copyId: req.copyId,
        borrowerName: req.requester.name,
        requestId,
        handledById: member.id,
        dueAt: new Date(Date.now() + 14 * 86400_000),
      },
    }),
    prisma.copy.update({ where: { id: req.copyId }, data: { status: 'LOANED' } }),
    // 같은 책에 걸린 다른 대기 요청은 자동 거절
    prisma.loanRequest.updateMany({
      where: { copyId: req.copyId, status: 'REQUESTED', id: { not: requestId } },
      data: { status: 'REJECTED', decidedAt: new Date() },
    }),
  ])
  refresh()
  return { ok: true, message: `${req.requester.name}님께 빌려 드리기로 했습니다(반납 예정 2주 후).` }
}

export async function markReturned(requestId: string): Promise<ActionResult> {
  const { household } = await requireCan('loan.approve')
  const req = await prisma.loanRequest.findFirst({
    where: { id: requestId, status: 'APPROVED', copy: { book: { householdId: household.id } } },
    include: { loan: true },
  })
  if (!req) return { ok: false, error: '처리할 수 없는 요청입니다.' }
  await prisma.$transaction([
    prisma.loanRequest.update({ where: { id: requestId }, data: { status: 'RETURNED' } }),
    ...(req.loan ? [prisma.loan.update({ where: { id: req.loan.id }, data: { returnedAt: new Date() } })] : []),
    prisma.copy.update({ where: { id: req.copyId }, data: { status: 'ON_SHELF' } }),
  ])
  refresh()
  return { ok: true, message: '반납 처리했습니다.' }
}
