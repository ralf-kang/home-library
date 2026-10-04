import Link from 'next/link'
import { DEFAULT_CATEGORIES } from '@/lib/format'
import { isClaudeConfigured } from '@/lib/claude'
import { isKakaoConfigured } from '@/lib/book-lookup'
import { requireCan } from '@/server/auth'
import { listMembers, loadLocations, shelfOptions } from '@/server/queries'
import { Photo } from '@/components/Art'
import GuideVideo from '@/components/GuideVideo'
import PhotoImport from './PhotoImport'

export default async function PhotoImportPage({ searchParams }: { searchParams: Promise<{ loc?: string }> }) {
  const { member: me, household } = await requireCan('book.write')
  const { loc: preset } = await searchParams
  const [loc, members] = await Promise.all([loadLocations(household.id), listMembers(household.id)])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">서가 사진으로 일괄 등록</h1>
        <Link href="/add" className="text-sm text-muted underline">
          한 권씩 등록
        </Link>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>책을 꽂을 칸을 고릅니다(사진 속 책이 이 칸으로 등록됩니다).</li>
        <li>그 칸의 책등을 정면에서 한 장 찍습니다. 칸 하나씩 찍어야 글자가 잘 읽힙니다.</li>
        <li>AI가 읽은 목록을 확인·수정하고 등록합니다. 새 책은 &lsquo;확인 필요&rsquo; 표시가 붙습니다.</li>
      </ol>
      {/* 촬영 안내: 구도 사진(16:9, 최대 480px) + 3단계 안내 영상(사용자 재생) */}
      <section className="card grid items-start gap-5 md:grid-cols-2">
        <figure className="m-0 space-y-2">
          <Photo name="framing" sizes="(max-width: 767px) calc(100vw - 64px), 480px" className="aspect-video max-w-[480px] rounded-2xl object-cover" />
          <figcaption className="text-xs text-muted">책장 한 칸을 정면에서, 책등 글자가 모두 보이게 찍어 주세요. 그늘·반사를 피하면 더 잘 읽힙니다.</figcaption>
        </figure>
        <GuideVideo name="photoGuide" />
      </section>
      {!isClaudeConfigured() ? (
        <p className="card text-sm text-amber-900">
          서버에 <code>ANTHROPIC_API_KEY</code>가 설정되지 않아 사진 판독을 쓸 수 없습니다. <Link href="/add" className="underline">한 권씩 등록</Link>은 그대로
          쓸 수 있습니다.
        </p>
      ) : (
        <PhotoImport
          shelves={shelfOptions(loc)}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          categories={DEFAULT_CATEGORIES}
          defaultOwnerId={me.id}
          presetLocationId={preset}
          kakao={isKakaoConfigured()}
        />
      )}
    </div>
  )
}
