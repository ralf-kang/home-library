'use client'

/**
 * 라벨 미리보기·출력. 서버가 출력 순서대로 정렬한 목록을 받아
 * (1) 인쇄 창(새 탭의 인쇄 전용 페이지) 또는 (2) Niimbot 블루투스 직접 출력으로 보낸다.
 */
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { labelSize, LABEL_STATE_TEXT, type LabelState } from '@/lib/labels'
import { renderBookLabel, renderShelfTag } from '@/lib/label-render'
import { markLabelsPrinted } from '@/server/actions/labels'
import NiimbotPrinter, { type PrintJob } from './NiimbotPrinter'

export interface StudioBook {
  copyId: string
  seq: number
  title: string
  volumeNo: number | null
  fullCode: string
  shelfPos: number
  callNumber: string
  state: LabelState
}

export interface StudioTag {
  id: string
  code: string
  name: string
  zone: string | null
}

const PREVIEW = 48

export default function LabelStudio({
  kind,
  books,
  tags,
  sizeId,
  qrBase,
  printHref,
}: {
  kind: 'books' | 'shelves'
  books: StudioBook[]
  tags: StudioTag[]
  sizeId: string
  qrBase: string
  printHref: string
}) {
  const size = labelSize(sizeId)
  const jobs: PrintJob[] = useMemo(
    () =>
      kind === 'books'
        ? books.map((b) => ({
            id: b.copyId,
            render: (c: HTMLCanvasElement) =>
              renderBookLabel(c, { fullCode: b.fullCode, shelfPos: b.shelfPos, title: b.title, volumeNo: b.volumeNo, seq: b.seq, qrUrl: `${qrBase}/c/${b.seq}` }, size),
          }))
        : tags.map((t) => ({ id: t.id, render: (c: HTMLCanvasElement) => renderShelfTag(c, t, size) })),
    [kind, books, tags, qrBase, size],
  )
  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    // 렌더는 브라우저에서만(canvas). 많으면 앞부분만 미리보기
    const t = setTimeout(() => {
      const canvas = document.createElement('canvas')
      setPreviews(
        jobs.slice(0, PREVIEW).map((j) => {
          j.render(canvas)
          return canvas.toDataURL('image/png')
        }),
      )
    }, 0)
    return () => clearTimeout(t)
  }, [jobs])

  const router = useRouter()
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const markAll = () =>
    start(async () => {
      const r = await markLabelsPrinted(books.map((b) => b.copyId))
      setConfirming(false)
      if (!r.ok) return setResult(r.error)
      // 기록하면 목록이 다시 그려져(뽑을 라벨에서 빠짐) 이 컴포넌트가 사라질 수 있으므로 결과를 주소로 넘긴다
      const u = new URL(window.location.href)
      u.searchParams.set('marked', String(books.length))
      router.replace(u.pathname + u.search)
    })

  if (jobs.length === 0) return null
  return (
    <section className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="font-semibold">
            출력 순서대로 {jobs.length.toLocaleString()}장 · {size.name}
          </p>
          <p className="text-xs text-muted">
            {kind === 'books' ? '라벨을 뽑힌 순서대로 붙이고, 같은 순서로 칸에 꽂으면 서가가 정리됩니다.' : '칸 이름표는 선반 앞면에 붙입니다.'}
          </p>
        </div>
        <a href={printHref} target="_blank" rel="noopener" className="btn-primary">
          인쇄 창으로 출력(PDF·모든 프린터)
        </a>
        {kind === 'books' &&
          (confirming ? (
            <span className="flex items-center gap-2 text-sm">
              {books.length}장을 붙인 것으로 기록할까요?
              <button type="button" className="btn-primary" disabled={pending} onClick={markAll}>
                기록
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
                취소
              </button>
            </span>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setConfirming(true)}>
              인쇄 완료로 표시
            </button>
          ))}
        {result && (
          <p role="status" className="w-full text-sm text-brand">
            {result}
          </p>
        )}
      </div>

      {kind === 'books' && (
        <NiimbotPrinter
          jobs={jobs}
          onPrinted={async (ids) => {
            await markLabelsPrinted(ids)
          }}
        />
      )}

      <ol className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {jobs.slice(0, PREVIEW).map((j, i) => {
          const b = kind === 'books' ? books[i] : null
          return (
            <li key={j.id} className="flex items-center gap-3 rounded-xl border border-line bg-white p-2">
              <span className="w-9 shrink-0 text-center font-mono text-xs text-muted tabular-nums">{i + 1}</span>
              {previews[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previews[i]}
                  alt={b ? `${b.callNumber} ${b.title} 라벨` : `${tags[i]?.code} 칸 이름표`}
                  className="h-auto max-w-[200px] min-w-0 flex-1 rounded border border-line"
                  style={{ aspectRatio: `${size.widthMm} / ${size.heightMm}`, imageRendering: 'pixelated' }}
                />
              ) : (
                <span className="flex-1 rounded border border-dashed border-line" style={{ aspectRatio: `${size.widthMm} / ${size.heightMm}` }} />
              )}
              {b && b.state === 'stale' && <span className="chip shrink-0 bg-amber-100 text-amber-900">{LABEL_STATE_TEXT.stale}</span>}
            </li>
          )
        })}
      </ol>
      {jobs.length > PREVIEW && <p className="text-xs text-muted">미리보기는 앞 {PREVIEW}장만 보여 줍니다. 출력은 {jobs.length}장 모두 순서대로 나갑니다.</p>}
    </section>
  )
}
