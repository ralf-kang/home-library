import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '우리집 서재',
  description: '집에 있는 책의 위치·읽기 기록·취향·추천을 관리합니다.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2f5d50',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  )
}
