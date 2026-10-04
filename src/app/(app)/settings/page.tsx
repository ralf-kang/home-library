import ActionForm from '@/components/ActionForm'
import Link from 'next/link'
import { Illustration } from '@/components/Art'
import ConfirmButton from '@/components/ConfirmButton'
import { prisma } from '@/lib/db'
import { LOCATION_KIND_LABEL, formatDate } from '@/lib/format'
import type { LocationNode } from '@/lib/location'
import { ROLE_LABEL, ROLE_RANK, assignableRoles, can } from '@/lib/permissions'
import { addShelves, deleteLocation, deleteZone, saveLocation, saveZone } from '@/server/actions/settings'
import {
  createFamilyInvite,
  deleteMember,
  leaveHousehold,
  revokeInvite,
  saveMember,
  updateHousehold,
} from '@/server/actions/household'
import { requireCan } from '@/server/auth'
import { copyCountsByLocation, listMembers, loadLocations, type LocationIndex } from '@/server/queries'

export default async function SettingsPage() {
  const { member: me, household } = await requireCan('family.invite')
  const hid = household.id
  const [members, zones, loc, counts, invites] = await Promise.all([
    listMembers(hid),
    prisma.zone.findMany({ where: { householdId: hid }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    loadLocations(hid),
    copyCountsByLocation(hid),
    prisma.invite.findMany({
      where: { householdId: hid, kind: 'FAMILY', revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { name: true } } },
    }),
  ])
  const roles = assignableRoles(me.role)
  const isOwner = can(me.role, 'household.manage')
  const placeholders = members.filter((m) => !m.userId)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">서재 설정</h1>
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">나의 서재 꾸미기</h2><p className="text-sm text-muted">내 계정에서 보이는 테마·대표 이미지·선반을 선택합니다.</p></div>
        <Link href="/customize" className="btn-ghost">꾸미기 열기</Link>
      </section>

      <section className="card space-y-3" id="household">
        <h2 className="font-semibold">서재 정보</h2>
        {isOwner ? (
          <ActionForm action={updateHousehold} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="label">서재 이름</label>
              <input name="name" defaultValue={household.name} className="input" required maxLength={40} />
            </div>
            <div>
              <label className="label">우리 동네(시·군·구) — 도서관·인기대출 정보 기준</label>
              <input name="regionName" defaultValue={household.regionName ?? ''} placeholder="예: 경기도 성남시 분당구" className="input" />
              <input type="hidden" name="regionCode" value={household.regionCode ?? ''} />
            </div>
            <div className="flex items-end">
              <button className="btn-primary">저장</button>
            </div>
          </ActionForm>
        ) : (
          <p className="text-sm">
            {household.name} {household.regionName && <span className="text-muted">· {household.regionName}</span>}
          </p>
        )}
        <p className="text-xs text-muted">요금제: {household.plan === 'FREE' ? '무료(현재 모든 기능 무료)' : household.plan}</p>
      </section>

      <section className="card space-y-3" id="members">
        <h2 className="font-semibold">가족 구성원</h2>
        <p className="text-xs text-muted">
          소유자·관리자는 초대·위치 관리, 구성원은 책 등록, 아이는 자기 기록만 할 수 있습니다. 구글 계정이 없는 아이는 &lsquo;계정 없는
          구성원&rsquo;으로 두고 어른이 대신 기록합니다.
        </p>
        <ul className="space-y-2">
          {members.map((m) => {
            const editable = m.role !== 'OWNER' && ROLE_RANK[m.role] <= ROLE_RANK[me.role]
            return (
              <li key={m.id}>
                <ActionForm action={saveMember} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={m.id} />
                  <input name="name" defaultValue={m.name} className="input max-w-[9rem]" required />
                  {editable ? (
                    <select name="role" defaultValue={m.role} className="input max-w-[7rem]">
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="chip bg-brand-soft text-brand">{ROLE_LABEL[m.role]}</span>
                  )}
                  <select name="ageGroup" defaultValue={m.ageGroup} className="input max-w-[6rem]">
                    <option value="ADULT">어른</option>
                    <option value="CHILD">어린이</option>
                  </select>
                  <span className="text-xs text-muted">{m.user ? m.user.email : '계정 없음'}</span>
                  <button className="btn-ghost">저장</button>
                  {editable && m.id !== me.id && (
                    <ConfirmButton action={deleteMember.bind(null, m.id)} confirm={`${m.name}님을 지우면 읽기 기록·독후감도 함께 지워집니다. 계속할까요?`}>
                      삭제
                    </ConfirmButton>
                  )}
                </ActionForm>
              </li>
            )
          })}
        </ul>
        <ActionForm action={saveMember} className="flex flex-wrap items-center gap-2 border-t border-line pt-3" resetOnSuccess>
          <span className="text-sm text-muted">계정 없는 구성원 추가</span>
          <input name="name" placeholder="이름(예: 첫째)" className="input max-w-[9rem]" required />
          <select name="ageGroup" className="input max-w-[6rem]" defaultValue="CHILD">
            <option value="CHILD">어린이</option>
            <option value="ADULT">어른</option>
          </select>
          <button className="btn-ghost">추가</button>
        </ActionForm>
        {!isOwner && (
          <ConfirmButton action={leaveHousehold} confirm="이 서재에서 나갈까요? 내 기록은 가족이 볼 수 있게 남습니다." className="text-xs text-muted underline">
            이 서재에서 나가기
          </ConfirmButton>
        )}
      </section>

      <section className="card space-y-3" id="invite">
        <div className="flex items-center gap-4">
          <Illustration name="inviteCircle" width={120} className="hidden shrink-0 sm:block" />
          <h2 className="font-semibold">가족 초대</h2>
        </div>
        <p className="text-xs text-muted">
          링크를 받은 가족이 구글 계정으로 로그인하면 바로 이 서재에 들어옵니다(회원가입 없음). 동네 이웃은{' '}
          <a href="/neighborhood" className="underline">동네</a> 화면에서 따로 초대합니다 — 이웃은 대여 가능한 책만 볼 수 있습니다.
        </p>
        <ActionForm action={createFamilyInvite} className="grid gap-2 sm:grid-cols-5">
          <div>
            <label className="label">역할</label>
            <select name="role" defaultValue="MEMBER" className="input">
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">연결할 구성원(선택)</label>
            <select name="memberName" defaultValue="" className="input">
              <option value="">새 구성원</option>
              {placeholders.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}(계정 없음)
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">받을 구글 이메일(선택 — 지정하면 그 계정만)</label>
            <input name="email" type="email" placeholder="family@gmail.com" className="input" />
          </div>
          <div>
            <label className="label">사용 횟수</label>
            <input name="maxUses" type="number" min={1} max={20} defaultValue={1} className="input" />
          </div>
          <div className="sm:col-span-5">
            <button className="btn-primary">초대 링크 만들기</button>
          </div>
        </ActionForm>
        {invites.length > 0 && (
          <ul className="space-y-1 border-t border-line pt-3 text-sm">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2">
                <span className="chip bg-paper ring-1 ring-line">{i.role ? ROLE_LABEL[i.role] : '구성원'}</span>
                <span className="text-muted">
                  {i.memberName ? `${i.memberName} 연결 · ` : ''}
                  {i.email ?? '누구나'} · {i.usedCount}/{i.maxUses}회 · {formatDate(i.expiresAt)}까지 · {i.createdBy.name}
                </span>
                <ConfirmButton action={revokeInvite.bind(null, i.id)} confirm="이 초대 링크를 취소할까요?" className="text-xs text-red-700 underline">
                  취소
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3" id="zones">
        <h2 className="font-semibold">구역(칸에 붙이는 주제 라벨)</h2>
        <p className="text-xs text-muted">서가에 붙인 색 테이프(&lsquo;고전&rsquo;, &lsquo;소설&rsquo; 등)와 맞추세요. 칸에 구역이 없으면 책장·공간의 구역을 따릅니다.</p>
        <ul className="flex flex-wrap gap-2">
          {zones.map((z) => (
            <li key={z.id}>
              <ActionForm action={saveZone} className="flex items-center gap-1 rounded-lg border border-line p-1">
                <input type="hidden" name="id" value={z.id} />
                <input type="color" name="color" defaultValue={z.color} className="h-8 w-8 cursor-pointer rounded" />
                <input name="name" defaultValue={z.name} className="input w-28 py-1" />
                <button className="btn-ghost px-2 py-1 text-xs">저장</button>
                <ConfirmButton action={deleteZone.bind(null, z.id)} confirm={`구역 '${z.name}'을 지울까요? 칸의 구역 연결만 비워집니다.`} className="px-1 text-xs text-red-700">
                  ✕
                </ConfirmButton>
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={saveZone} className="flex items-center gap-2" resetOnSuccess>
          <input type="color" name="color" defaultValue="#64748b" className="h-9 w-9 cursor-pointer rounded" />
          <input name="name" placeholder="새 구역" className="input max-w-[10rem]" required />
          <button className="btn-primary">추가</button>
        </ActionForm>
      </section>

      <section className="card space-y-3" id="locations">
        <h2 className="font-semibold">위치(공간 › 책장 › 칸)</h2>
        <p className="text-xs text-muted">
          코드는 영문·숫자로 짧게(공간 LV/ST/KD, 책장 B1·B2, 칸 S1·S2 — 칸은 위에서부터). 전체 코드는 이어 붙여 LV-B2-S3처럼 표시됩니다.
          코드·이름을 바꿔도 책의 위치 연결은 유지됩니다.
        </p>
        <LocationTree parentId={null} loc={loc} zones={zones} counts={counts} />
        <ActionForm action={saveLocation} className="flex flex-wrap items-center gap-2 border-t border-line pt-3" resetOnSuccess>
          <span className="text-sm text-muted">새 공간</span>
          <input name="code" placeholder="코드(LV)" className="input max-w-[6rem]" required />
          <input name="name" placeholder="이름(거실)" className="input max-w-[10rem]" required />
          <button className="btn-primary">추가</button>
        </ActionForm>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">내보내기·백업</h2>
        <a href="/api/export" className="btn-ghost">
          장서 목록 CSV 내려받기(엑셀용)
        </a>
        <p className="text-xs text-muted">DB 백업은 통합 PostgreSQL의 정기 백업(pg_dump)을 따릅니다. 운영 문서(README) 참고.</p>
      </section>
    </div>
  )
}

function LocationTree({
  parentId,
  loc,
  zones,
  counts,
}: {
  parentId: string | null
  loc: LocationIndex
  zones: { id: string; name: string }[]
  counts: Map<string | null, number>
}) {
  const nodes: LocationNode[] = loc.children.get(parentId) ?? []
  if (nodes.length === 0) return null
  return (
    <ul className={parentId ? 'ml-4 space-y-2 border-l border-line pl-3' : 'space-y-2'}>
      {nodes.map((n) => {
        const childKind = n.kind === 'ROOM' ? 'BOOKCASE' : n.kind === 'BOOKCASE' ? 'SHELF' : null
        return (
          <li key={n.id} className="space-y-2">
            <ActionForm action={saveLocation} className="flex flex-wrap items-center gap-2 text-sm">
              <input type="hidden" name="id" value={n.id} />
              <span className="w-10 text-xs text-muted">{LOCATION_KIND_LABEL[n.kind]}</span>
              <input name="code" defaultValue={n.code} className="input w-20 py-1 font-mono" />
              <input name="name" defaultValue={n.name} className="input w-36 py-1" />
              <select name="zoneId" defaultValue={n.zoneId ?? ''} className="input w-28 py-1">
                <option value="">구역 없음</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
              <button className="btn-ghost px-2 py-1 text-xs">저장</button>
              <ConfirmButton action={deleteLocation.bind(null, n.id)} confirm={`${loc.describe(n.id)!.code}를 지울까요?`} className="px-1 text-xs text-red-700 underline">
                삭제
              </ConfirmButton>
              {n.kind === 'SHELF' && <span className="text-xs text-muted">{counts.get(n.id) ?? 0}권</span>}
            </ActionForm>
            <LocationTree parentId={n.id} loc={loc} zones={zones} counts={counts} />
            {childKind === 'BOOKCASE' && (
              <ActionForm action={saveLocation} className="ml-4 flex flex-wrap items-center gap-2 pl-3 text-sm" resetOnSuccess>
                <input type="hidden" name="parentId" value={n.id} />
                <span className="text-xs text-muted">+ 책장</span>
                <input name="code" placeholder="B1" className="input w-20 py-1" required />
                <input name="name" placeholder="1번 책장" className="input w-36 py-1" required />
                <button className="btn-ghost px-2 py-1 text-xs">추가</button>
              </ActionForm>
            )}
            {childKind === 'SHELF' && (
              <form action={addShelves.bind(null, n.id)} className="ml-4 flex items-center gap-2 pl-3 text-sm">
                <span className="text-xs text-muted">+ 칸</span>
                <input name="count" type="number" min={1} max={20} defaultValue={5} className="input w-20 py-1" />
                <button className="btn-ghost px-2 py-1 text-xs">개 추가</button>
              </form>
            )}
          </li>
        )
      })}
    </ul>
  )
}
