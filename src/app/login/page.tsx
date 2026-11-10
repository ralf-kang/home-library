import LoginCard from '@/components/LoginCard'
import { safeNext } from '@/lib/google-oidc'

export const dynamic = 'force-dynamic'

/** 로그인: 첫 화면(`/`)과 같은 간단 로그인 카드. 보호된 경로에서 넘어오면 next로 돌아간다. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next) ?? undefined
  const error = sp.error === 'google_not_configured' ? '서버에 구글 로그인 설정(GOOGLE_CLIENT_ID)이 아직 없습니다.' : sp.error
  return <LoginCard next={next} error={error} />
}
