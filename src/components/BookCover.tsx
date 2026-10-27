'use client'

import { useState } from 'react'
import coverUnavailable from '@/img/illustrations/book-cover-unavailable.svg'

/**
 * 책 표지. 실제 표지 URL 이 있으면 2:3 프레임에 보여 주고, URL 이 없거나 불러오지 못하면(404 등)
 * 공통 '표지 없음' 그림(src/img/illustrations/book-cover-unavailable.svg)으로 바꾼다.
 * 그림에는 글자를 넣지 않았으므로 제목은 HTML 텍스트로 겹쳐 보여 준다(서가에서 책을 알아볼 수 있게).
 * size='fill' 은 부모 너비를 채운다(서가 표지 그리드용).
 */
export default function BookCover({
  title,
  coverUrl,
  size = 'md',
}: {
  title: string
  coverUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'fill'
}) {
  const [failed, setFailed] = useState(false)
  const cls =
    size === 'sm' ? 'h-16 w-11' : size === 'lg' ? 'h-60 w-40' : size === 'fill' ? 'aspect-[2/3] w-full' : 'h-24 w-16'
  if (coverUrl && !failed) {
    return (
      // 외부 표지 URL(카카오·국립중앙도서관·정보나루)이라 next/image 원격 허용 설정 없이 <img>를 쓴다.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${cls} shrink-0 rounded-md bg-white object-contain shadow-sm ring-1 ring-black/5`}
      />
    )
  }
  const showTitle = size !== 'sm'
  return (
    <div className={`${cls} relative shrink-0 overflow-hidden rounded-md shadow-sm`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverUnavailable.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {showTitle && (
        <span
          className={`absolute inset-x-0 bottom-0 line-clamp-3 bg-gradient-to-t from-brand-soft via-brand-soft/95 to-transparent pt-4 pr-1.5 pb-1.5 pl-3 leading-tight font-semibold text-brand ${
            size === 'fill' || size === 'lg' ? 'text-xs' : 'text-[10px]'
          }`}
        >
          {title}
        </span>
      )}
    </div>
  )
}
