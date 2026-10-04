'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import BookCover from '@/components/BookCover'

type Item = { id: string; title: string; authors: string; coverUrl: string | null; volumeNo: number | null; reason: string | null; via: 'google' | 'ai' }
type State = { status: 'idle' | 'loading' | 'done' | 'error'; items: Item[]; googleHits?: number; aiUsed?: boolean; error?: string }

/**
 * "📖 내용으로 더 찾기" — 제목·저자·메모 검색 결과가 적을 때(조건부) 자동으로, 아니면 버튼으로
 * /api/content-search 를 불러 우리 서재 안에서 내용이 관련된 책을 보여 준다.
 */
export default function ContentSearch({ q, auto }: { q: string; auto: boolean }) {
  const [s, setS] = useState<State>({ status: 'idle', items: [] })

  async function run() {
    setS({ status: 'loading', items: [] })
    try {
      const res = await fetch(`/api/content-search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '검색 실패')
      setS({ status: 'done', items: data.items, googleHits: data.googleHits, aiUsed: data.aiUsed })
    } catch (e) {
      setS({ status: 'error', items: [], error: (e as Error).message })
    }
  }

  useEffect(() => {
    if (!auto || q.trim().length < 2) return
    // 렌더 직후 비동기로 시작(effect 안에서 동기 setState 금지). q 가 바뀔 때만 다시 실행.
    const t = setTimeout(() => void run(), 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, auto])

  if (q.trim().length < 2) return null
  return (
    <section className="card space-y-3 border-brand/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">📖 내용으로 찾기</h2>
          <p className="text-xs text-muted">책 본문·소개에 &lsquo;{q}&rsquo;이(가) 나오는 책을 Google Books에서 찾아, 우리 서재에 있는 책만 골라 보여 줍니다.</p>
        </div>
        {s.status !== 'loading' && (
          <button type="button" onClick={run} className="btn-ghost">
            {s.status === 'idle' ? '내용으로 더 찾기' : '다시 찾기'}
          </button>
        )}
      </div>
      {s.status === 'loading' && <p className="text-sm text-muted">찾는 중…</p>}
      {s.status === 'error' && <p className="text-sm text-red-700">{s.error}</p>}
      {s.status === 'done' &&
        (s.items.length === 0 ? (
          <p className="text-sm text-muted">
            내용이 관련된 책을 우리 서재에서 찾지 못했습니다(Google Books 결과 {s.googleHits ?? 0}건 중 일치 없음).
            {!s.aiUsed && ' 한국 도서는 Google Books 수록이 적어 결과가 없을 수 있습니다.'}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {s.items.map((b) => (
              <li key={b.id}>
                <Link href={`/books/${b.id}`} className="flex gap-3 rounded-lg p-2 hover:bg-paper">
                  <BookCover title={b.title} coverUrl={b.coverUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {b.title}
                      {b.volumeNo != null && <span className="ml-1 text-muted">{b.volumeNo}권</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{b.authors}</p>
                    {b.reason && <p className="line-clamp-2 text-xs text-ink/80">{b.reason}</p>}
                    <p className="text-[10px] text-muted">{b.via === 'google' ? 'Google Books 본문 검색' : 'AI 사서 판단'}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}
