'use client'

import { useActionState, useState } from 'react'
import { importFromPhoto } from '@/server/actions/import'

interface Spine {
  title: string
  author: string
  publisher: string
  volume: number | null
  confidence: 'high' | 'medium' | 'low'
}

const MAX_EDGE = 2576 // 고해상도 비전 모델의 긴 변 한도 — 더 크게 보내도 서버에서 줄어든다

async function toJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
}

export default function PhotoImport({
  shelves,
  members,
  categories,
  defaultOwnerId,
  presetLocationId,
  kakao,
}: {
  shelves: { id: string; label: string }[]
  members: { id: string; name: string }[]
  categories: string[]
  defaultOwnerId: string
  presetLocationId?: string
  kakao: boolean
}) {
  const [spines, setSpines] = useState<Spine[] | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [state, action, pending] = useActionState(importFromPhoto, null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setErr(null)
    setSpines(null)
    setBusy(true)
    try {
      const image = await toJpegBase64(file)
      setPreview(`data:image/jpeg;base64,${image}`)
      const res = await fetch('/api/scan-shelf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, mediaType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '판독 실패')
      setSpines(data.books)
      if (data.books.length === 0) setErr('읽을 수 있는 책등을 찾지 못했습니다. 더 가까이, 정면에서 다시 찍어 주세요.')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form action={action} className="space-y-4">
      <div className="card grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">칸 *</label>
          <select name="locationId" required defaultValue={presetLocationId ?? ''} className="input">
            <option value="">칸을 고르세요</option>
            {shelves.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">소유자</label>
          <select name="ownerId" defaultValue={defaultOwnerId} className="input">
            <option value="">가족 공용</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">대상</label>
          <select name="ageGroup" className="input" defaultValue="ADULT">
            <option value="ADULT">어른 책</option>
            <option value="CHILD">어린이 책</option>
          </select>
        </div>
        <div>
          <label className="label">분야(비우면 자동 추정)</label>
          <input name="category" list="photo-cats" className="input" />
          <datalist id="photo-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">시리즈(전집 칸이면)</label>
          <input name="seriesName" className="input" placeholder="예: 은하영웅전설" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">사진</label>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} className="input" disabled={busy} />
          {!kakao && <p className="mt-1 text-xs text-muted">카카오 API 키가 없어 ISBN·표지 자동 매칭 없이 제목만 등록됩니다.</p>}
        </div>
      </div>

      {busy && <p className="card text-sm text-muted">AI가 책등을 읽는 중입니다… (보통 20~60초)</p>}
      {err && <p className="text-sm text-red-700">{err}</p>}

      {spines && spines.length > 0 && (
        <div className="card space-y-2">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview && <img src={preview} alt="찍은 사진" className="hidden w-48 rounded sm:block" />}
            <p className="text-sm text-muted">
              {spines.length}권을 읽었습니다. 틀린 글자는 고치고, 책이 아니거나 확신이 낮은 줄은 체크를 해제하세요.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {spines.map((sp, i) => (
              <li key={i} className="grid grid-cols-[auto_1fr_1fr_4rem] items-center gap-2 py-2">
                <input type="checkbox" name="row" value={i} defaultChecked={sp.confidence !== 'low'} aria-label="등록" />
                <input name={`title_${i}`} defaultValue={sp.title} className="input" />
                <input name={`author_${i}`} defaultValue={sp.author} className="input" placeholder="저자" />
                <input name={`volume_${i}`} defaultValue={sp.volume ?? ''} className="input" placeholder="권" inputMode="numeric" />
                {sp.confidence !== 'high' && (
                  <span className={`col-start-2 text-xs ${sp.confidence === 'low' ? 'text-red-700' : 'text-amber-700'}`}>
                    판독 확신도 {sp.confidence === 'low' ? '낮음' : '보통'}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {state && <p className={`text-sm ${state.ok ? 'text-brand' : 'text-red-700'}`}>{state.ok ? state.message : state.error}</p>}
          <button className="btn-primary" disabled={pending}>
            {pending ? '등록 중…(책마다 서지를 찾습니다)' : '고른 책 등록'}
          </button>
        </div>
      )}
    </form>
  )
}
