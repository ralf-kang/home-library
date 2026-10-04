/**
 * 안내 영상(Codex 제작, src/img/video → public/img/video).
 * 규칙(src/img/README.md · docs/web-publishing/video-example.tsx.txt):
 *  - 사용자가 재생할 때만: controls, preload="none", 자동 재생·반복 없음(동작 줄이기 사용자는 포스터만 보게 됨)
 *  - 무음 영상이므로 한국어 자막(VTT)과 HTML 대본을 함께 제공
 *  - 영상·자막은 같은 출처(/img/video)에서 제공. next/image 로 불러오지 않는다.
 */
const VIDEOS = {
  story: {
    file: 'landing-family-library-story',
    title: '우리집 서재 소개(12초)',
    transcript: [
      '집 안의 책을 한곳에 모아 가족의 서재를 만듭니다.',
      '완독과 별점, 마음에 남은 문장을 가족의 독서 기록으로 남깁니다.',
      '나누고 싶은 책을 공개하고 동네 이웃과 함께 읽습니다.',
    ],
  },
  photoGuide: {
    file: 'add-photo-three-step-guide',
    title: '책장 사진 등록, 세 단계(12초)',
    transcript: [
      '책장 한 칸을 정면에서 촬영합니다. 책등 전체가 선명하게 보이도록 밝은 곳에서 찍습니다.',
      '판독한 목록의 제목·ISBN·중복 여부를 확인하고 수정합니다. 책을 꽂을 위치도 확인합니다.',
      '확인한 책만 서재에 등록합니다. 서버 저장 완료 표시를 확인합니다.',
    ],
  },
} as const

export default function GuideVideo({ name, className = '' }: { name: keyof typeof VIDEOS; className?: string }) {
  const v = VIDEOS[name]
  const base = `/img/video/${v.file}`
  const id = `video-${v.file}`
  return (
    <figure className={`m-0 space-y-2 ${className}`} aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="text-sm font-semibold">
        {v.title}
      </p>
      <video
        controls
        playsInline
        preload="none"
        width={1280}
        height={720}
        poster={`${base}-poster.webp`}
        aria-describedby={`${id}-transcript`}
        className="block aspect-video h-auto w-full rounded-2xl bg-brand-soft"
      >
        <source src={`${base}-720p.webm`} type="video/webm" />
        <source src={`${base}-720p.mp4`} type="video/mp4" />
        <track src={`${base}-ko.vtt`} kind="captions" srcLang="ko" label="한국어" default />
      </video>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">영상 내용 읽기(무음 영상)</summary>
        <ol id={`${id}-transcript`} className="mt-1 list-decimal space-y-0.5 pl-5">
          {v.transcript.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </details>
    </figure>
  )
}
