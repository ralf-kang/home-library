'use client'

import { useActionState, useState } from 'react'
import { login, type LoginState } from './actions'

export default function LoginForm({ members }: { members: { id: string; name: string }[] }) {
  const [memberId, setMemberId] = useState(members.length === 1 ? members[0].id : '')
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {})
  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMemberId(m.id)}
            className={`rounded-lg border px-3 py-3 text-sm font-medium ${
              memberId === m.id ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-white'
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>
      <input type="hidden" name="memberId" value={memberId} />
      <div>
        <label className="label" htmlFor="pin">가족 PIN</label>
        <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password" className="input" required />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending || !memberId}>
        {pending ? '확인 중…' : '들어가기'}
      </button>
    </form>
  )
}
