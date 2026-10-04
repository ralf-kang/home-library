import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { d4lRegionCode, isClosedOn, splitRegion } = await import('../src/lib/public-data')

describe('공공데이터 보조 함수', () => {
  it('지역명 → 시도·시군구', () => {
    expect(splitRegion('경기도 성남시 분당구 정자동')).toEqual({ sido: '경기도', sigungu: '성남시 분당구' })
    expect(splitRegion('서울특별시 강남구')).toEqual({ sido: '서울특별시', sigungu: '강남구' })
    expect(splitRegion('')).toBeNull()
  })
  it('정보나루 지역 코드', () => {
    expect(d4lRegionCode('경기도 성남시 분당구')).toBe('31')
    expect(d4lRegionCode('서울특별시 강남구')).toBe('11')
    expect(d4lRegionCode('경상남도 창원시')).toBe('38')
  })
  it('휴관일 판정', () => {
    const monday = new Date('2026-10-05T10:00:00+09:00') // 월요일
    expect(isClosedOn('매주 월요일, 법정공휴일', monday)).toBe(true)
    expect(isClosedOn('월, 공휴일', monday)).toBe(true)
    expect(isClosedOn('매주 화요일', monday)).toBe(false)
    expect(isClosedOn('연중무휴', monday)).toBe(false)
  })
})
