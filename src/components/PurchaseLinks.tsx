import { AFFILIATE_NOTICE, purchaseLinks } from '@/lib/affiliate'

/** 추천·위시리스트의 '구매하기' 링크 묶음. 제휴 링크가 하나라도 있으면 고지 문구를 붙인다. */
export default function PurchaseLinks({ book }: { book: { isbn13?: string | null; title: string; authors?: string | null } }) {
  const links = purchaseLinks(book)
  const anyAffiliate = links.some((l) => l.affiliate)
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="text-muted">구매</span>
      {links.map((l) => (
        <a key={l.store} href={l.url} target="_blank" rel={l.affiliate ? 'noopener sponsored' : 'noopener'} className="underline">
          {l.store}
          {l.affiliate && <span className="ml-0.5 text-[10px] text-muted">(제휴)</span>}
        </a>
      ))}
      {anyAffiliate && <span className="w-full text-[10px] text-muted">{AFFILIATE_NOTICE}</span>}
    </div>
  )
}
