import Link from 'next/link'
import LegalPage from '@/components/LegalPage'
import { SERVICE_NAME } from '@/components/SiteChrome'
import { PLAN_INFO, isMonetizationEnabled } from '@/lib/plans'

export const metadata = { title: `요금 안내 · ${SERVICE_NAME}` }

export default function PricingPage() {
  const free = PLAN_INFO.FREE
  const plus = PLAN_INFO.PLUS
  return (
    <LegalPage title="요금 안내">
      <p className="rounded-lg bg-brand-soft p-4 text-brand">
        <b>지금은 모든 기능이 무료입니다.</b>{' '}
        {isMonetizationEnabled() ? '' : '사용 한도도 적용하지 않습니다.'} 유료 요금제는 이용자가 충분히 늘어난 뒤에 도입 여부를 결정하며, 도입하더라도 아래
        &lsquo;무료&rsquo;의 기본 기능은 계속 무료로 유지하는 것을 원칙으로 합니다.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card space-y-3 p-5">
          <p className="text-sm font-semibold text-brand">{free.name}</p>
          <p className="text-3xl font-bold">0원</p>
          <ul className="space-y-1 text-sm">
            {free.perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <Link href="/login" className="btn-primary w-full">
            무료로 시작하기
          </Link>
        </div>
        <div className="card space-y-3 border-dashed p-5 opacity-80">
          <p className="text-sm font-semibold text-accent">{plus.name}</p>
          <p className="text-3xl font-bold">
            미정 <span className="text-sm font-normal text-muted">(검토 중)</span>
          </p>
          <ul className="space-y-1 text-sm">
            {plus.perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="text-xs text-muted">출시가 결정되면 미리 알려 드리고, 동의하지 않으면 요금이 부과되지 않습니다.</p>
        </div>
      </div>
      <h2>도서 구매 링크에 대하여</h2>
      <p>
        추천·위시리스트의 &lsquo;구매하기&rsquo; 링크 일부에는 온라인 서점 제휴(어필리에이트) 코드가 포함될 수 있습니다. 이 링크로 구매하면 서비스 운영에
        쓰이는 소정의 수수료를 받을 수 있으며, 이용자가 내는 가격은 같습니다. 해당 링크에는 &lsquo;제휴 링크&rsquo;라고 표시합니다.
      </p>
    </LegalPage>
  )
}
