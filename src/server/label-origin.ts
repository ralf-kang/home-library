import 'server-only'
import { headers } from 'next/headers'

/**
 * 라벨 QR 에 찍을 주소. 종이에 영구히 남으므로 공개 주소(APP_URL)를 우선한다.
 * 단 APP_URL 이 localhost(랩의 구글 로그인 터널용)면 휴대폰으로 열 수 없으므로 지금 접속한 주소를 쓴다.
 * 운영에서는 LABEL_QR_BASE 로 고정할 수 있다(도메인을 바꿀 계획이 있으면 짧고 바뀌지 않을 주소로).
 */
export async function labelQrBase(): Promise<string> {
  const fixed = process.env.LABEL_QR_BASE || process.env.APP_URL
  if (fixed && !/\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(fixed)) return fixed.replace(/\/+$/, '')
  const h = await headers()
  const host = h.get('x-forwarded-host')?.split(',')[0].trim() || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto')?.split(',')[0].trim() || 'http'
  return `${proto}://${host}`
}
