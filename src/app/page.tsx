import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FeatureIcon, Illustration, Photo, type FeatureIconName, type IllustrationName } from '@/components/Art'
import GuideVideo from '@/components/GuideVideo'
import { CONTACT_EMAIL, GoogleSignInButton, PublicHeader, SERVICE_NAME, SiteFooter } from '@/components/SiteChrome'
import { prisma } from '@/lib/db'
import { isGoogleConfigured } from '@/lib/google-oidc'
import { getSession } from '@/server/auth'

export const dynamic = 'force-dynamic'

const STEPS: { art: IllustrationName; title: string; body: string }[] = [
  { art: 'createLibrary', title: '서재 만들기', body: '구글 계정으로 로그인하고 우리 집 서재를 만듭니다. 거실·서재·아이방처럼 공간과 책장, 칸을 정해 둡니다.' },
  { art: 'scanPoster', title: '책 등록하기', body: '바코드를 찍거나 제목으로 검색해 등록합니다. 책장 한 칸을 사진으로 찍어 여러 권을 한 번에 등록할 수도 있습니다.' },
  { art: 'inviteCircle', title: '가족·이웃 초대하기', body: '초대 링크를 카카오톡으로 보내면 가족은 구글 로그인 한 번으로 합류합니다. 이웃은 대여 가능한 책만 보도록 따로 초대합니다.' },
]

const FEATURES: { icon: FeatureIconName; title: string; body: string }[] = [
  { icon: 'dashboard', title: '취향 대시보드', body: '분야별 장서와 완독, 월별 독서량, 좋아하는 저자, 사 놓고 안 읽은 책 비율까지 가족 전체와 구성원별로 봅니다.' },
  { icon: 'shelves', title: '표지로 보는 서가', body: '칸마다 책 표지가 실제 책장처럼 늘어섭니다. 어느 칸에 무슨 책이 있는지 한눈에 찾습니다.' },
  { icon: 'search', title: '내용으로 찾기', body: '제목을 몰라도 “공룡이 나오는 그림책”처럼 내용으로 검색하면 우리 서재에 있는 관련 책을 찾아 줍니다.' },
  { icon: 'reading', title: '읽기 기록·독후감', body: '읽는 중·완독·별점·인용구를 남기고, 아이 책은 “한 번 더 읽어 줬어요” 한 번이면 기록됩니다.' },
  { icon: 'recommend', title: '사기 전에, 이 책부터', body: '집에 있는데 아직 안 읽은 책을 먼저 권하고, 취향과 도서관 대출 데이터로 다음 책을 추천합니다.' },
  { icon: 'neighborhood', title: '동네 공유 서가', body: '이웃 가족이 공개한 책을 둘러보고 빌려 달라고 요청합니다. 우리 동네 도서관 정보도 함께 봅니다.' },
]

const ROLES: [string, string, string][] = [
  ['책 목록·표지 보기', '전체', '‘대여 가능’으로 공개한 책만'],
  ['책이 꽂힌 위치', '가능', '비공개'],
  ['읽기 기록·독후감', '본인 작성 · 가족 열람', '비공개'],
  ['책 등록·위치 이동', '구성원 이상', '불가'],
  ['가족 초대·서가 설정', '관리자 이상', '불가'],
  ['책 빌려 달라고 요청', '다른 가구의 책', '가능'],
]

const FAQ: [string, string][] = [
  ['정말 무료인가요?', '네. 지금은 모든 기능이 무료입니다. 앞으로 유료 기능이 생기더라도 지금 쓰는 기본 기능(책 관리·기록·가족 초대)은 무료로 유지하는 것을 원칙으로 합니다.'],
  ['아이는 구글 계정이 없는데요?', '아이는 ‘계정 없는 구성원’으로 등록하고, 부모가 대신 기록할 수 있습니다. 나중에 아이 계정이 생기면 초대 링크로 그 프로필에 연결됩니다.'],
  ['이웃이 우리 집 기록을 볼 수 있나요?', '아니요. 이웃은 ‘대여 가능’으로 둔 책의 표지·제목·가구 이름만 봅니다. 위치·읽기 기록·독후감·가족 정보는 보이지 않습니다.'],
  ['어떤 개인정보를 가져가나요?', '구글 계정의 이름·이메일·프로필 사진만 받습니다. 비밀번호는 받지 않습니다. 자세한 내용은 개인정보처리방침을 확인해 주세요.'],
  ['데이터를 내려받을 수 있나요?', '서재 설정에서 장서 목록을 CSV(엑셀)로 언제든 내려받을 수 있습니다.'],
]

/** 로그인 전 메인(랜딩). 로그인 상태면 첫 화면인 취향 대시보드로 보낸다. */
export default async function LandingPage() {
  const session = await getSession()
  if (session && (await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }))) redirect('/dashboard')
  const google = isGoogleConfigured()

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main id="top" className="flex-1">
        {/* 히어로: 텍스트 52% · 사진 48%. 모바일은 제목·설명·CTA 다음에 사진 */}
        <section className="wrap grid items-center gap-8 pt-10 pb-12 md:grid-cols-[1.02fr_0.98fr] md:gap-12 md:pt-20 md:pb-20">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.04em] text-brand before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent">
              가족 독서 플랫폼 · 지금은 모든 기능 무료
            </span>
            <h1 className="my-5 text-[34px] leading-[1.3] font-bold tracking-[-0.05em] md:text-[clamp(34px,4.6vw,54px)] md:leading-[1.28]">
              우리 집 책장을
              <br />
              가족의 <span className="text-brand">도서관</span>으로
            </h1>
            <p className="max-w-[490px] text-[15px] leading-relaxed text-muted md:text-base">
              집에 있는 책이 어디 꽂혀 있는지, 누가 읽었고 무엇을 느꼈는지. 가족이 함께 기록하고, 동네 이웃과 책을 나눕니다.
            </p>
            <div className="mt-7 mb-3 flex max-w-md flex-wrap gap-3">
              {google ? (
                <div className="w-full sm:w-auto sm:min-w-72">
                  <GoogleSignInButton label="구글 계정으로 무료로 시작하기" />
                </div>
              ) : (
                <Link href="/login" className="btn-primary px-6">
                  무료로 시작하기 <span aria-hidden>↗</span>
                </Link>
              )}
              <a href="#how" className="btn-outline px-6">
                사용 방법 보기
              </a>
            </div>
            <p className="text-xs text-muted">회원가입 절차 없이 구글 계정으로 바로 시작합니다.</p>
          </div>
          <figure className="m-0 max-w-[560px] md:max-w-none">
            <Photo name="landing" priority sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1199px) 46vw, 560px" className="aspect-[3/2] rounded-[18px] md:rounded-[24px]" />
            <figcaption className="mt-4 border-l-2 border-accent pl-4 text-xs text-muted md:text-[13px]">
              한 권의 책에서 시작되는, 우리 가족의 이야기.
            </figcaption>
          </figure>
        </section>

        {/* 취지 */}
        <section className="border-t border-line py-12 md:py-20">
          <div className="wrap grid gap-6 md:grid-cols-[1fr_1.7fr] md:gap-16">
            <div>
              <span className="eyebrow">WHY OUR LIBRARY</span>
              <h2 className="mt-2 text-[26px] leading-snug font-bold tracking-[-0.04em] md:text-[30px]">
                책은 많은데,
                <br />
                찾을 수도
                <br />
                기억할 수도 없어서.
              </h2>
            </div>
            <div className="space-y-4 text-[15px] leading-relaxed text-muted">
              <p>
                아이 그림책, 부모의 업무 서적, 언젠가 읽겠다고 산 소설까지. 집집마다 수백 권의 책이 있지만 &ldquo;그 책 어디 있지?&rdquo;, &ldquo;우리 집에 이 책
                있었나?&rdquo;를 반복합니다. 같은 책을 또 사기도 하고, 아이가 몇 번이나 읽어 달라고 했는지도 잊습니다.
              </p>
              <p>
                {SERVICE_NAME}은 집의 책장을 하나의 작은 도서관처럼 관리하고, 가족 각자의 독서 기록을 모아 <strong className="text-ink">우리 가족의 취향</strong>을
                보여 줍니다.
              </p>
              <p>같은 동네 이웃과 서로의 책을 빌려 읽으며, 책이 책장에서 잠들지 않게 합니다.</p>
            </div>
          </div>
        </section>

        {/* 사용 방법 */}
        <section id="how" className="scroll-mt-6 border-t border-line bg-white py-12 md:py-20">
          <div className="wrap">
            <SectionHead eyebrow="A SMALL BEGINNING" title="세 단계면 충분합니다" note="흩어져 있던 책과 기록을 우리 가족의 한곳으로." />
            <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
              {STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[110px_1fr] items-center overflow-hidden rounded-[18px] border border-line bg-paper md:block">
                  <Illustration name={s.art} width={480} className="w-full rounded-xl md:rounded-none" />
                  <div className="p-4 pl-1 md:p-6">
                    <span className="font-serif text-xl text-accent italic md:text-[27px]">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="mt-1 text-[17px] font-semibold md:mt-2 md:text-lg">{s.title}</h3>
                    <p className="mt-1 text-[13px] text-muted md:text-sm">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {/* 소개 영상: 사용자가 재생할 때만(자동 재생·반복 없음) */}
            <div className="mx-auto mt-10 max-w-3xl">
              <GuideVideo name="story" />
            </div>
          </div>
        </section>

        {/* 기능 */}
        <section id="features" className="scroll-mt-6 border-t border-line py-12 md:py-20">
          <div className="wrap">
            <SectionHead eyebrow="BOOKS, TOGETHER" title="가족 모두를 위한 서재" note="어디 있는지 찾는 일부터, 다음 책을 고르는 순간까지." />
            <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line min-[371px]:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="bg-paper p-4 md:p-7">
                  <FeatureIcon name={f.icon} />
                  <h3 className="mt-3 text-base font-semibold md:text-lg">{f.title}</h3>
                  <p className="mt-1 text-[13px] text-muted md:text-sm">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 가족과 이웃 */}
        <section id="neighbors" className="scroll-mt-6 border-t border-line bg-white py-12 md:py-20">
          <div className="wrap">
            <div className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
              <Photo name="neighbors" sizes="(max-width: 767px) calc(100vw - 32px), 46vw" className="aspect-[3/2] rounded-[20px]" />
              <div>
                <span className="eyebrow">A NEIGHBORHOOD OF READERS</span>
                <h2 className="mt-2 text-[26px] leading-snug font-bold tracking-[-0.04em] md:text-[30px]">
                  함께 쓰되,
                  <br />
                  보이는 것은 다르게
                </h2>
                <p className="mt-3 text-[15px] text-muted">
                  가족의 독서 기록은 가족 안에. 이웃에게는 나누고 싶은 책만 공개합니다.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-[10px] border border-line bg-paper p-4">
                    <strong className="block text-sm text-brand">가족</strong>
                    <span className="text-xs text-muted">서가·위치·읽기 기록</span>
                  </div>
                  <div className="rounded-[10px] border border-line bg-paper p-4">
                    <strong className="block text-sm text-brand">동네 이웃</strong>
                    <span className="text-xs text-muted">대여 가능한 책만</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8 overflow-x-auto" role="region" aria-label="가족과 이웃 권한 비교" tabIndex={0}>
              <table className="w-full min-w-[520px] border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th scope="col" className="bg-brand-soft px-4 py-3 text-left text-brand">할 수 있는 일</th>
                    <th scope="col" className="bg-brand-soft px-4 py-3 text-left text-brand">가족(소유자·관리자·구성원·아이)</th>
                    <th scope="col" className="bg-brand-soft px-4 py-3 text-left text-brand">동네 이웃</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map(([what, family, neighbor]) => (
                    <tr key={what} className="border-b border-line">
                      <th scope="row" className="px-4 py-3 text-left font-normal">{what}</th>
                      <td className="px-4 py-3">{family}</td>
                      <td className="px-4 py-3">{neighbor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ + 마무리 CTA */}
        <section className="border-t border-line py-12 md:py-20">
          <div className="wrap">
            <div className="mx-auto max-w-[800px]">
              <span className="eyebrow">GOOD TO KNOW</span>
              <h2 className="mt-2 text-[26px] font-bold tracking-[-0.04em] md:text-[30px]">자주 묻는 질문</h2>
              <div className="mt-4">
                {FAQ.map(([q, a]) => (
                  <details key={q} className="group border-b border-line py-4">
                    <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold">
                      {q}
                      <span aria-hidden className="text-brand transition-transform duration-150 group-open:rotate-90">›</span>
                    </summary>
                    <p className="mt-3 text-sm text-muted">{a}</p>
                  </details>
                ))}
              </div>
            </div>
            <div className="mt-12 rounded-[22px] bg-brand-soft px-4 py-8 text-center md:px-6 md:py-12">
              <h2 className="text-[22px] font-bold tracking-[-0.03em] md:text-[28px]">우리 가족의 다음 페이지를 열어보세요.</h2>
              <p className="mt-2 text-sm text-muted">집 안의 책 한 권부터, {SERVICE_NAME}에서.</p>
              <Link href="/login" className="btn-primary mt-5 px-6">
                {SERVICE_NAME} 시작하기 <span aria-hidden>↗</span>
              </Link>
              <p className="mt-4 text-xs text-muted">
                그 밖의 문의: <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function SectionHead({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <div className="mb-8 md:flex md:items-end md:justify-between md:gap-6">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="mt-2 text-[26px] font-bold tracking-[-0.04em] md:text-[30px]">{title}</h2>
      </div>
      <p className="mt-2 max-w-[350px] text-sm text-muted md:mt-0">{note}</p>
    </div>
  )
}
