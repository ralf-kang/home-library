import { labelSize } from '@/lib/labels'
import { requireCan } from '@/server/auth'
import { labelQrBase } from '@/server/label-origin'
import { loadLabelQueue, shelfTags, type LabelFilter } from '@/server/labels'
import { loadLocations } from '@/server/queries'
import PrintSheet from './PrintSheet'

export const dynamic = 'force-dynamic'

/**
 * 인쇄 전용 페이지(앱 머리말 없음). 라벨 한 장 = 한 페이지, 용지 크기 = 라벨 크기.
 * OS 인쇄 창에서 블루투스로 연결한 라벨 프린터(드라이버)나 'PDF로 저장'을 고른다.
 */
export default async function LabelPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; filter?: string; size?: string; kind?: string }>
}) {
  const { household } = await requireCan('book.write')
  const sp = await searchParams
  const kind = sp.kind === 'shelves' ? 'shelves' : 'books'
  const filter = (['todo', 'never', 'stale', 'all'].includes(sp.filter ?? '') ? sp.filter : 'todo') as LabelFilter
  const size = labelSize(sp.size)
  const loc = await loadLocations(household.id)
  const scope = sp.scope && loc.byId.has(sp.scope) ? sp.scope : null
  const [{ items }, qrBase] = await Promise.all([loadLabelQueue(household.id, loc, scope, filter), labelQrBase()])
  const books = items
    .filter((it) => it.shelfPos)
    .map((it) => ({ copyId: it.copyId, seq: it.seq, title: it.title, volumeNo: it.volumeNo, fullCode: it.fullCode, shelfPos: it.shelfPos! }))
  return <PrintSheet kind={kind} books={books} tags={kind === 'shelves' ? shelfTags(loc, scope) : []} sizeId={size.id} qrBase={qrBase} />
}
