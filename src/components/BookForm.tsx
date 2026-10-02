'use client'

import { useActionState, useCallback, useState } from 'react'
import Link from 'next/link'
import BookCover from './BookCover'
import BarcodeScanner from './BarcodeScanner'

type Result = { ok: true; message?: string } | { ok: false; error: string } | null

export interface BookValues {
  isbn13: string
  title: string
  authors: string
  publisher: string
  pubYear: string
  kdc: string
  category: string
  coverUrl: string
  description: string
  ageGroup: 'ADULT' | 'CHILD'
  seriesName: string
  volumeNo: string
  tags: string
  needsReview?: boolean
}

export const EMPTY_BOOK: BookValues = {
  isbn13: '', title: '', authors: '', publisher: '', pubYear: '', kdc: '', category: '미분류',
  coverUrl: '', description: '', ageGroup: 'ADULT', seriesName: '', volumeNo: '', tags: '',
}

interface Candidate {
  isbn13: string | null
  title: string
  authors: string
  publisher: string
  pubYear: number | null
  coverUrl: string | null
  description: string | null
  kdc?: string | null
  category?: string
}

export default function BookForm({
  mode,
  action,
  initial,
  categories,
  seriesNames,
  shelves = [],
  members = [],
  defaultOwnerId,
}: {
  mode: 'create' | 'edit'
  action: (prev: Result, form: FormData) => Promise<Result>
  initial: BookValues
  categories: string[]
  seriesNames: string[]
  shelves?: { id: string; label: string }[]
  members?: { id: string; name: string }[]
  defaultOwnerId?: string
}) {
  const [v, setV] = useState<BookValues>(initial)
  const [state, formAction, pending] = useActionState(action, null)
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)
  const [existing, setExisting] = useState<{ id: string; title: string } | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [scanning, setScanning] = useState(false)
  const set = (k: keyof BookValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }))

  const apply = (c: Candidate) =>
    setV((p) => ({
      ...p,
      isbn13: c.isbn13 ?? p.isbn13,
      title: c.title || p.title,
      authors: c.authors || p.authors,
      publisher: c.publisher || p.publisher,
      pubYear: c.pubYear ? String(c.pubYear) : p.pubYear,
      coverUrl: c.coverUrl ?? p.coverUrl,
      description: c.description ?? p.description,
      kdc: c.kdc ?? p.kdc,
      category: c.category && c.category !== '미분류' ? c.category : p.category,
    }))

  const lookupIsbn = useCallback(async (isbn: string) => {
    setLookupMsg('조회 중…')
    setExisting(null)
    setCandidates([])
    const res = await fetch(`/api/lookup?isbn=${encodeURIComponent(isbn)}`)
    const data = await res.json()
    if (!res.ok) return setLookupMsg(data.error ?? '조회 실패')
    setV((p) => ({ ...p, isbn13: data.isbn13 }))
    if (data.existing) setExisting(data.existing)
    if (data.book) {
      apply(data.book)
      setLookupMsg('서지 정보를 채웠습니다. 확인 후 저장하세요.')
    } else {
      setLookupMsg(
        data.configured
          ? '서지 정보를 찾지 못했습니다. 직접 입력해 주세요.'
          : '서지 API 키가 설정되지 않아 자동 채우기를 할 수 없습니다. 직접 입력해 주세요.',
      )
    }
  }, [])

  const searchTitle = async () => {
    const q = [v.title, v.authors].filter(Boolean).join(' ')
    if (!q) return setLookupMsg('제목을 먼저 입력하세요.')
    setLookupMsg('검색 중…')
    const res = await fetch(`/api/lookup?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setCandidates(data.items ?? [])
    setLookupMsg(
      !data.configured ? '카카오 API 키가 없어 제목 검색을 할 수 없습니다.' : data.items?.length ? '맞는 책을 고르세요.' : '검색 결과가 없습니다.',
    )
  }

  const onDetected = useCallback(
    (isbn: string) => {
      setScanning(false)
      lookupIsbn(isbn)
    },
    [lookupIsbn],
  )

  return (
    <form action={formAction} className="space-y-4">
      {scanning && <BarcodeScanner onDetected={onDetected} onClose={() => setScanning(false)} />}

      <div className="card space-y-3">
        <div>
          <label className="label" htmlFor="isbn13">ISBN</label>
          <div className="flex gap-2">
            <input id="isbn13" name="isbn13" value={v.isbn13} onChange={set('isbn13')} className="input" inputMode="numeric" placeholder="978…" />
            <button type="button" className="btn-ghost shrink-0" onClick={() => v.isbn13 && lookupIsbn(v.isbn13)}>
              조회
            </button>
            <button type="button" className="btn-ghost shrink-0" onClick={() => setScanning(true)}>
              바코드
            </button>
          </div>
        </div>
        {lookupMsg && <p className="text-sm text-muted">{lookupMsg}</p>}
        {existing && mode === 'create' && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
            이미 등록된 책입니다(<Link className="underline" href={`/books/${existing.id}`}>{existing.title}</Link>). 저장하면 서지는
            그대로 두고 소장본만 추가됩니다.
          </p>
        )}
        {candidates.length > 0 && (
          <ul className="max-h-72 space-y-1 overflow-auto">
            {candidates.map((c, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border border-line p-2 text-left text-sm hover:bg-paper"
                  onClick={() => {
                    setCandidates([])
                    if (c.isbn13) lookupIsbn(c.isbn13)
                    else apply(c)
                  }}
                >
                  <BookCover title={c.title} coverUrl={c.coverUrl} size="sm" />
                  <span>
                    <b>{c.title}</b>
                    <br />
                    <span className="text-muted">{[c.authors, c.publisher, c.pubYear].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="flex justify-center sm:block">
          <BookCover title={v.title || '표지'} coverUrl={v.coverUrl || null} size="lg" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">제목 *</label>
            <div className="flex gap-2">
              <input id="title" name="title" value={v.title} onChange={set('title')} className="input" required />
              <button type="button" className="btn-ghost shrink-0" onClick={searchTitle}>
                제목으로 찾기
              </button>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="authors">저자</label>
            <input id="authors" name="authors" value={v.authors} onChange={set('authors')} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="publisher">출판사</label>
            <input id="publisher" name="publisher" value={v.publisher} onChange={set('publisher')} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="category">분야</label>
            <input id="category" name="category" value={v.category} onChange={set('category')} className="input" list="category-list" />
            <datalist id="category-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="ageGroup">대상</label>
            <select id="ageGroup" name="ageGroup" value={v.ageGroup} onChange={set('ageGroup')} className="input">
              <option value="ADULT">어른 책</option>
              <option value="CHILD">어린이 책</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="seriesName">시리즈</label>
            <input id="seriesName" name="seriesName" value={v.seriesName} onChange={set('seriesName')} className="input" list="series-list" placeholder="예: 메이지 이중언어그림책" />
            <datalist id="series-list">
              {seriesNames.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="volumeNo">권차</label>
              <input id="volumeNo" name="volumeNo" value={v.volumeNo} onChange={set('volumeNo')} className="input" inputMode="numeric" />
            </div>
            <div>
              <label className="label" htmlFor="pubYear">출간연도</label>
              <input id="pubYear" name="pubYear" value={v.pubYear} onChange={set('pubYear')} className="input" inputMode="numeric" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="tags">태그(쉼표로 구분)</label>
            <input id="tags" name="tags" value={v.tags} onChange={set('tags')} className="input" placeholder="예: 고전, 선물받음" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="description">소개</label>
            <textarea id="description" name="description" value={v.description} onChange={set('description')} className="input min-h-20" />
          </div>
          <details className="text-sm sm:col-span-2">
            <summary className="cursor-pointer text-muted">표지 URL · KDC</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input name="coverUrl" value={v.coverUrl} onChange={set('coverUrl')} className="input" placeholder="https://…" />
              <input name="kdc" value={v.kdc} onChange={set('kdc')} className="input" placeholder="KDC 예: 325.04" />
            </div>
          </details>
          {mode === 'edit' && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="needsReview" defaultChecked={v.needsReview} /> 확인 필요(사진 판독 등으로 들어와 아직 검토 전)
            </label>
          )}
        </div>
      </div>

      {mode === 'create' && (
        <div className="card grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">꽂을 위치</label>
            <select name="locationId" className="input" defaultValue="">
              <option value="">위치 미지정(나중에 서가에서 지정)</option>
              {shelves.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">소유자</label>
            <select name="ownerId" className="input" defaultValue={defaultOwnerId ?? ''}>
              <option value="">가족 공용</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">권수</label>
            <input name="copies" type="number" min={1} max={10} defaultValue={1} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-4">
            <input type="checkbox" name="lendable" defaultChecked /> 대여 가능(나중에 빌려줄 수 있는 책)
          </label>
        </div>
      )}

      {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-brand">{state.message}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn-primary px-6" disabled={pending}>
          {pending ? '저장 중…' : mode === 'create' ? '등록' : '저장'}
        </button>
      </div>
    </form>
  )
}
