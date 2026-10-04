'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { DEFAULT_APPEARANCE, LIBRARY_THEMES, SHELF_FINISHES, appearanceStyle, type LibraryAppearance } from '@/lib/library-appearance'
import { saveLibraryAppearance } from '@/server/actions/library-appearance'
import LibraryCover from './LibraryCover'
import { LIBRARY_COVERS } from './covers'

export default function LibraryCustomizer({ householdId, householdName, initial }: { householdId: string; householdName: string; initial: LibraryAppearance }) {
  const [draft, setDraft] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  function change<K extends keyof LibraryAppearance>(key: K, value: LibraryAppearance[K]) {
    setDraft(current => ({ ...current, [key]: value }))
    setMessage('')
    setError(false)
  }
  function save() {
    startTransition(async () => {
      try {
        const result = await saveLibraryAppearance(householdId, draft)
        if (!result.ok) { setError(true); setMessage(result.error); return }
        setDraft(result.appearance)
        setSaved(result.appearance)
        setError(false)
        setMessage('나의 서재 꾸미기를 저장했습니다. 서가와 대시보드에 적용되었습니다.')
        router.refresh()
      } catch {
        setError(true)
        setMessage('연결을 확인하고 다시 저장해 주세요. 선택한 내용은 유지됩니다.')
      }
    })
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-semibold text-brand">{householdName}</p><h1 className="mt-1 text-3xl font-bold">나의 서재 꾸미기</h1><p className="mt-2 max-w-xl text-sm text-muted">좋아하는 분위기를 고르고 미리 보세요. 이 서재에서 내 계정에만 적용되며 다른 가족의 화면은 바뀌지 않습니다.</p></div>
        <Link href="/shelves" className="btn-ghost" onClick={event => { if (dirty && !window.confirm('저장하지 않은 꾸미기가 있습니다. 서가로 돌아갈까요?')) event.preventDefault() }}>서가로 돌아가기</Link>
      </div>
      <form onSubmit={event => { event.preventDefault(); save() }} className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <fieldset disabled={pending} className="min-w-0 space-y-5 disabled:opacity-70">
          <legend className="sr-only">꾸미기 옵션</legend>
          <fieldset className="card"><legend className="px-1 font-semibold">1. 테마 색상</legend><div className="grid grid-cols-3 gap-2">{Object.entries(LIBRARY_THEMES).map(([key, theme]) => <label key={key} className={`cursor-pointer rounded-xl border p-3 text-center ${draft.theme === key ? 'border-brand bg-brand-soft ring-1 ring-brand' : 'border-line'}`}><input type="radio" name="theme" value={key} checked={draft.theme === key} onChange={() => change('theme', key as LibraryAppearance['theme'])} className="mb-2 accent-brand" /><span aria-hidden className="mx-auto mb-2 block h-7 w-7 rounded-full" style={{ background: theme.brand }} /><span className="text-xs font-medium">{theme.label}</span></label>)}</div></fieldset>
          <fieldset className="card"><legend className="px-1 font-semibold">2. 대표 이미지</legend><label className="mb-3 flex cursor-pointer items-center gap-2 text-sm"><input type="radio" name="cover" value="none" checked={draft.cover === 'none'} onChange={() => change('cover', 'none')} className="accent-brand" />이미지 없이 깔끔하게</label><div className="grid grid-cols-2 gap-3">{Object.entries(LIBRARY_COVERS).map(([key, cover]) => <label key={key} className={`overflow-hidden rounded-xl border ${draft.cover === key ? 'border-brand ring-2 ring-brand' : 'border-line'}`}><Image src={cover.image} alt="" sizes="160px" className="aspect-[16/9] w-full object-cover" /><span className="flex min-h-11 cursor-pointer items-center gap-2 px-2 py-2 text-xs"><input type="radio" name="cover" value={key} checked={draft.cover === key} onChange={() => change('cover', key as LibraryAppearance['cover'])} className="accent-brand" />{cover.label}</span></label>)}</div></fieldset>
          <fieldset className="card"><legend className="px-1 font-semibold">3. 선반 재질</legend><div className="grid grid-cols-3 gap-2">{Object.entries(SHELF_FINISHES).map(([key, finish]) => <label key={key} className="cursor-pointer rounded-lg border border-line p-2 text-center"><span className="mb-2 block h-8 rounded border-b-4" style={{ background: finish.surface, borderColor: finish.edge }} /><input type="radio" name="finish" value={key} checked={draft.finish === key} onChange={() => change('finish', key as LibraryAppearance['finish'])} className="mr-1 accent-brand" /><span className="text-xs">{finish.label}</span></label>)}</div></fieldset>
          <fieldset className="card space-y-3"><legend className="px-1 font-semibold">4. 책 배치</legend><label className="flex items-center gap-2 text-sm"><input type="radio" name="density" checked={draft.density === 'comfortable'} onChange={() => change('density', 'comfortable')} className="accent-brand" />여유롭게 · 표지를 크게</label><label className="flex items-center gap-2 text-sm"><input type="radio" name="density" checked={draft.density === 'compact'} onChange={() => change('density', 'compact')} className="accent-brand" />촘촘하게 · 한눈에 더 많이</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.showTitles} onChange={e => change('showTitles', e.target.checked)} className="accent-brand" />큰 화면에서도 책 제목 표시</label><p className="text-xs text-muted">작은 화면에서는 책을 알아보기 쉽도록 제목을 항상 표시합니다.</p></fieldset>
          <div className="card"><label htmlFor="library-heading" className="mb-2 block font-semibold">5. 나만의 환영 문구</label><input id="library-heading" className="input" value={draft.heading} onChange={e => change('heading', e.target.value)} maxLength={40} placeholder={householdName} aria-describedby="heading-help" /><p id="heading-help" className="mt-2 text-xs text-muted">{draft.heading.length}/40자 · 비워 두면 서재 이름을 표시합니다. 실제 서재 이름은 바뀌지 않습니다.</p></div>
        </fieldset>
        <div className="space-y-3 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">미리보기 <span className="ml-2 text-xs font-normal text-muted">저장 전에는 내 미리보기에만 적용됩니다.</span></h2>
          <div className="library-surface overflow-hidden rounded-2xl border border-line bg-paper p-4 text-ink sm:p-6" style={appearanceStyle(draft)} data-density={draft.density} data-titles={draft.showTitles}>
            <LibraryCover appearance={draft} householdName={householdName} />
            <div className="my-5 flex items-center justify-between gap-2"><h3 className="text-lg font-bold">나의 책장</h3><span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">표지 배치 예시</span></div>
            <ul className="library-shelf-row">{['오늘의 책', '오래 읽는 책', '함께 읽는 책', '다시 펼칠 책', '기억할 책', '다음 책'].map((title, i) => <li key={title} className="min-w-0"><div className="flex aspect-[2/3] items-center justify-center rounded-r-md border-l-4 p-2 shadow-sm" style={{ background: ['#2f5d50','#91b3a2','#b5651d','#687d94','#806b5a','#d8c5a4'][i], borderColor: '#0002' }}><span className="text-center text-xs font-semibold text-white drop-shadow">{title}</span></div><p className="shelf-book-title mt-2 text-xs">{title}</p></li>)}</ul>
            <p className="mt-4 text-xs text-muted">예시 표지입니다. 실제 책·독서 기록·책 위치는 그대로 유지됩니다.</p>
          </div>
        </div>
        <div className="card sticky bottom-20 z-10 space-y-3 shadow-lg sm:bottom-4 lg:col-span-2">
          <p role={error ? 'alert' : 'status'} aria-live="polite" className={`text-sm ${error ? 'text-red-700' : 'text-muted'}`}>{message || (dirty ? '저장하지 않은 변경 사항이 있습니다.' : '저장한 꾸미기가 적용되어 있습니다.')}</p>
          <div className="flex flex-wrap gap-2"><button type="submit" className="btn-primary" disabled={pending || !dirty}>{pending ? '저장 중…' : '꾸미기 저장'}</button><button type="button" className="btn-ghost" disabled={pending || !dirty} onClick={() => { setDraft(saved); setMessage('변경 사항을 취소했습니다.'); setError(false) }}>변경 취소</button><button type="button" className="btn-ghost" disabled={pending} onClick={() => { setDraft({ ...DEFAULT_APPEARANCE }); setMessage('기본 꾸미기로 미리 보기를 되돌렸습니다. 저장하면 적용됩니다.'); setError(false) }}>기본 꾸미기</button></div>
        </div>
      </form>
    </div>
  )
}
