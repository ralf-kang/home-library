import Link from 'next/link'
import { GoogleSignInButton, PublicHeader, SiteFooter } from '@/components/SiteChrome'
import { isGoogleConfigured, safeNext } from '@/lib/google-oidc'
import { isDevLoginEnabled } from '@/server/login'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next) ?? undefined
  const error = sp.error === 'google_not_configured' ? '서버에 구글 로그인 설정(GOOGLE_CLIENT_ID)이 아직 없습니다.' : sp.error
  const isInvite = next?.startsWith('/invite/')
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
          <h1 className="text-2xl font-bold">{isInvite ? '초대를 받으셨어요' : '우리집 서재 시작하기'}</h1>
          <p className="mt-2 text-sm text-muted">
            별도 회원가입 없이 구글 계정으로 바로 시작합니다.
            {isInvite && <><br />로그인하면 초대받은 서재(또는 동네)에 자동으로 참여합니다.</>}
          </p>
        </div>
        <div className="card space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {isGoogleConfigured() ? (
            <GoogleSignInButton next={next} />
          ) : (
            <p className="text-sm text-muted">구글 로그인이 아직 설정되지 않았습니다(관리자: GOOGLE_CLIENT_ID/SECRET).</p>
          )}
          <p className="text-center text-xs text-muted">
            계속하면 <Link href="/terms" className="underline">이용약관</Link>과{' '}
            <Link href="/privacy" className="underline">개인정보처리방침</Link>에 동의하는 것으로 봅니다.
            구글 계정의 이름·이메일·프로필 사진만 받습니다.
          </p>
        </div>
        {isDevLoginEnabled() && (
          <form action="/api/auth/dev" method="post" className="card mt-4 space-y-2 border-dashed">
            <p className="text-xs font-semibold text-accent">테스트 로그인 (ENABLE_DEV_LOGIN — 운영에서는 꺼 두세요)</p>
            <input type="hidden" name="next" value={next ?? ''} />
            <input name="email" type="email" required placeholder="tester@example.com" className="input" />
            <input name="name" placeholder="표시 이름(선택)" className="input" />
            <button className="btn-ghost w-full">테스트 사용자로 로그인</button>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
