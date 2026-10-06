'use client'

import { useActionState, useEffect, useRef } from 'react'

type Result = { ok: true; message?: string } | { ok: false; error: string } | null

/**
 * 서버 액션 폼 + 결과 메시지 표시. 성공 시 resetOnSuccess면 입력을 비운다.
 * action은 (prev, form) => Promise<Result> 형태(필요하면 .bind로 인자를 묶어서 넘긴다).
 */
export default function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (prev: Result, form: FormData) => Promise<Result>
  children: React.ReactNode
  className?: string
  resetOnSuccess?: boolean
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset()
  }, [state, resetOnSuccess])
  return (
    <form ref={ref} action={formAction} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state && (
        <p className={`mt-2 text-sm ${state.ok ? 'text-brand' : 'text-red-700'}`} role="status">
          {state.ok ? state.message : state.error}
        </p>
      )}
    </form>
  )
}
