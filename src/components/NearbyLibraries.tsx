import { librariesInRegion } from '@/lib/public-data'

/**
 * 우리 동네 도서관(전국도서관표준데이터). DATA_GO_KR_SERVICE_KEY 가 없거나 지역이 없으면 그리지 않는다.
 */
export default async function NearbyLibraries({ regionName }: { regionName: string | null }) {
  const libs = await librariesInRegion(regionName, 12)
  if (libs.length === 0) return null
  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">동네 도서관</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {libs.map((l) => (
          <li key={l.name} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-medium">{l.name}</p>
              <span className={`chip shrink-0 ${l.closedToday ? 'bg-red-50 text-red-700' : 'bg-brand-soft text-brand'}`}>
                {l.closedToday ? '오늘 휴관' : '운영'}
              </span>
            </div>
            <p className="text-xs text-muted">{l.kind}</p>
            <p className="mt-1 text-xs">평일 {l.weekday || '-'} · 토 {l.saturday || '-'}</p>
            <p className="text-xs text-muted">휴관 {l.closeDay || '-'}</p>
            <p className="mt-1 truncate text-xs text-muted">{l.address}</p>
            <div className="mt-1 flex gap-3 text-xs">
              {l.phone && <a href={`tel:${l.phone}`} className="underline">{l.phone}</a>}
              {l.homepage && <a href={l.homepage} target="_blank" rel="noopener" className="underline">홈페이지</a>}
              {l.lat && l.lng && (
                <a href={`https://map.kakao.com/link/map/${encodeURIComponent(l.name)},${l.lat},${l.lng}`} target="_blank" rel="noopener" className="underline">
                  지도
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted">출처: 전국도서관표준데이터(공공데이터포털). 휴관일은 요일 기준이며 공휴일·임시 휴관은 도서관에 확인하세요.</p>
    </section>
  )
}
