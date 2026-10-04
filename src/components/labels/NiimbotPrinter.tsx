'use client'

/**
 * Niimbot 라벨 프린터 블루투스 직접 출력(실험적).
 * - 웹 블루투스: PC·안드로이드의 Chrome/Edge 만 지원(아이폰 Safari 불가). HTTPS 또는 localhost 에서만 동작.
 * - 라이브러리 @mmote/niimbluelib(MIT)는 README 에 '교육 목적, 제조사 동의 없는 상업적 이용 비의도'라고 밝힌다
 *   → 기본 경로는 OS 인쇄 창이고, 이 기능은 선택(실험적)으로 둔다. 버튼을 누를 때만 동적으로 불러온다.
 * - 라벨은 lib/label-render.ts 로 그린 canvas 를 그대로 인코딩하므로 인쇄 창 경로와 같은 그림이 나간다.
 * - 한 장이 끝날 때마다 onPrinted 로 알려 '인쇄 완료'를 기록한다(중간에 끊겨도 이어서 뽑을 수 있게).
 */
import { useRef, useState } from 'react'

export interface PrintJob {
  id: string
  render: (canvas: HTMLCanvasElement) => void
}

type Status = 'idle' | 'connecting' | 'printing' | 'done' | 'stopped' | 'error'

export default function NiimbotPrinter({ jobs, onPrinted }: { jobs: PrintJob[]; onPrinted: (ids: string[]) => Promise<void> }) {
  const [status, setStatus] = useState<Status>('idle')
  const [done, setDone] = useState(0)
  const [message, setMessage] = useState('')
  const stop = useRef(false)
  const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator
  const secure = typeof window !== 'undefined' && window.isSecureContext

  async function run() {
    stop.current = false
    setDone(0)
    setStatus('connecting')
    setMessage('프린터를 고르는 창에서 Niimbot 프린터를 선택해 주세요.')
    let client: { disconnect(): Promise<void>; protocol: { printEnd(): Promise<boolean> } } | null = null
    try {
      const lib = await import('@mmote/niimbluelib')
      const c = new lib.NiimbotBluetoothClient()
      client = c
      await c.connect()
      const meta = c.getModelMetadata()
      const taskName = c.getPrintTaskType() ?? 'B1'
      const direction = meta?.printDirection ?? 'left'
      setStatus('printing')
      setMessage(`${meta?.model ?? '프린터'} 연결됨. 출력 순서대로 뽑습니다.`)
      const task = c.protocol.newPrintTask(taskName, { totalPages: jobs.length, density: meta?.densityDefault ?? 3 })
      await task.printInit()
      const canvas = document.createElement('canvas')
      for (let i = 0; i < jobs.length; i++) {
        if (stop.current) break
        jobs[i].render(canvas)
        const encoded = lib.ImageEncoder.encodeCanvas(canvas, lib.PageColorType.SingleColor, direction)
        await task.printPage(encoded, 1)
        await task.waitForPageFinished()
        await onPrinted([jobs[i].id])
        setDone(i + 1)
      }
      if (!stop.current) await task.waitForFinished()
      setStatus(stop.current ? 'stopped' : 'done')
      setMessage(stop.current ? '중지했습니다. 다시 누르면 남은 라벨부터 이어서 뽑습니다.' : '모두 뽑았습니다. 출력 순서대로 책에 붙이고 칸에 꽂아 주세요.')
    } catch (e) {
      setStatus('error')
      setMessage(`출력하지 못했습니다: ${(e as Error).message}. 프린터 전원·라벨지·거리를 확인하고 다시 시도해 주세요.`)
    } finally {
      try {
        await client?.protocol.printEnd()
        await client?.disconnect()
      } catch {
        /* 연결이 이미 끊긴 경우 */
      }
    }
  }

  if (!supported || !secure) {
    return (
      <p className="rounded-[10px] bg-paper p-3 text-xs text-muted">
        블루투스 직접 출력은 PC·안드로이드의 Chrome/Edge 에서 HTTPS 주소로 열었을 때만 쓸 수 있습니다
        {!secure && '(지금은 보안 연결이 아님)'}. 아이폰은 &lsquo;인쇄 창으로 출력&rsquo;(PDF 저장 후 Niimbot 앱에서 인쇄)을 이용해 주세요.
      </p>
    )
  }
  const busy = status === 'connecting' || status === 'printing'
  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-accent/50 bg-white p-4">
      <p className="text-xs font-semibold text-accent">실험적 기능 · Niimbot 블루투스 직접 출력</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" disabled={busy || jobs.length === 0} onClick={run}>
          {busy ? '출력 중…' : `블루투스로 ${jobs.length}장 출력`}
        </button>
        {busy && (
          <button type="button" className="btn-ghost" onClick={() => (stop.current = true)}>
            중지
          </button>
        )}
      </div>
      {status !== 'idle' && (
        <div aria-live="polite" className="space-y-1">
          <div className="h-2 overflow-hidden rounded bg-brand-soft" role="progressbar" aria-valuemin={0} aria-valuemax={jobs.length} aria-valuenow={done}>
            <div className="h-2 bg-brand transition-[width]" style={{ width: `${jobs.length ? (done / jobs.length) * 100 : 0}%` }} />
          </div>
          <p className={`text-xs ${status === 'error' ? 'text-red-700' : 'text-muted'}`}>
            {done}/{jobs.length}장 · {message}
          </p>
        </div>
      )}
    </div>
  )
}
