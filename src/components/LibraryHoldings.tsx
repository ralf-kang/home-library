import { nearbyHoldings } from '@/lib/public-data'

/** 책 상세: 이 책을 가진 우리 지역 도서관과 지금 대출 가능 여부(도서관 정보나루). 키·지역·ISBN 이 없으면 숨김. */
export default async function LibraryHoldings({ isbn13, regionName }: { isbn13: string | null; regionName: string | null }) {
  if (!isbn13 || !regionName) return null
  const libs = await nearbyHoldings(isbn13, regionName)
  if (libs.length === 0) return null
  return (
    <section className="card space-y-2">
      <h2 className="font-semibold">근처 도서관에서도 빌릴 수 있어요</h2>
      <ul className="space-y-1 text-sm">
        {libs.map((l) => (
          <li key={l.libCode} className="flex flex-wrap items-center gap-2">
            {l.homepage ? (
              <a href={l.homepage} target="_blank" rel="noopener" className="hover:underline">
                {l.name}
              </a>
            ) : (
              <span>{l.name}</span>
            )}
            <span
              className={`chip ${l.loanAvailable ? 'bg-brand-soft text-brand' : l.loanAvailable === false ? 'bg-paper text-muted ring-1 ring-line' : 'bg-paper text-muted'}`}
            >
              {l.loanAvailable ? '대출 가능' : l.loanAvailable === false ? '대출 중' : '확인 불가'}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted">출처: 도서관 정보나루(전날 기준 소장·대출 정보)</p>
    </section>
  )
}
