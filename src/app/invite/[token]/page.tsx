import ActionForm from '@/components/ActionForm'
import { GoogleSignInButton, PublicHeader, SiteFooter } from '@/components/SiteChrome'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/format'
import { inviteProblem } from '@/lib/invite'
import { ROLE_LABEL } from '@/lib/permissions'
import { acceptInvite } from '@/server/actions/household'
import { getSession } from '@/server/auth'
import { findInviteByToken } from '@/server/households'
import { isDevLoginEnabled } from '@/server/login'

export const dynamic = 'force-dynamic'

/**
 * 초대 링크. 로그인 전이면 초대 내용과 구글 로그인 버튼(로그인 후 이 페이지로 돌아옴),
 * 로그인했으면 '참여하기'. 가족 초대와 동네 초대의 차이(볼 수 있는 것)를 분명히 보여 준다.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const inv = await findInviteByToken(token)
  const session = await getSession()
  const user = session ? await prisma.user.findUnique({ where: { id: session.userId } }) : null

  const problem = !inv ? '없는 초대이거나 링크가 잘렸습니다. 받은 링크 전체를 다시 확인해 주세요.' : inviteProblem(inv, user?.email ?? null)
  // 로그인 전에는 이메일 지정 여부만으로 막지 않는다(로그인 후 다시 확인)
  const blocking = !inv || (problem && (user || !problem.includes('계정 전용')))
  const myAdminHouseholds =
    user && inv?.kind === 'NEIGHBOR'
      ? await prisma.member.findMany({
          where: { userId: user.id, role: { in: ['OWNER', 'ADMIN'] }, household: { neighborhoodId: null } },
          include: { household: true },
        })
      : []
  const next = `/invite/${token}`

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-10">
        {inv && (
          <div className="text-center">
            <p className="text-sm text-muted">{inv.createdBy.name}님이 초대했습니다</p>
            <h1 className="mt-1 text-2xl font-bold">
              {inv.kind === 'FAMILY' ? `${inv.household?.name} 가족으로 초대` : `${inv.neighborhood?.name} 동네 이웃으로 초대`}
            </h1>
          </div>
        )}

        {inv && (
          <section className="card space-y-2 text-sm">
            {inv.kind === 'FAMILY' ? (
              <>
                <p>
                  역할: <b>{inv.role ? ROLE_LABEL[inv.role] : '구성원'}</b>
                  {inv.memberName && ` · ${inv.memberName}(으)로 참여`}
                </p>
                <ul className="list-disc space-y-1 pl-5 text-muted">
                  <li>이 서재의 모든 책과 위치를 보고, 내 읽기 기록·독후감을 남깁니다.</li>
                  <li>가족의 읽기 기록·독후감을 함께 볼 수 있습니다.</li>
                  {inv.role !== 'CHILD' && <li>책 등록·위치 이동을 할 수 있습니다.</li>}
                </ul>
              </>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-muted">
                <li>동네 이웃 가구들이 &lsquo;대여 가능&rsquo;으로 공개한 책(표지·제목·가구 이름)을 볼 수 있습니다.</li>
                <li>책을 빌려 달라고 요청할 수 있습니다. 승인은 책 주인 가족이 합니다.</li>
                <li>이웃 가족의 위치·읽기 기록·독후감·구성원 정보는 볼 수 없습니다.</li>
              </ul>
            )}
            <p className="text-xs text-muted">
              {formatDate(inv.expiresAt)}까지 유효 · {inv.usedCount}/{inv.maxUses}회 사용
            </p>
          </section>
        )}

        {problem && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{problem}</p>}

        {!blocking && inv && !user && (
          <section className="card space-y-3">
            <p className="text-sm">구글 계정으로 로그인하면 바로 참여합니다. 회원가입은 필요 없습니다.</p>
            <GoogleSignInButton next={next} label="구글 계정으로 참여하기" />
            {isDevLoginEnabled() && (
              <a href={`/login?next=${encodeURIComponent(next)}`} className="block text-center text-xs text-muted underline">
                테스트 로그인으로 참여
              </a>
            )}
          </section>
        )}

        {!problem && inv && user && (
          <ActionForm action={acceptInvite.bind(null, token)} className="card space-y-3">
            <p className="text-sm">
              <b>{user.name}</b>({user.email}) 계정으로 참여합니다.
            </p>
            {inv.kind === 'NEIGHBOR' && myAdminHouseholds.length > 0 && (
              <div className="space-y-1 rounded-lg bg-paper p-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="shareHousehold" /> 우리 서재의 &lsquo;대여 가능&rsquo; 책도 이 동네에 공유하기
                </label>
                <select name="householdId" className="input" defaultValue={myAdminHouseholds[0].householdId}>
                  {myAdminHouseholds.map((m) => (
                    <option key={m.householdId} value={m.householdId}>
                      {m.household.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted">위치·기록은 공유되지 않습니다. 책마다 &lsquo;대여 가능&rsquo;을 끄면 공개되지 않습니다.</p>
              </div>
            )}
            <button className="btn-primary w-full">참여하기</button>
          </ActionForm>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
