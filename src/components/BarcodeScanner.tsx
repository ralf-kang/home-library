'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 휴대폰 카메라로 ISBN(EAN-13) 바코드를 읽는다.
 * 브라우저 내장 BarcodeDetector가 있으면 그것을, 없으면(iOS Safari 등) ZXing을 쓴다.
 * 카메라 접근은 HTTPS(또는 localhost)에서만 허용된다.
 */
export default function BarcodeScanner({ onDetected, onClose }: { onDetected: (isbn: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let zxingControls: { stop: () => void } | null = null

    const finish = (text: string) => {
      const digits = text.replace(/\D/g, '')
      if (/^97[89]\d{10}$/.test(digits) && !stopped) {
        stopped = true
        onDetected(digits)
      }
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('이 브라우저에서는 카메라를 쓸 수 없습니다. HTTPS 주소로 접속했는지 확인하거나 ISBN을 직접 입력하세요.')
        return
      }
      const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
      try {
        if (Detector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          const video = videoRef.current!
          video.srcObject = stream
          await video.play()
          const detector = new Detector({ formats: ['ean_13'] })
          const tick = async () => {
            if (stopped) return
            try {
              const codes = await detector.detect(video)
              if (codes[0]) finish(codes[0].rawValue)
            } catch {
              /* 프레임 준비 전 */
            }
            if (!stopped) setTimeout(tick, 250)
          }
          tick()
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          const reader = new BrowserMultiFormatReader()
          zxingControls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
            if (result) finish(result.getText())
          })
        }
      } catch (e) {
        setError(`카메라를 열 수 없습니다: ${(e as Error).message}`)
      }
    }
    start()
    return () => {
      stopped = true
      stream?.getTracks().forEach((t) => t.stop())
      zxingControls?.stop()
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4">
      <video ref={videoRef} className="w-full max-w-md rounded-lg bg-black" muted playsInline />
      <p className="text-sm text-white">책 뒷표지의 ISBN 바코드(978…)를 화면에 맞춰 주세요.</p>
      {error && <p className="max-w-md text-center text-sm text-red-300">{error}</p>}
      <button type="button" className="btn-ghost" onClick={onClose}>
        닫기
      </button>
    </div>
  )
}
