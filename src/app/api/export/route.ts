import { prisma } from '@/lib/db'
import { COPY_STATUS_LABEL, formatCopyCode } from '@/lib/format'
import { requireCan } from '@/server/auth'
import { loadLocations } from '@/server/queries'

export const dynamic = 'force-dynamic'

function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  // CSV 수식 주입 방지(엑셀이 =,+,-,@로 시작하는 값을 수식으로 실행)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

/** 소장본 단위 장서 목록 CSV(엑셀 한글 깨짐 방지 BOM 포함). */
export async function GET() {
  const { household } = await requireCan('book.write')
  const loc = await loadLocations(household.id)
  const copies = await prisma.copy.findMany({
    where: { book: { householdId: household.id } },
    include: { book: { include: { series: true } }, owner: true },
    orderBy: { seq: 'asc' },
  })
  const header = ['관리번호', '제목', '권차', '시리즈', '저자', '출판사', '출간연도', 'ISBN', '분야', 'KDC', '위치코드', '위치', '구역', '소유자', '상태', '대여가능']
  const lines = copies.map((c) => {
    const d = loc.describe(c.locationId)
    return [
      formatCopyCode(c.seq), c.book.title, c.book.volumeNo, c.book.series?.name, c.book.authors, c.book.publisher,
      c.book.pubYear, c.book.isbn13, c.book.category, c.book.kdc, d?.code, d?.name, d?.zone?.name, c.owner?.name,
      COPY_STATUS_LABEL[c.status], c.lendable ? 'Y' : 'N',
    ].map(cell).join(',')
  })
  const csv = '﻿' + [header.map(cell).join(','), ...lines].join('\r\n')
  const date = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="home-library-${date}.csv"`,
    },
  })
}
