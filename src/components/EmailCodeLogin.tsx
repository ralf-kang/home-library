'use client'

import { useState } from 'react'
import { FAMILY_ROLE_LABEL, FAMILY_ROLES, type FamilyRole } from '@/lib/family-auth'

/** 남편/아내 선택 → 인증 코드 메일 발송 → 6자리 코드 확인. 주소는 서버만 안다. */
export default function EmailCodeLogin({ next }: { next?: string }) {
  const [step, setStep] = useState<'send' | 'verify'>('send')
  const [role, setRole] = useState<FamilyRole | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function post(url: string, body: object): Promise<{ ok: boolean; data: { message?: string; redirect?: string } }> {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, data }
  }

  async function sendCode() {
    if (!role) return
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const { ok, data } = await post('/api/auth/send-code', { role })
      if (!ok) setError(data.message ?? '요청을 처리할 수 없습니다.')
      else {
        setInfo(data.message ?? '인증 코드를 메일로 보냈습니다.')
        setStep('verify')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!role || code.length !== 6) return
    setLoading(true)
    setError(null)
    try {
      const { ok, data } = await post('/api/auth/verify-code', { role, code, next })
      if (ok && data.redirect) {
        window.location.assign(data.redirect)
        return
      }
      setError(data.message ?? '코드가 올바르지 않거나 만료되었습니다.')
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      {step === 'send' ? (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">누구로 로그인하시나요?</p>
            <div className="grid grid-cols-2 gap-2">
              {FAMILY_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={
                    role === r
                      ? 'min-h-11 rounded-[10px] border border-brand bg-brand px-3 text-sm font-semibold text-white'
                      : 'min-h-11 rounded-[10px] border border-line bg-white px-3 text-sm hover:bg-paper'
                  }
                >
                  {FAMILY_ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={sendCode} disabled={loading || !role} className="btn-primary w-full disabled:opacity-50">
            {loading ? '발송 중…' : '인증 코드 발송'}
          </button>
        </>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          {role && (
            <p className="text-center text-sm text-muted">
              <strong className="text-ink">{FAMILY_ROLE_LABEL[role]}</strong>님 메일로 보낸 6자리 코드를 입력하세요.
            </p>
          )}
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            aria-label="인증 코드 6자리"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoFocus
            autoComplete="one-time-code"
            disabled={loading}
            className="input text-center font-mono text-lg tracking-[0.4em]"
          />
          <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full disabled:opacity-50">
            {loading ? '확인 중…' : '확인'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setStep('send')
              setCode('')
              setError(null)
              setInfo(null)
            }}
            className="w-full text-sm text-muted underline underline-offset-4 hover:text-ink"
          >
            코드 다시 받기
          </button>
        </form>
      )}
      {info && !error && <p className="text-center text-sm text-muted">{info}</p>}
      {error && (
        <p role="alert" className="rounded-[10px] bg-red-50 px-3 py-2 text-center text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
