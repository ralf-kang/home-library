import ActionForm from '@/components/ActionForm'
import ConfirmButton from '@/components/ConfirmButton'
import { prisma } from '@/lib/db'
import { LOCATION_KIND_LABEL } from '@/lib/format'
import type { LocationNode } from '@/lib/location'
import { addShelves, deleteLocation, deleteMember, deleteZone, saveLocation, saveMember, saveZone } from '@/server/actions/settings'
import { requireAdmin } from '@/server/auth'
import { listMembers, loadLocations, type LocationIndex } from '@/server/queries'

export default async function SettingsPage() {
  const me = await requireAdmin()
  const [members, zones, loc] = await Promise.all([
    listMembers(),
    prisma.zone.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    loadLocations(),
  ])
  const counts = new Map(
    (await prisma.copy.groupBy({ by: ['locationId'], _count: { _all: true } })).map((r) => [r.locationId, r._count._all]),
  )

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">설정</h1>

      <section className="card space-y-3" id="members">
        <h2 className="font-semibold">가족 구성원</h2>
        <p className="text-xs text-muted">로그인은 구성원 선택 + 가족 공용 PIN(서버 FAMILY_PIN). 관리자만 책 등록·위치 변경·설정을 할 수 있습니다.</p>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id}>
              <ActionForm action={saveMember} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={m.id} />
                <input name="name" defaultValue={m.name} className="input max-w-[10rem]" required />
                <select name="role" defaultValue={m.role} className="input max-w-[7rem]">
                  <option value="ADULT">어른</option>
                  <option value="CHILD">어린이</option>
                </select>
                <input name="sortOrder" type="number" defaultValue={m.sortOrder} className="input max-w-[5rem]" title="표시 순서" />
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="isAdmin" defaultChecked={m.isAdmin} /> 관리자
                </label>
                <button className="btn-ghost">저장</button>
                {m.id !== me.id && (
                  <ConfirmButton action={deleteMember.bind(null, m.id)} confirm={`${m.name}님을 지우면 읽기 기록·독후감도 함께 지워집니다. 계속할까요?`}>
                    삭제
                  </ConfirmButton>
                )}
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={saveMember} className="flex flex-wrap items-center gap-2 border-t border-line pt-3" resetOnSuccess>
          <input name="name" placeholder="새 구성원 이름" className="input max-w-[10rem]" required />
          <select name="role" className="input max-w-[7rem]" defaultValue="ADULT">
            <option value="ADULT">어른</option>
            <option value="CHILD">어린이</option>
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="isAdmin" /> 관리자
          </label>
          <button className="btn-primary">추가</button>
        </ActionForm>
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
