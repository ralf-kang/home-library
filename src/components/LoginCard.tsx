import { GoogleSignInButton } from '@/components/SiteChrome'
import { isGoogleConfigured } from '@/lib/google-oidc'
import { isDevLoginEnabled } from '@/server/login'

/**
 * 가족 전용 간단 로그인 화면(첫 화면 `/`와 `/login` 공용). 소개·마케팅 없이 로그인 카드 하나만 보인다.
 * 구글 설정이 있으면 구글 버튼, ENABLE_DEV_LOGIN=1 이면 이메일 로그인 폼을 보인다.
 */
export default function LoginCard({ next, error }: { next?: string; error?: string }) {
  const google = isGoogleConfigured()
  const emailLogin = isDevLoginEnabled()
  const isInvite = next?.startsWith('/invite/')
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-[380px] rounded-[20px] border border-line bg-white p-6 shadow-sm sm:p-8">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={48} height={48} className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-[22px] font-bold tracking-[-0.03em]">우리집 서재</h1>
          <p className="mt-1 text-sm text-muted">{isInvite ? '초대받은 서재에 참여하려면 로그인하세요.' : '가족 전용 서재입니다. 로그인해 주세요.'}</p>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-[10px] bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-4">
          {google && <GoogleSignInButton next={next} />}

          {emailLogin && (
            <form action="/api/auth/dev" method="post" className="space-y-3">
              {google && <p className="text-center text-xs text-muted">또는</p>}
              <input type="hidden" name="next" value={next ?? ''} />
              <div>
                <label htmlFor="login-email" className="label">이메일</label>
                <input id="login-email" name="email" type="email" required autoComplete="email" autoFocus className="input" />
              </div>
              <div>
                <label htmlFor="login-name" className="label">표시 이름(처음 한 번, 선택)</label>
                <input id="login-name" name="name" autoComplete="name" className="input" />
              </div>
              <button className="btn-primary w-full">로그인</button>
            </form>
          )}

          {!google && !emailLogin && (
            <p className="rounded-[10px] border border-line bg-paper p-3 text-sm text-muted">
              로그인 방법이 설정되지 않았습니다(관리자: GOOGLE_CLIENT_ID/SECRET 또는 ENABLE_DEV_LOGIN).
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted">우리 가족 구성원만 사용합니다.</p>
      </div>
    </main>
  )
}
