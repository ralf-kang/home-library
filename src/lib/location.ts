import type { Location, Zone } from '@prisma/client'

export type LocationNode = Pick<Location, 'id' | 'kind' | 'code' | 'name' | 'parentId' | 'sortOrder' | 'zoneId'> & {
  zone?: Pick<Zone, 'id' | 'name' | 'color'> | null
}

/** id → 위치 맵에서 상위를 따라 올라가며 "LV-B2-S3" 같은 전체 코드를 만든다. */
export function fullCode(id: string, byId: Map<string, LocationNode>): string {
  const parts: string[] = []
  let cur = byId.get(id)
  let guard = 0
  while (cur && guard++ < 10) {
    parts.unshift(cur.code)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return parts.join('-')
}

/** "거실 › 2번 책장 › 3칸" 같은 사람이 읽는 경로. */
export function fullName(id: string, byId: Map<string, LocationNode>): string {
  const parts: string[] = []
  let cur = byId.get(id)
  let guard = 0
  while (cur && guard++ < 10) {
    parts.unshift(cur.name)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return parts.join(' › ')
}

/** 칸(또는 그 상위)에 걸린 구역을 찾는다 — 칸에 없으면 책장, 공간 순으로 올라간다. */
export function effectiveZone(id: string, byId: Map<string, LocationNode>) {
  let cur = byId.get(id)
  let guard = 0
  while (cur && guard++ < 10) {
    if (cur.zone) return cur.zone
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return null
}

export function buildLocationIndex(locations: LocationNode[]) {
  const byId = new Map(locations.map((l) => [l.id, l]))
  const children = new Map<string | null, LocationNode[]>()
  for (const l of locations) {
    const key = l.parentId ?? null
    const list = children.get(key) ?? []
    list.push(l)
    children.set(key, list)
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, 'ko', { numeric: true }))
  }
  return { byId, children }
}

/** 하위 위치 id 전체(자기 자신 포함). 책장을 고르면 그 아래 칸의 책까지 모두 찾기 위해 쓴다. */
export function descendantIds(id: string, children: Map<string | null, LocationNode[]>): string[] {
  const out = [id]
  for (const c of children.get(id) ?? []) out.push(...descendantIds(c.id, children))
  return out
}
