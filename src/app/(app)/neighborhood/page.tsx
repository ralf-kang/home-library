import Link from 'next/link'
import ActionForm from '@/components/ActionForm'
import { EmptyState, Photo } from '@/components/Art'
import BookCover from '@/components/BookCover'
import ConfirmButton from '@/components/ConfirmButton'
import NearbyLibraries from '@/components/NearbyLibraries'
import SponsorBanner from '@/components/SponsorBanner'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/format'
import { can } from '@/lib/permissions'
import {
  cancelLoanRequest,
  createNeighborInvite,
  createNeighborhood,
  decideLoanRequest,
  leaveNeighborhood,
  markReturned,
  requestLoan,
  setHouseholdSharing,
} from '@/server/actions/neighborhood'
import { currentMembership } from '@/server/auth'
import { accessibleNeighborhoods, canAccessNeighborhood, isOrganizer, neighborhoodSummary, sharedShelf } from '@/server/neighborhood'

const REQ_LABEL = { REQUESTED: '승인 대기', APPROVED: '대여 중', REJECTED: '거절됨', RETURNED: '반납 완료', CANCELED: '취소함' } as const

/**
 * 동네: 이웃 가구들이 '대여 가능'으로 둔 책을 함께 보는 공유 서가 + 대여 요청.
 * 동네 주민(가구 없음)도 들어오므로 currentMembership() 으로 가구가 없을 수도 있음을 전제로 그린다.
 */
export default async function NeighborhoodPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string; q?: string; page?: string; created?: string; joined?: string }>
}) {
  const { user, member, household } = await currentMembership()
  const sp = await searchParams
  const list = await accessibleNeighborhoods(user.id)
  const selectedId = sp.n && list.some((x) => x.id === sp.n) ? sp.n : (household?.neighborhoodId ?? list[0]?.id)

  // 우리 서재로 들어온 요청(승인 권한이 있을 때) — 동네를 고르지 않아도 보여 준다
  const incoming =
    member && household && can(member.role, 'loan.approve')
      ? await prisma.loanRequest.findMany({
          where: { status: { in: ['REQUESTED', 'APPROVED'] }, copy: { book: { householdId: household.id } } },
          include: { requester: { select: { name: true, email: true } }, copy: { include: { book: { select: { title: true, coverUrl: true } } } }, loan: true },
          orderBy: { createdAt: 'desc' },
        })
      : []
  const mine = await prisma.loanRequest.findMany({
    where: { requesterUserId: user.id },
    include: { copy: { select: { book: { select: { title: true, coverUrl: true, household: { select: { name: true } } } } } }, loan: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  if (!selectedId) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <h1 className="text-xl font-bold">동네</h1>
        <p className="text-muted">
          같은 동네 가족들이 서로의 책을 빌려 읽는 공유 서가입니다. 이웃에게는 &lsquo;대여 가능&rsquo;으로 둔 책의 표지·제목·서재 이름만 보이고, 위치·읽기
          기록·독후감은 보이지 않습니다.
        </p>
        <Photo name="neighbors" sizes="(max-width: 767px) calc(100vw - 32px), 480px" className="aspect-[3/2] max-w-[480px] rounded-[20px]" />
        <section className="card space-y-3">
          <h2 className="font-semibold">동네 만들기</h2>
          <ActionForm action={createNeighborhood} className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="label">동네 이름</label>
              <input name="name" placeholder="예: 정자동 책나눔" className="input" required maxLength={40} />
            </div>
            <div>
              <label className="label">지역(선택)</label>
              <input name="regionName" placeholder="예: 경기도 성남시 분당구 정자동" className="input" defaultValue={household?.regionName ?? ''} />
            </div>
            {member && can(member.role, 'household.manage') && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" name="shareHousehold" defaultChecked /> {household!.name}의 대여 가능 책을 이 동네에 공유
              </label>
            )}
            <div className="sm:col-span-2">
              <button className="btn-primary">만들기</button>
            </div>
          </ActionForm>
          <p className="text-xs text-muted">만든 사람이 동네 운영자가 되어 이웃 초대 링크를 만들 수 있습니다. 이웃의 초대 링크를 받았다면 그 링크를 열어 주세요.</p>
        </section>
        <MyRequests mine={mine} />
        <Incoming incoming={incoming} />
      </div>
    )
  }

  if (!(await canAccessNeighborhood(user.id, selectedId))) return <p className="card">참여하지 않은 동네입니다.</p>
  const page = Number(sp.page) || 1
  const q = sp.q?.trim() || undefined
  const [summary, shelf, organizer, invites] = await Promise.all([
    neighborhoodSummary(selectedId),
    sharedShelf(selectedId, q, page),
    isOrganizer(user.id, selectedId),
    prisma.invite.findMany({
      where: { neighborhoodId: selectedId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  if (!summary) return null
  const requested = new Set(mine.filter((r) => r.status === 'REQUESTED' || r.status === 'APPROVED').map((r) => r.copyId))
  const canShare = member && household && can(member.role, 'household.manage')
  const sharing = household?.neighborhoodId === selectedId

  return (
    <div className="space-y-5">
      {sp.created && <p className="rounded-lg bg-brand-soft p-3 text-sm text-brand">동네를 만들었습니다. 아래에서 이웃 초대 링크를 만들어 보내세요.</p>}
      {sp.joined && <p className="rounded-lg bg-brand-soft p-3 text-sm text-brand">{summary.name}에 참여했습니다.</p>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {list.length > 1 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {list.map((x) => (
                <Link key={x.id} href={`/neighborhood?n=${x.id}`} className={`chip px-3 py-1 ${x.id === selectedId ? 'bg-brand text-white' : 'bg-white ring-1 ring-line'}`}>
                  {x.name}
                </Link>
              ))}
            </div>
          )}
          <h1 className="text-xl font-bold">{summary.name}</h1>
          <p className="text-sm text-muted">
            {summary.regionName && `${summary.regionName} · `}참여 서재 {summary.households.length}곳 · 이웃 {summary.residents}명 · 공유 책 {shelf.total}권
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canShare && (
            sharing ? (
              <ConfirmButton action={setHouseholdSharing.bind(null, selectedId, false)} confirm="우리 서재 책을 이 동네에서 내릴까요?" className="btn-ghost">
                우리 서재 공유 중 · 멈추기
              </ConfirmButton>
            ) : (
              !household!.neighborhoodId && (
                <ConfirmButton action={setHouseholdSharing.bind(null, selectedId, true)} confirm={`${household!.name}의 '대여 가능' 책(표지·제목)을 이 동네에 공개할까요? 위치·기록은 공개되지 않습니다.`} className="btn-primary">
                  우리 서재도 공유하기
                </ConfirmButton>
              )
            )
          )}
          {!organizer && (
            <ConfirmButton action={leaveNeighborhood.bind(null, selectedId)} confirm="이 동네에서 나갈까요?" className="btn-ghost text-muted">
              나가기
            </ConfirmButton>
          )}
        </div>
      </div>

      <Incoming incoming={incoming} />

      <section className="space-y-3">
        <form className="flex gap-2" action="/neighborhood">
          <input type="hidden" name="n" value={selectedId} />
          <input name="q" defaultValue={q} placeholder="이웃 서가에서 제목·저자 찾기" className="input" />
          <button className="btn-primary shrink-0">찾기</button>
        </form>
        {shelf.copies.length === 0 ? (
          q ? (
            <EmptyState art="searchEmpty" title="이웃 서가에서 찾는 책이 없어요" action={{ href: `/neighborhood?n=${selectedId}`, label: '전체 보기' }} />
          ) : (
            <p className="card text-sm text-muted">
              아직 공유된 책이 없습니다. 서재마다 책 상세 화면의 &lsquo;대여 가능&rsquo;이 켜진 책만 여기에 보입니다.
            </p>
          )
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
            {shelf.copies.map((c) => {
              const own = c.book.householdId === household?.id
              const title = `${c.book.title}${c.book.volumeNo != null ? ` ${c.book.volumeNo}권` : ''}`
              return (
                <li key={c.id} className="min-w-0 space-y-1">
                  <div className={c.status !== 'ON_SHELF' ? 'opacity-50' : ''}>
                    <BookCover title={title} coverUrl={c.book.coverUrl} size="fill" />
                  </div>
                  <p className="line-clamp-2 text-xs font-medium">{title}</p>
                  <p className="truncate text-[11px] text-muted">{c.book.household.name}</p>
                  {own ? (
                    <span className="chip bg-paper text-[10px] text-muted">우리 서재</span>
                  ) : requested.has(c.id) ? (
                    <span className="chip bg-brand-soft text-[10px] text-brand">요청함</span>
                  ) : c.status !== 'ON_SHELF' ? (
                    <span className="chip bg-paper text-[10px] text-muted">대여 중</span>
                  ) : (
                    <ActionForm action={requestLoan.bind(null, c.id)}>
                      <button className="btn-ghost w-full px-2 py-1 text-xs">빌려 주세요</button>
                    </ActionForm>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {shelf.pageCount > 1 && (
          <div className="flex justify-center gap-3 text-sm">
            {page > 1 && <Link className="btn-ghost" href={`/neighborhood?n=${selectedId}&page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}>이전</Link>}
            <span className="text-muted">{page} / {shelf.pageCount}</span>
            {page < shelf.pageCount && <Link className="btn-ghost" href={`/neighborhood?n=${selectedId}&page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}>다음</Link>}
          </div>
        )}
      </section>

      <MyRequests mine={mine} />

      <NearbyLibraries regionName={summary.regionName ?? household?.regionName ?? null} />

      {organizer && (
        <section className="card space-y-3">
          <h2 className="font-semibold">이웃 초대(동네 운영자)</h2>
          <p className="text-xs text-muted">
            이웃은 공유 서가 열람과 대여 요청만 할 수 있습니다. 가족처럼 서재 전체를 함께 쓰려면 서재 설정의 &lsquo;가족 초대&rsquo;를 쓰세요.
          </p>
          <ActionForm action={createNeighborInvite.bind(null, selectedId)} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
            <input name="email" type="email" placeholder="받을 구글 이메일(선택)" className="input" />
            <input name="maxUses" type="number" min={1} max={20} defaultValue={10} className="input" title="사용 횟수" />
            <button className="btn-primary">초대 링크 만들기</button>
          </ActionForm>
          {invites.length > 0 && (
            <p className="text-xs text-muted">
              유효한 초대 {invites.length}개 · {invites.map((i) => `${i.usedCount}/${i.maxUses}회(${formatDate(i.expiresAt)}까지)`).join(', ')}
            </p>
          )}
        </section>
      )}

      <SponsorBanner neighborhoodId={selectedId} />
    </div>
  )
}

type MineRow = {
  id: string
  status: keyof typeof REQ_LABEL
  createdAt: Date
  copy: { book: { title: string; coverUrl: string | null; household: { name: string } } }
  loan: { dueAt: Date | null } | null
}

function MyRequests({ mine }: { mine: MineRow[] }) {
  if (mine.length === 0) return null
  return (
    <section className="card space-y-2">
      <h2 className="font-semibold">내가 빌려 달라고 한 책</h2>
      <ul className="space-y-2 text-sm">
        {mine.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <BookCover title={r.copy.book.title} coverUrl={r.copy.book.coverUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.copy.book.title}</p>
              <p className="text-xs text-muted">
                {r.copy.book.household.name} · {formatDate(r.createdAt)} 요청
                {r.status === 'APPROVED' && r.loan?.dueAt && ` · ${formatDate(r.loan.dueAt)}까지`}
              </p>
            </div>
            <span className="chip bg-paper ring-1 ring-line">{REQ_LABEL[r.status]}</span>
            {r.status === 'REQUESTED' && (
              <ConfirmButton action={cancelLoanRequest.bind(null, r.id)} confirm="요청을 취소할까요?" className="text-xs text-muted underline">
                취소
              </ConfirmButton>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

type IncomingRow = {
  id: string
  status: keyof typeof REQ_LABEL
  message: string | null
  createdAt: Date
  requester: { name: string; email: string }
  copy: { book: { title: string; coverUrl: string | null } }
  loan: { dueAt: Date | null } | null
}

function Incoming({ incoming }: { incoming: IncomingRow[] }) {
  if (incoming.length === 0) return null
  return (
    <section className="card space-y-2 border-accent/40">
      <h2 className="font-semibold">우리 서재로 온 대여 요청</h2>
      <ul className="space-y-3 text-sm">
        {incoming.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3">
            <BookCover title={r.copy.book.title} coverUrl={r.copy.book.coverUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.copy.book.title}</p>
              <p className="text-xs text-muted">
                {r.requester.name}({r.requester.email}) · {formatDate(r.createdAt)}
                {r.status === 'APPROVED' && r.loan?.dueAt && ` · 반납 예정 ${formatDate(r.loan.dueAt)}`}
              </p>
              {r.message && <p className="text-xs">&ldquo;{r.message}&rdquo;</p>}
            </div>
            {r.status === 'REQUESTED' ? (
              <div className="flex gap-2">
                <ConfirmButton action={decideLoanRequest.bind(null, r.id, true)} confirm={`${r.requester.name}님께 빌려 드릴까요?`} className="btn-primary">
                  승인
                </ConfirmButton>
                <ConfirmButton action={decideLoanRequest.bind(null, r.id, false)} confirm="요청을 거절할까요?" className="btn-ghost">
                  거절
                </ConfirmButton>
              </div>
            ) : (
              <ConfirmButton action={markReturned.bind(null, r.id)} confirm="돌려받았나요?" className="btn-ghost">
                반납 받음
              </ConfirmButton>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
