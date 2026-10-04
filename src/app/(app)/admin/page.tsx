import ActionForm from '@/components/ActionForm'
import ConfirmButton from '@/components/ConfirmButton'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/format'
import { isMonetizationEnabled } from '@/lib/plans'
import { isPublicDataConfigured } from '@/lib/public-data'
import { deleteSponsor, saveSponsor, toggleSponsor } from '@/server/actions/admin'
import { requirePlatformAdmin } from '@/server/auth'

const DAY = 86400_000

/**
 * 플랫폼 관리(PLATFORM_ADMIN_EMAILS). 수익화 시점을 판단하기 위한 가입·활성 지표와 후원 배너 관리.
 * 개인을 식별하는 정보는 보여 주지 않고 집계만 보여 준다.
 */
export default async function AdminPage() {
  await requirePlatformAdmin()
  return <AdminView {...await loadMetrics()} />
}

/** 렌더 밖에서 현재 시각 기준 집계를 만든다(렌더 순수성 규칙). */
async function loadMetrics() {
  const now = Date.now()
  const since = (days: number) => new Date(now - days * DAY)
  const [users, users7, users30, active7, active30, households, neighborhoods, books, copies, done, notes, loanReqs, loansApproved, invites, invitesUsed, recentUsers, slots, hoods] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: since(7) } } }),
      prisma.user.count({ where: { createdAt: { gte: since(30) } } }),
      prisma.user.count({ where: { lastLoginAt: { gte: since(7) } } }),
      prisma.user.count({ where: { lastLoginAt: { gte: since(30) } } }),
      prisma.household.count(),
      prisma.neighborhood.count(),
      prisma.book.count(),
      prisma.copy.count(),
      prisma.reading.count({ where: { status: 'DONE' } }),
      prisma.note.count(),
      prisma.loanRequest.count(),
      prisma.loanRequest.count({ where: { status: { in: ['APPROVED', 'RETURNED'] } } }),
      prisma.invite.count(),
      prisma.invite.count({ where: { usedCount: { gt: 0 } } }),
      prisma.user.findMany({ where: { createdAt: { gte: since(84) } }, select: { createdAt: true } }),
      prisma.sponsorSlot.findMany({ orderBy: { createdAt: 'desc' }, include: { neighborhood: { select: { name: true } } } }),
      prisma.neighborhood.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ])

  // 최근 12주 주간 신규 가입
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const end = now - (11 - i) * 7 * DAY
    const start = end - 7 * DAY
    return { label: formatDate(new Date(start)).slice(5), n: recentUsers.filter((u) => u.createdAt.getTime() >= start && u.createdAt.getTime() < end).length }
  })
  const maxWeek = Math.max(1, ...weeks.map((w) => w.n))
  return { users, users7, users30, active7, active30, households, neighborhoods, books, copies, done, notes, loanReqs, loansApproved, invites, invitesUsed, slots, hoods, weeks, maxWeek }
}

function AdminView(m: Awaited<ReturnType<typeof loadMetrics>>) {
  const { users, users7, users30, active7, active30, households, neighborhoods, books, copies, done, notes, loanReqs, loansApproved, invites, invitesUsed, slots, hoods, weeks, maxWeek } = m
  const conf = isPublicDataConfigured()

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">플랫폼 관리</h1>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="가입자" value={users} sub={`최근 7일 +${users7} · 30일 +${users30}`} />
        <Tile label="활성 사용자(7일/30일)" value={`${active7} / ${active30}`} sub={users ? `30일 활성률 ${Math.round((active30 / users) * 100)}%` : ''} />
        <Tile label="서재 / 동네" value={`${households} / ${neighborhoods}`} />
        <Tile label="장서(서지/소장본)" value={`${books} / ${copies}`} />
        <Tile label="완독 기록" value={done} />
        <Tile label="독후감·메모" value={notes} />
        <Tile label="대여 요청(성사)" value={`${loanReqs} (${loansApproved})`} />
        <Tile label="초대(사용됨)" value={`${invites} (${invitesUsed})`} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">주간 신규 가입(최근 12주)</h2>
        <div className="flex h-32 items-end gap-1">
          {weeks.map((w) => (
            <div key={w.label} className="flex flex-1 flex-col items-center gap-1" title={`${w.label} 주: ${w.n}명`}>
              <span className="text-[10px] text-muted">{w.n || ''}</span>
              <div className="w-full rounded-t bg-brand" style={{ height: `${(w.n / maxWeek) * 90}px`, minHeight: w.n ? 4 : 1, opacity: w.n ? 1 : 0.2 }} />
              <span className="text-[10px] text-muted">{w.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          수익화: {isMonetizationEnabled() ? '켜짐(MONETIZATION_ENABLED=1)' : '꺼짐 — 모든 기능 무료'}. 판단 기준과 후보는 docs/monetization.md 참고.
        </p>
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">외부 연동 상태</h2>
        <ul className="grid gap-1 sm:grid-cols-2">
          <Status ok={Boolean(process.env.GOOGLE_CLIENT_ID)} label="구글 로그인(GOOGLE_CLIENT_ID)" />
          <Status ok={process.env.ENABLE_DEV_LOGIN !== '1'} label="테스트 로그인 꺼짐(운영 필수)" />
          <Status ok={conf.dataGoKr} label="공공데이터포털(DATA_GO_KR_SERVICE_KEY)" />
          <Status ok={conf.data4library} label="도서관 정보나루(DATA4LIBRARY_API_KEY)" />
          <Status ok={conf.nl} label="국립중앙도서관(NL_OPEN_API_KEY)" />
          <Status ok={Boolean(process.env.KAKAO_REST_API_KEY)} label="카카오 책 검색" />
          <Status ok={Boolean(process.env.GOOGLE_BOOKS_API_KEY)} label="Google Books(내용 검색)" />
          <Status ok={Boolean(process.env.ANTHROPIC_API_KEY)} label="Claude(사진 판독·추천·내용 검색 보조)" />
          <Status ok={Boolean(process.env.ALADIN_TTB_KEY)} label="알라딘 TTB(제휴 링크)" />
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">후원·동네 책방 배너</h2>
        <p className="text-xs text-muted">대시보드와 동네 화면 하단에 &lsquo;후원 · 광고&rsquo; 표시와 함께 하나씩 노출됩니다(동네 전용 → 전체 공용 순).</p>
        <ActionForm action={saveSponsor} className="grid gap-2 sm:grid-cols-2" resetOnSuccess>
          <input name="title" placeholder="제목(예: 정자동 ○○책방 가을 그림책 할인)" className="input sm:col-span-2" required maxLength={60} />
          <input name="body" placeholder="설명(선택)" className="input sm:col-span-2" maxLength={200} />
          <input name="linkUrl" placeholder="링크 https://…" className="input" />
          <input name="imageUrl" placeholder="이미지 https://…(선택)" className="input" />
          <select name="neighborhoodId" className="input" defaultValue="">
            <option value="">전체 공용</option>
            {hoods.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input name="startsAt" type="date" className="input" title="시작일" />
            <input name="endsAt" type="date" className="input" title="종료일" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked /> 바로 노출
          </label>
          <div>
            <button className="btn-primary">등록</button>
          </div>
        </ActionForm>
        {slots.length > 0 && (
          <ul className="space-y-2 border-t border-line pt-3 text-sm">
            {slots.map((sl) => (
              <li key={sl.id} className="flex flex-wrap items-center gap-2">
                <span className={`chip ${sl.active ? 'bg-brand-soft text-brand' : 'bg-paper text-muted'}`}>{sl.active ? '노출' : '중지'}</span>
                <span className="font-medium">{sl.title}</span>
                <span className="text-xs text-muted">
                  {sl.neighborhood?.name ?? '전체'} · {sl.startsAt ? formatDate(sl.startsAt) : '즉시'}~{sl.endsAt ? formatDate(sl.endsAt) : '계속'}
                </span>
                <ConfirmButton action={toggleSponsor.bind(null, sl.id)} confirm={sl.active ? '노출을 멈출까요?' : '다시 노출할까요?'} className="text-xs underline">
                  {sl.active ? '중지' : '노출'}
                </ConfirmButton>
                <ConfirmButton action={deleteSponsor.bind(null, sl.id)} confirm="배너를 지울까요?" className="text-xs text-red-700 underline">
                  삭제
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  )
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-brand' : 'bg-line'}`} />
      <span className={ok ? '' : 'text-muted'}>{label}</span>
    </li>
  )
}
