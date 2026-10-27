'use client'

import { useEffect, useState, useTransition } from 'react'
import { DOTS_PER_MM, labelSize } from '@/lib/labels'
import { renderBookLabel, renderShelfTag, type ShelfTagData } from '@/lib/label-render'
import { markLabelsPrinted } from '@/server/actions/labels'

type Book = { copyId: string; seq: number; title: string; volumeNo: number | null; fullCode: string; shelfPos: number }

/** 라벨을 canvas 로 그려 한 장씩 페이지로 배치하고, 다 그려지면 인쇄 창을 연다. */
export default function PrintSheet({
  kind,
  books,
  tags,
  sizeId,
  qrBase,
}: {
  kind: 'books' | 'shelves'
  books: Book[]
  tags: (ShelfTagData & { id: string })[]
  sizeId: string
  qrBase: string
}) {
  const size = labelSize(sizeId)
  const [pages, setPages] = useState<string[]>([])
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      const canvas = document.createElement('canvas')
      const out =
        kind === 'books'
          ? books.map((b) => {
              renderBookLabel(canvas, { ...b, qrUrl: `${qrBase}/c/${b.seq}` }, size)
              return canvas.toDataURL('image/png')
            })
          : tags.map((tg) => {
              renderShelfTag(canvas, tg, size)
              return canvas.toDataURL('image/png')
            })
      setPages(out)
    }, 0)
    return () => clearTimeout(t)
  }, [kind, books, tags, size, qrBase])

  useEffect(() => {
    if (pages.length === 0) return
    // 이미지가 모두 그려진 뒤 인쇄 창(한 번만)
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [pages.length])

  return (
    <>
      {/* 용지 = 라벨 한 장. 여백 0. 화면에서는 안내 막대와 미리보기 */}
      <style>{`
        @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0 }
        html, body { margin: 0; background: #e9e6df }
        .sheet { width: ${size.widthMm}mm; height: ${size.heightMm}mm; overflow: hidden; background: #fff }
        /* 두 번째 장부터 앞에서 쪽을 나눈다(마지막 장 뒤에 빈 쪽이 생기지 않게) */
        .sheets > .sheet + .sheet { break-before: page; page-break-before: always }
        .sheet img { display: block; width: ${size.widthMm}mm; height: ${size.heightMm}mm; image-rendering: pixelated }
        @media screen { .sheet { margin: 8px auto; box-shadow: 0 1px 3px rgb(0 0 0 / .2) } }
        @media print { .no-print { display: none !important } html, body { background: #fff } }
      `}</style>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-white p-3 text-sm">
        <strong>
          {kind === 'books' ? '책 라벨' : '칸 이름표'} {pages.length}장 · {size.name}
        </strong>
        <span className="text-muted">인쇄 창에서 라벨 프린터(또는 PDF로 저장)를 고르고, 용지 {size.name}·여백 없음·배율 100%로 출력하세요.</span>
        <button type="button" className="btn-primary ml-auto" onClick={() => window.print()} disabled={pages.length === 0}>
          다시 인쇄
        </button>
        {kind === 'books' && (
          <button
            type="button"
            className="btn-ghost"
            disabled={pending || books.length === 0}
            onClick={() =>
              start(async () => {
                const r = await markLabelsPrinted(books.map((b) => b.copyId))
                setMsg(r.ok ? (r.message ?? '기록했습니다.') : r.error)
              })
            }
          >
            인쇄 완료로 표시
          </button>
        )}
        {msg && (
          <span role="status" className="w-full text-brand">
            {msg}
          </span>
        )}
      </div>
      {pages.length === 0 && <p className="no-print p-6 text-center text-sm text-muted">라벨을 그리는 중…</p>}
      <div className="sheets">
      {pages.map((src, i) => (
        <div key={i} className="sheet" data-dots={`${size.widthMm * DOTS_PER_MM}x${size.heightMm * DOTS_PER_MM}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" />
        </div>
      ))}
      </div>
    </>
  )
}
