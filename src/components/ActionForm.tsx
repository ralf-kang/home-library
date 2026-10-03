'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

type Result = { ok: true; message?: string; link?: string } | { ok: false; error: string } | null

/**
 * 서버 액션 폼 + 결과 메시지 표시. 성공 시 resetOnSuccess면 입력을 비운다.
 * action은 (prev, form) => Promise<Result> 형태(필요하면 .bind로 인자를 묶어서 넘긴다).
 * 결과에 link가 있으면(초대 링크 등) 복사 버튼과 함께 보여 준다.
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
        <div className="mt-2 w-full space-y-2" role="status">
          <p className={`text-sm ${state.ok ? 'text-brand' : 'text-red-700'}`}>{state.ok ? state.message : state.error}</p>
          {state.ok && state.link && <CopyLink link={state.link} />}
        </div>
      )}
    </form>
  )
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={link} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="btn-ghost shrink-0"
        onClick={async () => {
          await navigator.clipboard?.writeText(link).catch(() => {})
          setCopied(true)
        }}
      >
        {copied ? '복사됨' : '복사'}
      </button>
    </div>
  )
}
