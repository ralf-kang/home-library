import Link from 'next/link'

export const SERVICE_NAME = '우리집 서재'
export const CONTACT_EMAIL = 'ralfkang@outlook.com'
export const COPYRIGHT_YEAR = 2026

/** 로그인 전 공개 페이지 상단. 데스크톱 높이 80px, 모바일 68px(메뉴 숨김, 시작하기만). */
export function PublicHeader() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="wrap flex min-h-[68px] items-center gap-3 md:min-h-20 md:gap-8">
        <Link href="/" className="flex items-center gap-2.5 text-base font-bold whitespace-nowrap md:text-[19px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={30} height={30} className="h-[30px] w-[30px]" />
          {SERVICE_NAME}
        </Link>
        <nav aria-label="주 메뉴" className="ml-auto hidden items-center gap-6 text-sm text-muted md:flex">
          <Link href="/#how" className="hover:text-ink">사용 방법</Link>
          <Link href="/#features" className="hover:text-ink">기능</Link>
          <Link href="/#neighbors" className="hover:text-ink">가족·동네</Link>
          <Link href="/pricing" className="hover:text-ink">요금</Link>
        </nav>
        <Link href="/login" className="btn-primary ml-auto md:ml-0">시작하기</Link>
      </div>
    </header>
  )
}

/** 모든 공개 페이지 하단: 서비스 정보·저작권·약관·문의처·공공데이터 출처. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="wrap pt-10 pb-6">
        <div className="grid gap-6 text-xs text-muted md:grid-cols-[1.5fr_1fr_1fr] md:gap-10">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{SERVICE_NAME}</p>
            <p>가족의 책과 독서 기록을 함께 관리하고, 동네 이웃과 책을 나누는 독서 플랫폼입니다.</p>
            <p>
              개발·운영 문의: <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">서비스</p>
            <ul className="space-y-1.5">
              <li><Link href="/#how" className="hover:text-ink">사용 방법</Link></li>
              <li><Link href="/pricing" className="hover:text-ink">요금 안내</Link></li>
              <li><Link href="/terms" className="hover:text-ink">이용약관</Link></li>
              <li><Link href="/privacy" className="font-semibold text-ink hover:underline">개인정보처리방침</Link></li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">데이터 출처</p>
            <p className="leading-relaxed">
              도서 정보: 카카오 책 검색, 국립중앙도서관, 도서관 정보나루, Google Books.
              공공데이터: 공공데이터포털(data.go.kr) — 공공누리 및 각 제공기관의 이용 조건을 따릅니다.
            </p>
          </div>
        </div>
        <p className="mt-8 border-t border-line pt-5 text-[11px] leading-relaxed text-muted">
          © {COPYRIGHT_YEAR} {SERVICE_NAME}. All rights reserved. 이 서비스의 소프트웨어·디자인·문서의 저작권은 개발자에게 있으며,
          가족이 등록한 기록(독후감·메모·사진)의 권리는 작성한 이용자에게 있습니다. 소개 사진은 연출 이미지입니다.
        </p>
      </div>
    </footer>
  )
}

/** 구글 로그인 버튼(구글 브랜드 가이드의 흰 바탕·G 로고 형태). */
export function GoogleSignInButton({ next, label = '구글 계정으로 계속하기' }: { next?: string; label?: string }) {
  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : '/api/auth/google'
  return (
    <a
      href={href}
      className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-[10px] border border-[#dadce0] bg-white px-4 py-2.5 text-sm font-medium text-[#3c4043] shadow-sm transition hover:bg-[#f8f9fa]"
    >
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      {label}
    </a>
  )
}
