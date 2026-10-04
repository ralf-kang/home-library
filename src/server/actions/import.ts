'use server'

import { revalidatePath } from 'next/cache'
import type { AgeGroup } from '@prisma/client'
import { prisma } from '@/lib/db'
import { toChosung } from '@/lib/chosung'
import { guessCategory, kakaoSearch, lookupIsbn } from '@/lib/book-lookup'
import { requireCan } from '@/server/auth'
import { s, type ActionResult } from '@/server/form'
import { ownedLocation, ownedMember } from '@/server/queries'
import { appendToShelf } from '@/server/labels'

/**
 * 사진 판독 결과 일괄 등록. 사람이 확인 화면에서 고른 줄만 들어온다.
 * 각 줄은 제목+저자로 카카오 검색 → 첫 결과의 ISBN이 있으면 서지를 채운다(이미 있는 ISBN이면
 * 소장본만 추가). 매칭은 틀릴 수 있으므로 새로 만든 서지는 모두 needsReview=true로 둔다.
 */
export async function importFromPhoto(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { member: admin, household } = await requireCan('book.write')
  const hid = household.id
  const locationId = s(form, 'locationId')
  if (!locationId || !(await ownedLocation(hid, locationId))) return { ok: false, error: '칸을 골라 주세요.' }
  const ownerId = s(form, 'ownerId')
  if (ownerId && !(await ownedMember(hid, ownerId))) return { ok: false, error: '없는 구성원입니다.' }
  const ageGroup: AgeGroup = s(form, 'ageGroup') === 'CHILD' ? 'CHILD' : 'ADULT'
  const forcedCategory = s(form, 'category')
  const seriesName = s(form, 'seriesName')

  const rows = form
    .getAll('row')
    .map(String)
    .map((i) => ({
      title: s(form, `title_${i}`),
      author: s(form, `author_${i}`) ?? '',
      volume: Number(s(form, `volume_${i}`)) || null,
    }))
    .filter((r): r is { title: string; author: string; volume: number | null } => Boolean(r.title))
  if (rows.length === 0) return { ok: false, error: '등록할 책을 하나 이상 골라 주세요.' }

  const series = seriesName ? await prisma.series.upsert({
        where: { householdId_name: { householdId: hid, name: seriesName } },
        create: { householdId: hid, name: seriesName },
        update: {},
      }) : null
  let created = 0
  let addedCopies = 0
  for (const row of rows) {
    const hit = (await kakaoSearch(`${row.title} ${row.author}`.trim(), undefined, 3)).find((c) => c.isbn13)
    const detail = hit?.isbn13 ? await lookupIsbn(hit.isbn13) : null
    const isbn13 = detail?.isbn13 ?? hit?.isbn13 ?? null
    const existing = isbn13
      ? await prisma.book.findUnique({ where: { householdId_isbn13: { householdId: hid, isbn13 } } })
      : null
    const book =
      existing ??
      (await prisma.book.create({
        data: {
          householdId: hid,
          isbn13,
          title: detail?.title || row.title,
          titleChosung: toChosung(detail?.title || row.title),
          authors: detail?.authors || row.author,
          publisher: detail?.publisher ?? '',
          pubYear: detail?.pubYear ?? null,
          coverUrl: detail?.coverUrl ?? null,
          description: detail?.description ?? null,
          kdc: detail?.kdc ?? null,
          category: forcedCategory ?? guessCategory(detail?.kdc, ageGroup),
          ageGroup,
          seriesId: series?.id ?? null,
          volumeNo: row.volume,
          needsReview: true,
        },
      }))
    if (!existing) created++
    const copy = await prisma.copy.create({ data: { bookId: book.id, locationId, ownerId } })
    await prisma.copyMove.create({ data: { copyId: copy.id, toLocationId: locationId, movedById: admin.id } })
    await prisma.$transaction((tx) => appendToShelf(tx, locationId, [copy.id]))
    addedCopies++
  }
  revalidatePath('/search')
  revalidatePath('/shelves')
  return {
    ok: true,
    message: `${addedCopies}권을 등록했습니다(새 서지 ${created}건). 검색에서 '확인 필요' 필터로 검토하세요.`,
  }
}
