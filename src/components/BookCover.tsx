const PALETTE = ['#2f5d50', '#8a5a44', '#4b5d8a', '#7a6a2f', '#5e4b7a', '#2f6a7a', '#7a2f4b']

function hash(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

/**
 * 표지가 있으면 이미지, 없으면 제목으로 만든 색 블록.
 * size='fill' 은 부모 너비를 채우는 2:3 비율(서가 표지 그리드용).
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
  const cls =
    size === 'sm' ? 'h-16 w-11' : size === 'lg' ? 'h-48 w-32' : size === 'fill' ? 'aspect-[2/3] w-full' : 'h-24 w-16'
  if (coverUrl) {
    // 외부 표지 URL(카카오·국립중앙도서관)이라 next/image 원격 허용 설정 없이 <img>를 쓴다.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={coverUrl} alt="" loading="lazy" className={`${cls} shrink-0 rounded object-cover shadow-sm ring-1 ring-black/5`} />
  }
  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center overflow-hidden rounded p-1 text-center leading-tight font-semibold text-white shadow-sm ${size === 'fill' ? 'p-2 text-xs' : 'text-[10px]'}`}
      style={{ background: PALETTE[hash(title) % PALETTE.length] }}
    >
      {title.slice(0, size === 'fill' ? 30 : 14)}
    </div>
  )
}
