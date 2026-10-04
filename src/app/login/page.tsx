import Link from 'next/link'
import { Photo } from '@/components/Art'
import { GoogleSignInButton, PublicHeader, SiteFooter } from '@/components/SiteChrome'
import { isGoogleConfigured, safeNext } from '@/lib/google-oidc'
import { isDevLoginEnabled } from '@/server/login'

export const dynamic = 'force-dynamic'

/** 로그인: 데스크톱은 좌측 독서 공간 사진(4:5, 46%) + 우측 360px 폼, 모바일은 폼 우선(사진 숨김). */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next) ?? undefined
  const error = sp.error === 'google_not_configured' ? '서버에 구글 로그인 설정(GOOGLE_CLIENT_ID)이 아직 없습니다.' : sp.error
  const isInvite = next?.startsWith('/invite/')
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="wrap flex flex-1 items-center py-10 md:py-16">
        <div className="mx-auto grid w-full max-w-[1000px] items-center gap-10 md:grid-cols-[46%_1fr]">
          <div className="hidden md:block">
            <Photo name="auth" decorative sizes="(max-width: 1199px) 42vw, 460px" className="aspect-[4/5] rounded-[24px] object-cover" />
          </div>
          <div className="mx-auto w-full max-w-[360px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={48} height={48} className="mb-4 h-12 w-12" />
            <h1 className="text-[26px] font-bold tracking-[-0.03em]">{isInvite ? '초대를 받으셨어요' : '우리집 서재 시작하기'}</h1>
            <p className="mt-2 text-sm text-muted">
              별도 회원가입 없이 구글 계정으로 바로 시작합니다.
              {isInvite && ' 로그인하면 초대받은 서재(또는 동네)에 자동으로 참여합니다.'}
            </p>
            {error && (
              <p role="alert" className="mt-5 rounded-[10px] bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-6 space-y-4">
              {isGoogleConfigured() ? (
                <GoogleSignInButton next={next} />
              ) : (
                <p className="rounded-[10px] border border-line bg-white p-3 text-sm text-muted">
                  구글 로그인이 아직 설정되지 않았습니다(관리자: GOOGLE_CLIENT_ID/SECRET).
                </p>
              )}
              <p className="text-xs leading-relaxed text-muted">
                계속하면 <Link href="/terms" className="underline">이용약관</Link>과 <Link href="/privacy" className="underline">개인정보처리방침</Link>에 동의하는
                것으로 봅니다. 구글 계정의 이름·이메일·프로필 사진만 받습니다.
              </p>
            </div>
            {isDevLoginEnabled() && (
              <form action="/api/auth/dev" method="post" className="mt-8 space-y-3 rounded-2xl border border-dashed border-accent/50 bg-white p-4">
                <p className="text-xs font-semibold text-accent">테스트 로그인 (ENABLE_DEV_LOGIN — 운영에서는 꺼 두세요)</p>
                <input type="hidden" name="next" value={next ?? ''} />
                <div>
                  <label htmlFor="dev-email" className="label">이메일</label>
                  <input id="dev-email" name="email" type="email" required autoComplete="email" className="input" />
                </div>
                <div>
                  <label htmlFor="dev-name" className="label">표시 이름(선택)</label>
                  <input id="dev-name" name="name" autoComplete="name" className="input" />
                </div>
                <button className="btn-ghost w-full">테스트 사용자로 로그인</button>
              </form>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
