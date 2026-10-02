import 'server-only'

/** FormData 헬퍼 — 빈 문자열은 null로 취급한다. */
export function s(form: FormData, key: string): string | null {
  const v = form.get(key)
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

export function n(form: FormData, key: string): number | null {
  const v = s(form, key)
  if (v == null) return null
  const num = Number(v)
  return Number.isFinite(num) ? num : null
}

export function d(form: FormData, key: string): Date | null {
  const v = s(form, key)
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return new Date(`${v}T00:00:00.000Z`)
}

export function b(form: FormData, key: string): boolean {
  const v = form.get(key)
  return v === 'on' || v === 'true' || v === '1'
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }
