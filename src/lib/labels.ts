/**
 * 서가 라벨(청구기호) 규칙 — 순수 함수(테스트 대상).
 *
 * 청구기호 = {위치 전체코드} · {칸 안 순번 2자리}  예) LV-B2-S3 · 07
 * 순번은 '칸 안에서 꽂는 순서'다. 라벨을 출력 순서대로 붙이고 그 순서대로 꽂으면 서가가 정리된다.
 */

export function callNumber(fullCode: string | null | undefined, shelfPos: number | null | undefined): string | null {
  if (!fullCode || !shelfPos || shelfPos < 1) return null
  return `${fullCode} · ${String(shelfPos).padStart(2, '0')}`
}

/** 인쇄한 적이 있는데 지금 청구기호와 다르면 다시 뽑아야 한다(위치·순번이 바뀜). */
export function isStale(current: string | null, printed: string | null | undefined): boolean {
  return Boolean(printed) && current !== printed
}

export type LabelState = 'never' | 'stale' | 'ok' | 'unplaced'

export function labelState(current: string | null, printed: string | null | undefined): LabelState {
  if (!current) return 'unplaced'
  if (!printed) return 'never'
  return current === printed ? 'ok' : 'stale'
}

export const LABEL_STATE_TEXT: Record<LabelState, string> = {
  never: '아직 안 뽑음',
  stale: '다시 뽑아야 함',
  ok: '붙임',
  unplaced: '위치·순번 없음',
}

/** 위치 코드 자연 정렬: LV-B2-S9 < LV-B2-S10 (숫자 구간을 수로 비교). */
export function compareCode(a: string, b: string): number {
  return a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' })
}

// ── 칸 순서 정하기 ─────────────────────────────────────────────────────────

export type ShelfOrderMode = 'keep' | 'title' | 'author' | 'category' | 'series'

export const SHELF_ORDER_LABEL: Record<ShelfOrderMode, string> = {
  keep: '지금 순서 유지(빈 번호 채움)',
  title: '제목순',
  author: '저자순',
  category: '분야 → 제목순',
  series: '시리즈·권차순',
}

export interface OrderItem {
  id: string
  shelfPos: number | null
  seq: number
  title: string
  authors: string
  category: string
  series: string | null
  volumeNo: number | null
}

const ko = (a: string, b: string) => a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' })

/** 한 칸 안의 소장본에 1부터 순번을 다시 매긴다. 반환: id → 새 순번. */
export function renumber(items: OrderItem[], mode: ShelfOrderMode): Map<string, number> {
  const sorted = [...items].sort((a, b) => {
    switch (mode) {
      case 'keep':
        // 순번 있는 것 먼저(기존 순서), 없는 것은 등록 순서대로 뒤에
        return (a.shelfPos ?? Infinity) - (b.shelfPos ?? Infinity) || a.seq - b.seq
      case 'title':
        return ko(a.title, b.title) || a.seq - b.seq
      case 'author':
        return ko(a.authors || '￿', b.authors || '￿') || ko(a.title, b.title) || a.seq - b.seq
      case 'category':
        return ko(a.category, b.category) || ko(a.title, b.title) || a.seq - b.seq
      case 'series':
        // 시리즈끼리 모으고 권차 순, 시리즈 없는 책은 제목순으로 뒤에
        return (
          ko(a.series ?? '￿', b.series ?? '￿') ||
          (a.volumeNo ?? Infinity) - (b.volumeNo ?? Infinity) ||
          ko(a.title, b.title) ||
          a.seq - b.seq
        )
    }
  })
  return new Map(sorted.map((it, i) => [it.id, i + 1]))
}

// ── 라벨 크기 ─────────────────────────────────────────────────────────────

export interface LabelSize {
  id: string
  name: string
  widthMm: number
  heightMm: number
  /** 제목을 넣을 공간이 있는지(작은 책등 라벨은 청구기호+QR만) */
  showTitle: boolean
  hint: string
}

export const LABEL_SIZES: LabelSize[] = [
  { id: '50x30', name: '50×30mm', widthMm: 50, heightMm: 30, showTitle: true, hint: 'Niimbot B1 기본 · 뒤표지·면지' },
  { id: '40x30', name: '40×30mm', widthMm: 40, heightMm: 30, showTitle: true, hint: '뒤표지·면지' },
  { id: '40x20', name: '40×20mm', widthMm: 40, heightMm: 20, showTitle: true, hint: '책등 아래·뒤표지' },
  { id: '30x15', name: '30×15mm', widthMm: 30, heightMm: 15, showTitle: false, hint: '얇은 책등(청구기호+QR)' },
]

export function labelSize(id: string | null | undefined): LabelSize {
  return LABEL_SIZES.find((s) => s.id === id) ?? LABEL_SIZES[0]
}

/** 감열 라벨 프린터 해상도 203dpi ≈ 8 dot/mm */
export const DOTS_PER_MM = 8

/** 라벨에 넣을 짧은 제목(권차 포함, 최대 n자). */
export function shortTitle(title: string, volumeNo: number | null, max = 14): string {
  const vol = volumeNo != null && !new RegExp(`${volumeNo}\\s*(권)?$`).test(title) ? ` ${volumeNo}권` : ''
  const t = title.replace(/\s+/g, ' ').trim()
  const room = Math.max(4, max - vol.length)
  return (t.length > room ? `${t.slice(0, room - 1)}…` : t) + vol
}

/** 소장본 관리번호 HL-000123 의 숫자 → QR 짧은 주소 /c/123 */
export function copyShortPath(seq: number): string {
  return `/c/${seq}`
}
