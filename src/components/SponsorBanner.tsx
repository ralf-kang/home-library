import { prisma } from '@/lib/db'

/**
 * 후원·동네 책방 배너 자리(수익화 골격). 플랫폼 관리자가 /admin 에서 등록한 활성 배너 중
 * 이 동네 전용 → 전체 공용 순으로 하나를 보여 준다. 없으면 아무것도 그리지 않는다.
 * 광고임을 분명히 표시한다(표시광고법·공정위 지침).
 */
export default async function SponsorBanner({ neighborhoodId }: { neighborhoodId?: string | null }) {
  const now = new Date()
  const slots = await prisma.sponsorSlot.findMany({
    where: {
      active: true,
      OR: [{ neighborhoodId: null }, ...(neighborhoodId ? [{ neighborhoodId }] : [])],
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: [{ neighborhoodId: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 1,
  })
  const s = slots[0]
  if (!s) return null
  const body = (
    <div className="flex items-center gap-3">
      {s.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-muted">후원 · 광고</p>
        <p className="truncate font-semibold">{s.title}</p>
        {s.body && <p className="line-clamp-2 text-sm text-muted">{s.body}</p>}
      </div>
    </div>
  )
  return (
    <aside className="card border-dashed">
      {s.linkUrl ? (
        <a href={s.linkUrl} target="_blank" rel="noopener sponsored" className="block hover:opacity-90">
          {body}
        </a>
      ) : (
        body
      )}
    </aside>
  )
}
