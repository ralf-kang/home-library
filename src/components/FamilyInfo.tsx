import type { Household } from '@prisma/client'
import BookCover from '@/components/BookCover'
import { prisma } from '@/lib/db'
import { librarianPicks, librariesInRegion, popularLoans, type PopularBook } from '@/lib/public-data'

/**
 * '우리 가족을 위한 정보' — 공공데이터(도서관·인기대출·사서추천). 키가 없거나 호출이 실패한 항목은
 * 숨기고, 전부 비면 아무것도 그리지 않는다(best-effort). 우리 집에 이미 있는 책에는 표시를 붙인다.
 */
export default async function FamilyInfo({ household }: { household: Pick<Household, 'id' | 'regionName'> }) {
  const hasChild = (await prisma.member.count({ where: { householdId: household.id, ageGroup: 'CHILD' } })) > 0
  const [libraries, popular, kidsPopular, picks, owned] = await Promise.all([
    librariesInRegion(household.regionName, 4),
    popularLoans(household.regionName, { size: 8 }),
    hasChild ? popularLoans(household.regionName, { age: 8, size: 8 }) : Promise.resolve([]),
    librarianPicks(6),
    prisma.book.findMany({ where: { householdId: household.id, isbn13: { not: null } }, select: { isbn13: true } }),
  ])
  if (!libraries.length && !popular.length && !kidsPopular.length && !picks.length) {
    return household.regionName ? null : (
      <p className="text-xs text-muted">
        서재 설정에서 &lsquo;우리 동네(시·군·구)&rsquo;를 넣으면 근처 도서관과 지역 인기 대출 도서를 보여 드립니다.
      </p>
    )
  }
  const ownedSet = new Set(owned.map((b) => b.isbn13))
  const region = household.regionName?.split(/\s+/).slice(0, 2).join(' ')

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">우리 가족을 위한 정보</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {libraries.length > 0 && (
          <div className="card space-y-2">
            <h3 className="font-semibold">우리 동네 도서관</h3>
            <ul className="space-y-2 text-sm">
              {libraries.map((l) => (
                <li key={l.name} className="flex flex-wrap items-center gap-2">
                  {l.homepage ? (
                    <a href={l.homepage} target="_blank" rel="noopener" className="font-medium hover:underline">
                      {l.name}
                    </a>
                  ) : (
                    <span className="font-medium">{l.name}</span>
                  )}
                  <span className={`chip ${l.closedToday ? 'bg-red-50 text-red-700' : 'bg-brand-soft text-brand'}`}>{l.closedToday ? '오늘 휴관' : '오늘 운영'}</span>
                  <span className="w-full text-xs text-muted">
                    평일 {l.weekday || '-'} · 토 {l.saturday || '-'} · 휴관 {l.closeDay || '-'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted">출처: 전국도서관표준데이터(공공데이터포털)</p>
          </div>
        )}
        {picks.length > 0 && (
          <div className="card space-y-2">
            <h3 className="font-semibold">이달의 사서 추천</h3>
            <PickRow books={picks.map((p, i) => ({ rank: i + 1, title: p.title, authors: p.authors, isbn13: p.isbn13, coverUrl: p.coverUrl, loans: 0 }))} owned={ownedSet} />
            <p className="text-[10px] text-muted">출처: 국립중앙도서관 사서추천도서</p>
          </div>
        )}
        {popular.length > 0 && (
          <div className="card space-y-2">
            <h3 className="font-semibold">{region ?? '전국'} 인기 대출(최근 30일)</h3>
            <PickRow books={popular} owned={ownedSet} />
            <p className="text-[10px] text-muted">출처: 도서관 정보나루</p>
          </div>
        )}
        {kidsPopular.length > 0 && (
          <div className="card space-y-2">
            <h3 className="font-semibold">초등학생이 많이 빌린 책</h3>
            <PickRow books={kidsPopular} owned={ownedSet} />
            <p className="text-[10px] text-muted">출처: 도서관 정보나루</p>
          </div>
        )}
      </div>
    </section>
  )
}

function PickRow({ books, owned }: { books: PopularBook[]; owned: Set<string | null> }) {
  return (
    <ul className="grid grid-cols-4 gap-2">
      {books.slice(0, 8).map((b) => (
        <li key={`${b.rank}-${b.title}`} className="min-w-0 space-y-1">
          <a href={`/search?q=${encodeURIComponent(b.title)}`} className="block">
            <BookCover title={b.title} coverUrl={b.coverUrl} size="fill" />
          </a>
          <p className="line-clamp-2 text-[11px] leading-tight">{b.title}</p>
          {b.isbn13 && owned.has(b.isbn13) && <span className="chip bg-brand text-[10px] text-white">우리 집에 있음</span>}
        </li>
      ))}
    </ul>
  )
}
