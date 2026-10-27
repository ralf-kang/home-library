import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { DEFAULT_APPEARANCE } from '../src/lib/library-appearance'

const url = process.env.APPEARANCE_TEST_DATABASE_URL
const safe = url && new URL(url).pathname.startsWith('/hl_appearance_check_')
let db: PrismaClient
let save: typeof import('../src/server/actions/library-appearance').saveLibraryAppearance
let ctx: { user: { id: string }; member: { id: string }; household: { id: string } }
let otherMemberId: string
let sameUserOtherHouseholdId: string

describe.skipIf(!safe)('appearance persistence in isolated PostgreSQL', () => {
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } })
    const a = await db.user.create({ data: { googleSub: 'appearance-a', email: 'a@appearance.test', name: 'A' } })
    const b = await db.user.create({ data: { googleSub: 'appearance-b', email: 'b@appearance.test', name: 'B' } })
    const h1 = await db.household.create({ data: { name: '독립 검증 서재 1' } })
    const h2 = await db.household.create({ data: { name: '독립 검증 서재 2' } })
    const member = await db.member.create({ data: { userId: a.id, householdId: h1.id, name: 'A', role: 'CHILD' } })
    otherMemberId = (await db.member.create({ data: { userId: b.id, householdId: h1.id, name: 'B' } })).id
    sameUserOtherHouseholdId = (await db.member.create({ data: { userId: a.id, householdId: h2.id, name: 'A' } })).id
    ctx = { user: { id: a.id }, member: { id: member.id }, household: { id: h1.id } }
    vi.doMock('@/lib/db', () => ({ prisma: db }))
    vi.doMock('@/server/auth', () => ({ requireMember: async () => ctx }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    save = (await import('../src/server/actions/library-appearance')).saveLibraryAppearance
  })
  afterAll(async () => { await db?.$disconnect() })
  it('persists after reconnection and leaves other family and household settings unchanged', async () => {
    const wanted = { ...DEFAULT_APPEARANCE, theme: 'clay' as const, cover: 'journal' as const, density: 'compact' as const, heading: '나만의 독서 시간' }
    expect((await save(ctx.household.id, wanted)).ok).toBe(true)
    await db.$disconnect()
    expect((await db.member.findUniqueOrThrow({ where: { id: ctx.member.id } })).libraryAppearance).toEqual(wanted)
    expect((await db.member.findUniqueOrThrow({ where: { id: otherMemberId } })).libraryAppearance).toBeNull()
    expect((await db.member.findUniqueOrThrow({ where: { id: sameUserOtherHouseholdId } })).libraryAppearance).toBeNull()
  })
  it('stale household and invalid values cannot overwrite the saved row', async () => {
    const before = await db.member.findUniqueOrThrow({ where: { id: ctx.member.id } })
    expect((await save('another-household', DEFAULT_APPEARANCE)).ok).toBe(false)
    expect((await save(ctx.household.id, { ...DEFAULT_APPEARANCE, cover: 'https://example.test/track' })).ok).toBe(false)
    expect((await db.member.findUniqueOrThrow({ where: { id: ctx.member.id } })).libraryAppearance).toEqual(before.libraryAppearance)
  })
  it('reset stores defaults without modifying household identity or books', async () => {
    const before = await db.household.findUniqueOrThrow({ where: { id: ctx.household.id } })
    expect((await save(ctx.household.id, DEFAULT_APPEARANCE)).ok).toBe(true)
    expect((await db.member.findUniqueOrThrow({ where: { id: ctx.member.id } })).libraryAppearance).toEqual(DEFAULT_APPEARANCE)
    expect(await db.household.findUniqueOrThrow({ where: { id: ctx.household.id } })).toEqual(before)
  })
})
