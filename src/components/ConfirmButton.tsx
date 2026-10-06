'use client'

import { useTransition } from 'react'

/** 확인창을 띄운 뒤 서버 액션을 실행하는 버튼(삭제 등). 결과 메시지가 있으면 alert로 알린다. */
export default function ConfirmButton({
  action,
  confirm,
  children,
  className = 'btn-danger',
}: {
  action: () => Promise<unknown>
  confirm: string
  children: React.ReactNode
  className?: string
}) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirm)) return
        start(async () => {
          const r = (await action()) as { ok?: boolean; error?: string } | undefined
          if (r && r.ok === false && r.error) window.alert(r.error)
        })
      }}
    >
      {pending ? '처리 중…' : children}
    </button>
  )
}
