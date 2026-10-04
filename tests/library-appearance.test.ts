import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_APPEARANCE, appearanceSchema, readLibraryAppearance, appearanceStyle } from '../src/lib/library-appearance'

const mocks = vi.hoisted(() => ({ requireMember: vi.fn(), updateMany: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/server/auth', () => ({ requireMember: mocks.requireMember }))
vi.mock('@/lib/db', () => ({ prisma: { member: { updateMany: mocks.updateMany } } }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
import { saveLibraryAppearance } from '../src/server/actions/library-appearance'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireMember.mockResolvedValue({ user: { id: 'u1' }, member: { id: 'm1', role: 'CHILD' }, household: { id: 'h1' } })
  mocks.updateMany.mockResolvedValue({ count: 1 })
})

describe('personal appearance data boundary', () => {
  it('rejects arbitrary CSS, URLs and extra tenant identifiers', () => {
    expect(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, theme: 'url(https://example.test)' }).success).toBe(false)
    expect(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, cover: '../../private' }).success).toBe(false)
    expect(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, memberId: 'other' }).success).toBe(false)
    expect(appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, heading: '가'.repeat(41) }).success).toBe(false)
  })
  it('recovers missing, corrupt and future-version stored data without exposing CSS', () => {
    for (const input of [null, undefined, 'bad', { ...DEFAULT_APPEARANCE, version: 2 }]) {
      expect(readLibraryAppearance(input)).toEqual(DEFAULT_APPEARANCE)
      expect(appearanceStyle(readLibraryAppearance(input))['--color-brand' as keyof ReturnType<typeof appearanceStyle>]).toBe('#2f5d50')
    }
  })
  it('only updates the signed-in membership, scoped to the active household', async () => {
    const result = await saveLibraryAppearance('h1', { ...DEFAULT_APPEARANCE, heading: '  조용한 독서 시간  ', theme: 'indigo' })
    expect(result.ok).toBe(true)
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: 'm1', userId: 'u1', householdId: 'h1' }, data: { libraryAppearance: { ...DEFAULT_APPEARANCE, heading: '조용한 독서 시간', theme: 'indigo' } } })
    expect(mocks.revalidate).toHaveBeenCalledWith('/', 'layout')
  })
  it('rejects stale tabs after household switching without writing', async () => {
    expect((await saveLibraryAppearance('old-household', DEFAULT_APPEARANCE)).ok).toBe(false)
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
  it('does not write invalid payloads or bypass authentication', async () => {
    expect((await saveLibraryAppearance('h1', { ...DEFAULT_APPEARANCE, finish: 'script' })).ok).toBe(false)
    mocks.requireMember.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
    await expect(saveLibraryAppearance('h1', DEFAULT_APPEARANCE)).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
  it('reports revoked membership and storage failures without success revalidation', async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 })
    expect((await saveLibraryAppearance('h1', DEFAULT_APPEARANCE)).ok).toBe(false)
    mocks.updateMany.mockRejectedValueOnce(new Error('private connection details'))
    const result = await saveLibraryAppearance('h1', DEFAULT_APPEARANCE)
    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toContain('private connection')
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
})
