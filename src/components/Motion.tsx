'use client'

/**
 * 모션 에셋(src/img/motion) — 필요한 순간에만 1회 재생(설계서 06 모션 설계).
 *  - 책장 촬영 안내 3.6초: 사용자가 '촬영 안내 보기'를 눌렀을 때만. 판독 진행률·결과를 나타내지 않는다.
 *  - 저장 완료 0.9초: 서버 저장 성공이 확인된 뒤에만. 문구는 aria-live 로 함께 알린다.
 * 동작 줄이기(prefers-reduced-motion) 설정이면 정지 그림을 보여 준다(SVG 안에서도 애니메이션을 끈다).
 * SVG 모션은 원본을 그대로 쓴다(이미지 최적화 미사용).
 */
import { useEffect, useState } from 'react'
import scanPoster from '@/img/motion/add-photo-scan-poster.svg'
import scanOnce from '@/img/motion/add-photo-scan-once.svg'
import savePoster from '@/img/motion/book-save-success-poster.svg'
import saveOnce from '@/img/motion/book-save-success-once.svg'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ShelfPhotoGuide() {
  const [playing, setPlaying] = useState(false)
  const [run, setRun] = useState(0)
  const [message, setMessage] = useState('책장 한 칸의 책등을 정면에서, 글자가 선명하게 보이도록 찍어 주세요.')
  function play() {
    if (prefersReducedMotion()) {
      setPlaying(false)
      setMessage('동작 줄이기 설정에 따라 정지 안내를 보여 드립니다. 책등이 모두 보이게 한 칸씩 정면에서 찍어 주세요.')
      return
    }
    setRun((n) => n + 1) // 같은 SVG 를 다시 1회 재생하려면 새로 마운트한다
    setPlaying(true)
    setMessage('촬영 안내를 보여 드립니다. 판독이 끝나면 책 목록을 직접 확인하고 고친 뒤 등록하세요.')
  }
  return (
    <figure className="card flex flex-col items-center gap-3 p-5 sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={playing ? `motion-${run}` : 'poster'}
        src={playing ? scanOnce.src : scanPoster.src}
        width={240}
        height={160}
        alt="책장 한 칸의 책등을 정면에서 촬영하는 안내"
        className="h-auto w-full max-w-[240px] shrink-0"
      />
      <figcaption className="space-y-2 text-sm">
        <p aria-live="polite" className="text-muted">
          {message}
        </p>
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
          <li>정면에서, 칸 하나씩</li>
          <li>책등 글자가 흐리지 않게(그늘·반사 피하기)</li>
          <li>판독은 틀릴 수 있어요 — 등록 전에 제목을 확인</li>
        </ul>
        <button type="button" className="btn-ghost" onClick={playing ? () => setPlaying(false) : play}>
          {playing ? '정지 그림으로 보기' : '촬영 안내 보기'}
        </button>
      </figcaption>
    </figure>
  )
}

/** 저장 성공(서버 응답 확인 후)에만 렌더할 것. 64px 체크 + 알림 문구. */
export function SaveSuccess({ message }: { message: string }) {
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    // 마운트 후 한 번만 설정을 읽는다(서버 렌더와 첫 화면은 정지 그림)
    const t = setTimeout(() => setReduced(prefersReducedMotion()), 0)
    return () => clearTimeout(t)
  }, [])
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl bg-brand-soft p-3 text-sm font-medium text-brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={reduced ? savePoster.src : saveOnce.src} width={48} height={48} alt="" className="h-12 w-12 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
