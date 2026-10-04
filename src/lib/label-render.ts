/**
 * 라벨 그리기(브라우저 canvas). 인쇄 창 경로와 블루투스 직접 출력이 같은 그림을 쓴다.
 * 감열 프린터는 흑백 1비트라서 흰 바탕 + 검정만 쓰고, QR 은 모듈을 정수 픽셀 사각형으로 그려 번지지 않게 한다.
 * 해상도는 203dpi ≈ 8 dot/mm (lib/labels.ts DOTS_PER_MM).
 */
import QRCode from 'qrcode'
import { DOTS_PER_MM, shortTitle, type LabelSize } from './labels'

const FONT = '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif'

export interface BookLabelData {
  fullCode: string
  shelfPos: number
  title: string
  volumeNo: number | null
  seq: number
  qrUrl: string
}

export interface ShelfTagData {
  code: string
  name: string
  zone: string | null
}

function setup(canvas: HTMLCanvasElement, size: LabelSize) {
  canvas.width = size.widthMm * DOTS_PER_MM
  canvas.height = size.heightMm * DOTS_PER_MM
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'alphabetic'
  return ctx
}

/** 주어진 폭에 들어가는 가장 큰 글자 크기로 한 줄을 쓴다. 반환: 사용한 글자 높이(px). */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, maxPx: number, weight = 700, minPx = 10) {
  let px = maxPx
  for (; px > minPx; px--) {
    ctx.font = `${weight} ${px}px ${FONT}`
    if (ctx.measureText(text).width <= maxW) break
  }
  ctx.font = `${weight} ${px}px ${FONT}`
  ctx.fillText(text, x, y)
  return px
}

function drawQr(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, box: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  const quiet = 1 // 라벨 가장자리 여백이 있어 조용한 영역은 1모듈만
  const cell = Math.max(1, Math.floor(box / (n + quiet * 2)))
  const offset = Math.floor((box - cell * n) / 2)
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) ctx.fillRect(x + offset + c * cell, y + offset + r * cell, cell, cell)
    }
  }
  return cell * n
}

/**
 * 책 라벨.
 *  - 작은 책등(제목 없음): [QR(전체 높이)] [위치 코드 / 큰 순번]
 *  - 그 밖: 위 [QR] [위치 코드 / 큰 순번], 아래 한 줄 전체 폭 [짧은 제목 … 관리번호] — 제목이 읽히는 크기를 확보한다.
 */
export function renderBookLabel(canvas: HTMLCanvasElement, d: BookLabelData, size: LabelSize) {
  const ctx = setup(canvas, size)
  const W = canvas.width
  const H = canvas.height
  const m = Math.round(1.5 * DOTS_PER_MM)
  const pos = String(d.shelfPos).padStart(2, '0')
  if (!size.showTitle) {
    const qrBox = H - m * 2
    drawQr(ctx, d.qrUrl, m, m, qrBox)
    const x = m * 2 + qrBox
    const w = W - x - m
    // 위 줄(위치 코드)과 아래 줄(순번)이 겹치지 않게 세로 공간을 나눈다
    const avail = H - m * 2
    const gap = Math.max(2, Math.round(avail * 0.06))
    const h1 = fitText(ctx, d.fullCode, x, m + Math.round(avail * 0.3), w, Math.round(avail * 0.3))
    fitText(ctx, pos, x, H - m, w, avail - h1 - gap, 800)
    return canvas
  }
  const top = Math.round(H * 0.64)
  const qr2 = top - m
  drawQr(ctx, d.qrUrl, m, m, qr2)
  const rx = m * 2 + qr2
  const rw = W - rx - m
  fitText(ctx, d.fullCode, rx, m + Math.round(top * 0.3), rw, Math.round(H * 0.17))
  fitText(ctx, pos, rx, top - Math.round(H * 0.02), rw, Math.round(H * 0.34), 800)
  const code = `HL-${String(d.seq).padStart(6, '0')}`
  ctx.font = `500 ${Math.round(H * 0.075)}px ${FONT}`
  const codeW = ctx.measureText(code).width
  const baseline = H - m
  fitText(ctx, code, W - m - codeW, baseline, codeW + 1, Math.round(H * 0.075), 500, 8)
  fitText(ctx, shortTitle(d.title, d.volumeNo, 16), m, baseline, W - m * 3 - codeW, Math.round(H * 0.2), 700, 12)
  return canvas
}

/** 칸 이름표: 큰 위치 코드 + 경로 이름 + 구역(선반 앞면에 붙인다). */
export function renderShelfTag(canvas: HTMLCanvasElement, t: ShelfTagData, size: LabelSize) {
  const ctx = setup(canvas, size)
  const W = canvas.width
  const H = canvas.height
  const m = Math.round(1.5 * DOTS_PER_MM)
  const w = W - m * 2
  fitText(ctx, t.code, m, m + Math.round(H * 0.42), w, Math.round(H * 0.46), 800)
  fitText(ctx, t.name, m, m + Math.round(H * 0.68), w, Math.round(H * 0.16), 500)
  if (t.zone) {
    // 구역은 검은 띠 위 흰 글자(색 라벨 대신 흑백으로 구분)
    const bandH = Math.round(H * 0.2)
    ctx.fillRect(0, H - bandH, W, bandH)
    ctx.fillStyle = '#ffffff'
    fitText(ctx, t.zone, m, H - Math.round(bandH * 0.28), w, Math.round(bandH * 0.72), 700, 8)
    ctx.fillStyle = '#000000'
  }
  return canvas
}
