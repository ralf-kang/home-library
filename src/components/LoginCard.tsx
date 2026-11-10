import EmailCodeLogin from '@/components/EmailCodeLogin'
import { GoogleSignInButton } from '@/components/SiteChrome'
import { isEmailLoginConfigured } from '@/lib/family-auth'
import { isGoogleConfigured } from '@/lib/google-oidc'

/**
 * 가족 전용 간단 로그인 화면(첫 화면 `/`와 `/login` 공용). 소개·마케팅 없이 로그인 카드 하나만 보인다.
 * 기본은 남편/아내 이메일 인증코드 로그인. 구글 설정이 있으면 구글 버튼도 함께 보인다.
 */
export default function LoginCard({ next, error }: { next?: string; error?: string }) {
  const email = isEmailLoginConfigured()
  const google = isGoogleConfigured()
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-[380px] rounded-[20px] border border-line bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={48} height={48} className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-[22px] font-bold tracking-[-0.03em]">우리집 서재</h1>
          <p className="mt-1 text-sm text-muted">접근하려면 이메일 인증이 필요합니다.</p>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-[10px] bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {email && <EmailCodeLogin next={next} />}
        {google && (
          <div className={email ? 'mt-4 border-t border-line pt-4' : ''}>
            <GoogleSignInButton next={next} />
          </div>
        )}
        {!email && !google && (
          <p className="rounded-[10px] border border-line bg-paper p-3 text-sm text-muted">
            로그인 방법이 설정되지 않았습니다(관리자: SMTP_* 와 AUTH_HUSBAND_EMAIL/AUTH_WIFE_EMAIL).
          </p>
        )}
      </div>
    </main>
  )
}
