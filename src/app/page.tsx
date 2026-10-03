import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CONTACT_EMAIL, GoogleSignInButton, PublicHeader, SERVICE_NAME, SiteFooter } from '@/components/SiteChrome'
import { prisma } from '@/lib/db'
import { isGoogleConfigured } from '@/lib/google-oidc'
import { getSession } from '@/server/auth'

export const dynamic = 'force-dynamic'

/** 로그인 전 메인(랜딩). 로그인 상태면 첫 화면인 취향 대시보드로 보낸다. */
export default async function LandingPage() {
  const session = await getSession()
  if (session && (await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }))) redirect('/dashboard')

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">
        {/* 히어로 */}
        <section className="border-b border-line bg-gradient-to-b from-brand-soft/70 to-paper">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
            <div className="space-y-6">
              <p className="chip bg-white text-brand ring-1 ring-brand/20">가족 독서 플랫폼 · 지금은 모든 기능 무료</p>
              <h1 className="text-4xl leading-tight font-bold tracking-tight md:text-5xl">
                우리 집 책장을
                <br />
                가족의 <span className="text-brand">도서관</span>으로
              </h1>
              <p className="max-w-xl text-lg text-muted">
                집에 있는 책이 어디 꽂혀 있는지, 누가 읽었고 무엇을 느꼈는지, 다음엔 무엇을 읽으면 좋을지 — 가족이 함께 기록하고, 동네 이웃과 책을
                나눕니다.
              </p>
              <div className="flex max-w-sm flex-col gap-3">
                {isGoogleConfigured() ? (
                  <GoogleSignInButton label="구글 계정으로 무료로 시작하기" />
                ) : (
                  <Link href="/login" className="btn-primary py-3 text-base">시작하기</Link>
                )}
                <p className="text-xs text-muted">회원가입 절차 없이 구글 계정으로 바로 시작합니다.</p>
              </div>
            </div>
            <ShelfIllustration />
          </div>
        </section>

        {/* 취지 */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="md:col-span-1">
              <p className="text-sm font-semibold text-brand">왜 만들었나요</p>
              <h2 className="mt-1 text-2xl font-bold">책은 많은데, 찾을 수도 기억할 수도 없어서</h2>
            </div>
            <div className="space-y-4 text-muted md:col-span-2">
              <p>
                아이 그림책, 부모의 업무 서적, 언젠가 읽겠다고 산 소설까지 — 집집마다 수백 권의 책이 있지만 &ldquo;그 책 어디 있지?&rdquo;,
                &ldquo;우리 집에 이 책 있었나?&rdquo;를 매번 반복합니다. 같은 책을 또 사기도 하고, 아이가 몇 번이나 읽어 달라고 했는지도 잊습니다.
              </p>
              <p>
                {SERVICE_NAME}은 집의 책장을 하나의 작은 도서관처럼 관리하고, 가족 각자의 독서 기록을 모아 <b className="text-ink">우리 가족의 취향</b>을
                보여 줍니다. 그리고 같은 동네 이웃과 서로의 책을 빌려 읽으며, 책이 책장에서 잠들지 않게 합니다.
              </p>
            </div>
          </div>
        </section>

        {/* 사용 방법 */}
        <section id="how" className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <p className="text-sm font-semibold text-brand">사용 방법</p>
            <h2 className="mt-1 text-2xl font-bold">세 단계면 충분합니다</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                ['서재 만들기', '구글 계정으로 로그인하고 우리 집 서재를 만듭니다. 거실·서재·아이방처럼 공간과 책장, 칸을 정해 둡니다.'],
                ['책 등록하기', '휴대폰으로 바코드를 찍거나 제목으로 검색해 등록합니다. 책장 한 칸을 사진으로 찍어 여러 권을 한 번에 등록할 수도 있습니다.'],
                ['가족·이웃 초대하기', '초대 링크를 카카오톡으로 보내면 가족은 구글 로그인 한 번으로 합류합니다. 동네 이웃은 대여 가능한 책만 보도록 따로 초대합니다.'],
              ].map(([title, body], i) => (
                <li key={title} className="card space-y-2 p-6">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white">{i + 1}</span>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 기능 */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-sm font-semibold text-brand">주요 기능</p>
          <h2 className="mt-1 text-2xl font-bold">가족 모두를 위한 서재</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['📊', '취향 대시보드', '분야별 장서와 완독, 월별 독서량, 좋아하는 저자, 사 놓고 안 읽은 책 비율까지 — 가족 전체와 구성원별로 봅니다.'],
              ['📚', '표지로 보는 서가', '칸마다 책 표지가 실제 책장처럼 늘어섭니다. 어느 칸에 무슨 책이 있는지 한눈에 찾습니다.'],
              ['🔎', '내용으로 찾기', '제목·저자·메모·독후감은 물론, "공룡이 나오는 그림책"처럼 내용으로 검색하면 우리 서재에 있는 관련 책을 찾아 줍니다.'],
              ['✍️', '읽기 기록·독후감', '읽는 중·완독·별점·인용구를 남기고, 아이 책은 "한 번 더 읽어 줬어요" 한 번이면 기록됩니다.'],
              ['🎁', '사기 전에, 이 책부터', '집에 있는데 아직 안 읽은 책을 먼저 권하고, 취향과 도서관 대출 데이터로 다음 책을 추천합니다.'],
              ['🏘️', '동네 공유 서가', '이웃 가족이 공개한 책을 둘러보고 빌려 달라고 요청합니다. 우리 동네 도서관 정보도 함께 봅니다.'],
            ].map(([icon, title, body]) => (
              <div key={title} className="card space-y-2 p-5">
                <p className="text-2xl">{icon}</p>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 가족 vs 동네 */}
        <section id="neighbors" className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <p className="text-sm font-semibold text-brand">가족과 이웃</p>
            <h2 className="mt-1 text-2xl font-bold">함께 쓰되, 보이는 것은 다르게</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="py-2 pr-4 font-medium">할 수 있는 일</th>
                    <th className="py-2 pr-4 font-medium">가족(소유자·관리자·구성원·아이)</th>
                    <th className="py-2 font-medium">동네 이웃</th>
                  </tr>
                </thead>
                <tbody className="[&_td]:py-2 [&_td]:pr-4 [&_tr]:border-b [&_tr]:border-line">
                  <tr><td>책 목록·표지 보기</td><td>전체</td><td>&lsquo;대여 가능&rsquo;으로 공개한 책만</td></tr>
                  <tr><td>책이 꽂힌 위치</td><td>✔</td><td>—</td></tr>
                  <tr><td>읽기 기록·독후감</td><td>본인 기록 작성, 가족 기록 열람</td><td>—</td></tr>
                  <tr><td>책 등록·위치 이동</td><td>구성원 이상</td><td>—</td></tr>
                  <tr><td>가족 초대·서가 설정</td><td>관리자 이상</td><td>—</td></tr>
                  <tr><td>책 빌려 달라고 요청</td><td>✔(다른 가구의 책)</td><td>✔</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-2xl font-bold">자주 묻는 질문</h2>
          <div className="mt-6 space-y-3">
            {[
              ['정말 무료인가요?', '네. 지금은 모든 기능이 무료입니다. 앞으로 유료 기능이 생기더라도 지금 쓰는 기본 기능(책 관리·기록·가족 초대)은 무료로 유지하는 것을 원칙으로 합니다.'],
              ['아이는 구글 계정이 없는데요?', '아이는 ‘계정 없는 구성원’으로 등록하고, 부모가 대신 기록할 수 있습니다. 나중에 아이 계정이 생기면 초대 링크로 그 프로필에 연결됩니다.'],
              ['이웃이 우리 집 기록을 볼 수 있나요?', '아니요. 이웃은 ‘대여 가능’으로 둔 책의 표지·제목·가구 이름만 봅니다. 위치·읽기 기록·독후감·가족 정보는 보이지 않습니다.'],
              ['어떤 개인정보를 가져가나요?', '구글 계정의 이름·이메일·프로필 사진만 받습니다. 비밀번호는 받지 않습니다. 자세한 내용은 개인정보처리방침을 확인해 주세요.'],
              ['데이터를 내려받을 수 있나요?', '서재 설정에서 장서 목록을 CSV(엑셀)로 언제든 내려받을 수 있습니다.'],
            ].map(([q, a]) => (
              <details key={q} className="card group p-4">
                <summary className="cursor-pointer list-none font-medium">
                  <span className="mr-2 text-brand group-open:rotate-90">›</span>
                  {q}
                </summary>
                <p className="mt-2 text-sm text-muted">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted">
            그 밖의 문의는 <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>로 보내 주세요.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

/** 히어로 오른쪽: CSS로 그린 책장(외부 이미지 없이). */
function ShelfIllustration() {
  const colors = ['#2f5d50', '#b5651d', '#4b5d8a', '#8a5a44', '#e8a33d', '#5e4b7a', '#2f6a7a', '#e07a9a', '#7a6a2f', '#5aa0d8']
  const heights = [88, 72, 96, 80, 70, 92, 84, 76, 90, 74]
  return (
    <div className="mx-auto w-full max-w-md" aria-hidden>
      <div className="rounded-2xl border-[10px] border-[#8b6b4a] bg-[#f3ead9] p-4 shadow-xl">
        {[0, 1, 2].map((row) => (
          <div key={row} className="mb-4 flex h-28 items-end gap-1 border-b-[6px] border-[#8b6b4a] last:mb-0">
            {colors.map((c, i) => {
              const idx = (i + row * 3) % colors.length
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm shadow-sm"
                  style={{ background: colors[idx], height: `${heights[(i + row * 4) % heights.length]}%`, opacity: 0.92 }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
