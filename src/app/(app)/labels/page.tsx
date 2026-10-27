import Link from 'next/link'
import ActionForm from '@/components/ActionForm'
import LabelStudio from '@/components/labels/LabelStudio'
import { LABEL_SIZES, LABEL_STATE_TEXT, SHELF_ORDER_LABEL, labelSize, type ShelfOrderMode } from '@/lib/labels'
import { LOCATION_KIND_LABEL } from '@/lib/format'
import { assignShelfOrder } from '@/server/actions/labels'
import { requireCan } from '@/server/auth'
import { labelQrBase } from '@/server/label-origin'
import { LABEL_FILTER_TEXT, loadLabelQueue, shelfTags, type LabelFilter } from '@/server/labels'
import { loadLocations } from '@/server/queries'

const FILTERS = Object.keys(LABEL_FILTER_TEXT) as LabelFilter[]

/**
 * 서가 라벨: 청구기호(위치 코드 · 칸 안 순번)를 책에 붙여 실제 책장을 정리한다.
 * 범위(집 전체·공간·책장·칸) → 칸 순서 정하기 → 라벨 출력(인쇄 창 또는 Niimbot 블루투스) → 인쇄 완료 기록.
 */
export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; filter?: string; size?: string; kind?: string; marked?: string; ordered?: string }>
}) {
  const { household } = await requireCan('book.write')
  const hid = household.id
  const sp = await searchParams
  const kind = sp.kind === 'shelves' ? 'shelves' : 'books'
  const filter: LabelFilter = FILTERS.includes(sp.filter as LabelFilter) ? (sp.filter as LabelFilter) : 'todo'
  const size = labelSize(sp.size)
  const loc = await loadLocations(hid)
  const scope = sp.scope && loc.byId.has(sp.scope) ? sp.scope : null
  const [{ items, counts }, qrBase] = await Promise.all([loadLabelQueue(hid, loc, scope, filter), labelQrBase()])
  const tags = kind === 'shelves' ? shelfTags(loc, scope) : []
  const scopeOptions = [...loc.locations].sort((a, b) => loc.describe(a.id)!.code.localeCompare(loc.describe(b.id)!.code, 'ko', { numeric: true }))
  const qs = new URLSearchParams({ kind, filter, size: size.id, ...(scope ? { scope } : {}) })
  const marked = Number(sp.marked) || 0
  // 칸 순서 정하기 결과: mode:칸수:책수:바뀐순번수
  const [oMode, oShelves, oBooks, oChanged] = (sp.ordered ?? '').split(':')
  const ordered = oMode in SHELF_ORDER_LABEL ? { label: SHELF_ORDER_LABEL[oMode as ShelfOrderMode], shelves: Number(oShelves), books: Number(oBooks), changed: Number(oChanged) } : null
  const books = items
    .filter((it) => it.callNumber && it.shelfPos)
    .map((it) => ({
      copyId: it.copyId,
      seq: it.seq,
      title: it.title,
      volumeNo: it.volumeNo,
      fullCode: it.fullCode,
      shelfPos: it.shelfPos!,
      callNumber: it.callNumber!,
      state: it.state,
    }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">서가 라벨</h1>
          <p className="max-w-2xl text-sm text-muted">
            책마다 <span className="font-mono text-ink">LV-B2-S3 · 07</span>처럼 위치와 칸 안 순번을 붙입니다. 라벨을 뽑힌 순서대로 붙여 같은 순서로 꽂으면,
            누구나 책을 제자리에 돌려놓을 수 있습니다. QR을 휴대폰으로 찍으면 책 상세로 바로 갑니다.
          </p>
        </div>
        <Link href="/settings#locations" className="btn-ghost">
          공간·책장·칸 이름 바꾸기
        </Link>
      </div>

      {ordered && (
        <p role="status" className="rounded-[10px] bg-brand-soft p-3 text-sm text-brand">
          칸 {ordered.shelves}곳, 책 {ordered.books.toLocaleString()}권의 순서를 &lsquo;{ordered.label}&rsquo;로 정했습니다(바뀐 순번 {ordered.changed.toLocaleString()}개). 바뀐 책은 아래 목록에 뽑을 라벨로 나옵니다.
        </p>
      )}
      {marked > 0 && (
        <p role="status" className="rounded-[10px] bg-brand-soft p-3 text-sm text-brand">
          라벨 {marked.toLocaleString()}장을 붙인 것으로 기록했습니다. 위치나 순서가 바뀌면 &lsquo;다시 뽑을 라벨&rsquo;로 다시 나옵니다.
        </p>
      )}

      {/* 조건(GET 폼) — 고르고 '보기'를 누르면 목록이 바뀐다 */}
      <form action="/labels" className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="lb-kind" className="label">무엇을 뽑을까요</label>
          <select id="lb-kind" name="kind" defaultValue={kind} className="input">
            <option value="books">책 라벨(청구기호·QR·제목)</option>
            <option value="shelves">칸 이름표(선반 앞면)</option>
          </select>
        </div>
        <div>
          <label htmlFor="lb-scope" className="label">범위</label>
          <select id="lb-scope" name="scope" defaultValue={scope ?? ''} className="input">
            <option value="">집 전체</option>
            {scopeOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {loc.describe(l.id)!.code} · {l.name}({LOCATION_KIND_LABEL[l.kind]})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lb-filter" className="label">책 라벨 범위</label>
          <select id="lb-filter" name="filter" defaultValue={filter} className="input" disabled={kind === 'shelves'}>
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {LABEL_FILTER_TEXT[f]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lb-size" className="label">라벨 크기</label>
          <select id="lb-size" name="size" defaultValue={size.id} className="input">
            {LABEL_SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.hint}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
          <button className="btn-primary">보기</button>
          <span className="flex flex-wrap gap-1 text-xs">
            {(['never', 'stale', 'ok', 'unplaced'] as const).map((s) => (
              <span key={s} className={`chip ${s === 'stale' ? 'bg-amber-100 text-amber-900' : s === 'ok' ? 'bg-brand-soft text-brand' : 'bg-paper ring-1 ring-line'}`}>
                {LABEL_STATE_TEXT[s]} {counts[s].toLocaleString()}
              </span>
            ))}
          </span>
        </div>
      </form>

      {/* 칸 순서 정하기 — 순번이 없는 책이 있으면 먼저 */}
      <details className="card" open={counts.unplaced > 0}>
        <summary className="cursor-pointer font-semibold">
          칸 순서 정하기{counts.unplaced > 0 && <span className="ml-2 text-sm font-normal text-accent">순번이 없는 책 {counts.unplaced}권</span>}
        </summary>
        <p className="mt-2 text-sm text-muted">
          범위 안의 칸마다 1부터 순번을 다시 매깁니다. 순번이 바뀐 책은 &lsquo;다시 뽑을 라벨&rsquo;이 됩니다. 새로 등록하거나 옮긴 책은 그 칸의 맨 뒤 번호를 자동으로 받습니다.
        </p>
        <ActionForm action={assignShelfOrder} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="scope" value={scope ?? ''} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="filter" value={filter} />
          <input type="hidden" name="size" value={size.id} />
          <div>
            <label htmlFor="lb-mode" className="label">정렬 기준</label>
            <select id="lb-mode" name="mode" defaultValue={counts.never + counts.stale + counts.ok === 0 ? 'series' : 'keep'} className="input">
              {(Object.keys(SHELF_ORDER_LABEL) as ShelfOrderMode[]).map((m) => (
                <option key={m} value={m}>
                  {SHELF_ORDER_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary">{scope ? '이 범위의 순서 정하기' : '집 전체 순서 정하기'}</button>
        </ActionForm>
      </details>

      {kind === 'books' && books.length === 0 ? (
        <p className="card text-sm text-muted">
          {counts.unplaced > 0 ? '먼저 칸 순서를 정해 주세요.' : filter === 'todo' ? '뽑을 라벨이 없습니다. 모든 책에 최신 라벨이 붙어 있어요.' : '조건에 맞는 라벨이 없습니다.'}
        </p>
      ) : kind === 'shelves' && tags.length === 0 ? (
        <p className="card text-sm text-muted">이 범위에 칸이 없습니다. 설정에서 책장 아래에 칸을 만들어 주세요.</p>
      ) : (
        <LabelStudio kind={kind} books={books} tags={tags} sizeId={size.id} qrBase={qrBase} printHref={`/labels/print?${qs}`} />
      )}
    </div>
  )
}
