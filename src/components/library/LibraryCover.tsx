import Image from 'next/image'
import type { LibraryAppearance } from '@/lib/library-appearance'
import { LIBRARY_COVERS } from './covers'

export default function LibraryCover({ appearance, householdName }: { appearance: LibraryAppearance; householdName: string }) {
  if (appearance.cover === 'none' && !appearance.heading) return null
  const cover = appearance.cover === 'none' ? null : LIBRARY_COVERS[appearance.cover]
  return (
    <section aria-label="나의 서재 표지" className={`overflow-hidden rounded-2xl border border-line bg-brand-soft ${cover ? 'grid sm:grid-cols-[1fr_1fr]' : ''}`}>
      <div className="flex flex-col justify-center gap-2 p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-widest text-brand">나의 독서 공간</p>
        <p className="text-2xl leading-snug font-bold text-ink">{appearance.heading || householdName}</p>
        <p className="text-sm text-muted">책과 함께, 오늘도 한 페이지.</p>
      </div>
      {cover && <Image src={cover.image} alt="" sizes="(max-width: 639px) calc(100vw - 32px), 520px" className="h-44 w-full object-cover sm:h-56" />}
    </section>
  )
}
