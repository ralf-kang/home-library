/**
 * 웹 퍼블리싱 에셋 연결(src/img, docs/web-publishing). src/img 는 공개 URL 이 아니므로 정적 import 로만 쓴다.
 *
 * 사진은 미리 만든 WebP 해상도 변형(768/1536, 640/1120)으로 srcset 을 직접 만든다 —
 * 런타임 이미지 최적화(sharp)는 Windows 에서 빌드한 standalone 이미지에 Linux 바이너리가 없어 쓰지 않는다.
 * width/height 를 주어 레이아웃 이동(CLS)을 막고, 히어로만 우선 로드(fetchPriority=high), 나머지는 lazy.
 * 장식 그림은 인접 문구와 겹치므로 alt="" (asset-manifest.json 규칙).
 */
import Link from 'next/link'
import heroLg from '@/img/photos/landing-hero-family-reading-1536.webp'
import heroSm from '@/img/photos/landing-hero-family-reading-768.webp'
import authLg from '@/img/photos/auth-reading-nook-1120.webp'
import authSm from '@/img/photos/auth-reading-nook-640.webp'
import shareLg from '@/img/photos/neighborhood-book-sharing-1536.webp'
import shareSm from '@/img/photos/neighborhood-book-sharing-768.webp'
import shelvesEmpty from '@/img/illustrations/shelves-empty-first-book.svg'
import searchEmpty from '@/img/illustrations/search-empty-discovery.svg'
import createLibrary from '@/img/illustrations/onboarding-create-library.svg'
import inviteCircle from '@/img/illustrations/invite-family-circle.svg'
import journalEmpty from '@/img/illustrations/reading-empty-journal.svg'
import coverUnavailable from '@/img/illustrations/book-cover-unavailable.svg'
import scanPoster from '@/img/motion/add-photo-scan-poster.svg'
import icDashboard from '@/img/icons/feature-dashboard.svg'
import icShelves from '@/img/icons/feature-shelves.svg'
import icSearch from '@/img/icons/feature-search.svg'
import icReading from '@/img/icons/feature-reading.svg'
import icRecommend from '@/img/icons/feature-recommend.svg'
import icNeighborhood from '@/img/icons/feature-neighborhood.svg'

type StaticImg = { src: string; width: number; height: number }

const PHOTOS = {
  landing: { sm: heroSm, lg: heroLg, alt: '햇살이 드는 거실에서 함께 책을 읽는 가족' },
  auth: { sm: authSm, lg: authLg, alt: '초록 안락의자와 나무 책장이 있는 햇살 드는 독서 공간' },
  neighbors: { sm: shareSm, lg: shareLg, alt: '동네 이웃끼리 책 두 권을 건네는 모습' },
} satisfies Record<string, { sm: StaticImg; lg: StaticImg; alt: string }>

export type PhotoName = keyof typeof PHOTOS

/** 생성 사진(연출 이미지). 원본 비율 유지(가족·이웃 3:2, 로그인 4:5). */
export function Photo({
  name,
  sizes,
  priority = false,
  className = '',
  decorative = false,
}: {
  name: PhotoName
  sizes: string
  priority?: boolean
  className?: string
  decorative?: boolean
}) {
  const p = PHOTOS[name]
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={p.lg.src}
      srcSet={`${p.sm.src} ${p.sm.width}w, ${p.lg.src} ${p.lg.width}w`}
      sizes={sizes}
      width={p.lg.width}
      height={p.lg.height}
      alt={decorative ? '' : p.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={`block h-auto w-full ${className}`}
    />
  )
}

const ILLUSTRATIONS = {
  shelvesEmpty,
  searchEmpty,
  createLibrary,
  inviteCircle,
  journalEmpty,
  coverUnavailable,
  scanPoster,
} satisfies Record<string, StaticImg>

export type IllustrationName = keyof typeof ILLUSTRATIONS

/** 안내 그림(SVG, contain). 기본은 장식(alt=""). */
export function Illustration({
  name,
  width,
  alt = '',
  className = '',
}: {
  name: IllustrationName
  width: number
  alt?: string
  className?: string
}) {
  const img = ILLUSTRATIONS[name]
  const height = Math.round((width * img.height) / img.width)
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={img.src} width={width} height={height} alt={alt} loading="lazy" className={`h-auto object-contain ${className}`} style={{ maxWidth: '100%' }} />
}

export const COVER_UNAVAILABLE_SRC = coverUnavailable.src

const ICONS = {
  dashboard: icDashboard,
  shelves: icShelves,
  search: icSearch,
  reading: icReading,
  recommend: icRecommend,
  neighborhood: icNeighborhood,
} satisfies Record<string, StaticImg>

export type FeatureIconName = keyof typeof ICONS

/** 기능 카드 아이콘(24~32px). 인접 제목이 있으므로 alt="". */
export function FeatureIcon({ name, size = 28 }: { name: FeatureIconName; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={ICONS[name].src} width={size} height={size} alt="" />
}

/**
 * 빈 화면 안내: 그림 + 상황 설명 + 할 수 있는 다음 행동.
 * 오류·로딩과 구분해서 '정말로 비어 있을 때'만 쓴다(설계서 04 페이지별 설계).
 */
export function EmptyState({
  art,
  title,
  children,
  action,
  width = 240,
}: {
  art: IllustrationName
  title: string
  children?: React.ReactNode
  action?: { href: string; label: string }
  width?: number
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-8 text-center">
      <Illustration name={art} width={width} />
      <p className="mt-2 font-semibold">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {action && (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  )
}
