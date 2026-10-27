import { NextRequest } from 'next/server'
import { ClaudeError, isClaudeConfigured, readShelfPhoto, type ImageMediaType } from '@/lib/claude'
import { requireCan } from '@/server/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const TYPES: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BASE64 = 10 * 1024 * 1024 // Claude API 이미지 한도(10MB, base64 기준)

/** 서가 칸 사진(JSON: { image: base64, mediaType }) → 책등 판독 목록. */
export async function POST(req: NextRequest) {
  await requireCan('book.write')
  if (!isClaudeConfigured()) {
    return Response.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않아 사진 판독을 쓸 수 없습니다.' }, { status: 501 })
  }
  const body = (await req.json().catch(() => null)) as { image?: string; mediaType?: string } | null
  const image = body?.image?.replace(/^data:[^,]+,/, '')
  const mediaType = body?.mediaType as ImageMediaType
  if (!image || !TYPES.includes(mediaType)) return Response.json({ error: '이미지가 없거나 형식이 맞지 않습니다.' }, { status: 400 })
  if (image.length > MAX_BASE64) return Response.json({ error: '사진이 너무 큽니다(10MB 이하).' }, { status: 413 })
  try {
    const books = await readShelfPhoto(image, mediaType)
    return Response.json({ books })
  } catch (e) {
    const msg = e instanceof ClaudeError ? e.message : 'AI 판독 중 오류가 났습니다. 잠시 뒤 다시 시도해 주세요.'
    console.error('[scan-shelf]', e)
    return Response.json({ error: msg }, { status: 502 })
  }
}
