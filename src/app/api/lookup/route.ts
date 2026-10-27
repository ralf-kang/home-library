import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { guessCategory, isKakaoConfigured, kakaoSearch, lookupIsbn } from '@/lib/book-lookup'
import { normalizeIsbn } from '@/lib/isbn'
import { requireCan } from '@/server/auth'

export const dynamic = 'force-dynamic'

/**
 * 등록 화면용 서지 조회.
 *  ?isbn=978...  → 단건(이미 등록된 책이면 existingId 포함)
 *  ?q=제목 저자   → 후보 목록(카카오 키가 있을 때만)
 */
export async function GET(req: NextRequest) {
  const { household } = await requireCan('book.write')
  const isbnParam = req.nextUrl.searchParams.get('isbn')
  const q = req.nextUrl.searchParams.get('q')
  if (isbnParam) {
    const isbn13 = normalizeIsbn(isbnParam)
    if (!isbn13) return Response.json({ error: 'ISBN 형식이 올바르지 않습니다.' }, { status: 400 })
    const existing = await prisma.book.findUnique({
      where: { householdId_isbn13: { householdId: household.id, isbn13 } },
      select: { id: true, title: true },
    })
    const found = await lookupIsbn(isbn13)
    return Response.json({
      isbn13,
      existing,
      book: found ? { ...found, category: guessCategory(found.kdc) } : null,
      configured: isKakaoConfigured() || Boolean(process.env.NL_SEOJI_API_KEY),
    })
  }
  if (q) {
    const items = await kakaoSearch(q, undefined, 10)
    return Response.json({ items, configured: isKakaoConfigured() })
  }
  return Response.json({ error: 'isbn 또는 q가 필요합니다.' }, { status: 400 })
}
