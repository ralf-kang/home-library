import { describe, expect, it } from 'vitest'
import { callNumber, compareCode, isStale, labelState, renumber, shortTitle, type OrderItem } from '../src/lib/labels'

const item = (id: string, o: Partial<OrderItem> = {}): OrderItem => ({
  id,
  shelfPos: null,
  seq: Number(id.replace(/\D/g, '')) || 0,
  title: id,
  authors: '',
  category: '미분류',
  series: null,
  volumeNo: null,
  ...o,
})

describe('청구기호', () => {
  it('위치 코드 · 2자리 순번', () => {
    expect(callNumber('LV-B2-S3', 7)).toBe('LV-B2-S3 · 07')
    expect(callNumber('LV-B2-S3', 123)).toBe('LV-B2-S3 · 123')
    expect(callNumber(null, 3)).toBeNull()
    expect(callNumber('LV', null)).toBeNull()
  })
  it('다시 뽑을 라벨 판정', () => {
    expect(isStale('LV-B2-S3 · 07', 'LV-B2-S3 · 07')).toBe(false)
    expect(isStale('LV-B2-S4 · 01', 'LV-B2-S3 · 07')).toBe(true)
    expect(isStale('LV-B2-S3 · 07', null)).toBe(false)
    expect(labelState(null, null)).toBe('unplaced')
    expect(labelState('A · 01', null)).toBe('never')
    expect(labelState('A · 02', 'A · 01')).toBe('stale')
  })
  it('위치 코드 자연 정렬(S9 < S10)', () => {
    expect(['LV-B2-S10', 'LV-B2-S9', 'KD-B1-S1'].sort(compareCode)).toEqual(['KD-B1-S1', 'LV-B2-S9', 'LV-B2-S10'])
  })
})

describe('칸 순서 정하기', () => {
  it('지금 순서 유지: 빈 번호를 채우고 새 책은 등록 순으로 뒤에', () => {
    const r = renumber([item('c5', { shelfPos: 7 }), item('c2', { shelfPos: 3 }), item('c9'), item('c8')], 'keep')
    expect([...r.entries()]).toEqual([['c2', 1], ['c5', 2], ['c8', 3], ['c9', 4]])
  })
  it('제목순(한글·숫자 자연 정렬)', () => {
    const r = renumber([item('a', { title: '사피엔스' }), item('b', { title: '1984' }), item('c', { title: '가나다 10' }), item('d', { title: '가나다 9' })], 'title')
    expect([...r.keys()]).toEqual(['b', 'd', 'c', 'a'])
  })
  it('시리즈·권차순: 시리즈끼리 권차 순, 시리즈 없는 책은 뒤', () => {
    const r = renumber(
      [
        item('x', { title: '단행본' }),
        item('m3', { series: '메이지', volumeNo: 3 }),
        item('m1', { series: '메이지', volumeNo: 1 }),
        item('e2', { series: '엘리펀트', volumeNo: 2 }),
      ],
      'series',
    )
    expect([...r.keys()]).toEqual(['m1', 'm3', 'e2', 'x'])
  })
})

describe('라벨 제목', () => {
  it('길면 줄이고 권차를 붙인다(이미 제목에 있으면 중복하지 않음)', () => {
    expect(shortTitle('1Q84 1', 1)).toBe('1Q84 1')
    expect(shortTitle('아몬드', null)).toBe('아몬드')
    expect(shortTitle('가상 면접 사례로 배우는 대규모 시스템 설계 기초', 2).endsWith(' 2권')).toBe(true)
    expect(shortTitle('가상 면접 사례로 배우는 대규모 시스템 설계 기초', 2).length).toBeLessThanOrEqual(14)
  })
})
