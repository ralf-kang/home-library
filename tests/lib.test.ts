import { describe, expect, it } from 'vitest'
import { isChosungQuery, toChosung } from '@/lib/chosung'
import { normalizeIsbn, isValidIsbn13 } from '@/lib/isbn'
import { buildLocationIndex, descendantIds, effectiveZone, fullCode, fullName, type LocationNode } from '@/lib/location'
import { formatCopyCode } from '@/lib/format'
import { guessCategory } from '@/lib/book-lookup'
import { splitAuthors } from '@/server/profile'

describe('chosung', () => {
  it('converts hangul to initial consonants and drops spaces', () => {
    expect(toChosung('사피엔스')).toBe('ㅅㅍㅇㅅ')
    expect(toChosung('총, 균, 쇠')).toBe('ㅊ,ㄱ,ㅅ')
    expect(toChosung('1Q84 BOOK 2')).toBe('1q84book2')
  })
  it('detects consonant-only queries', () => {
    expect(isChosungQuery('ㅅㅍㅇㅅ')).toBe(true)
    expect(isChosungQuery('ㅅ')).toBe(false)
    expect(isChosungQuery('사피')).toBe(false)
  })
})

describe('isbn', () => {
  it('validates ISBN-13 checksum', () => {
    expect(isValidIsbn13('9788983921987')).toBe(true)
    expect(isValidIsbn13('9788983921988')).toBe(false)
  })
  it('normalizes hyphenated ISBN-13 and converts ISBN-10', () => {
    expect(normalizeIsbn('978-89-8392-198-7')).toBe('9788983921987')
    expect(normalizeIsbn('0-306-40615-2')).toBe('9780306406157')
    expect(normalizeIsbn('12345')).toBeNull()
  })
})

describe('location', () => {
  const zone = { id: 'z', name: '고전', color: '#9acd32' }
  const nodes: LocationNode[] = [
    { id: 'r', kind: 'ROOM', code: 'LV', name: '거실', parentId: null, sortOrder: 0, zoneId: null, zone: null },
    { id: 'b', kind: 'BOOKCASE', code: 'B2', name: '2번 책장', parentId: 'r', sortOrder: 0, zoneId: 'z', zone },
    { id: 's3', kind: 'SHELF', code: 'S3', name: '3칸', parentId: 'b', sortOrder: 3, zoneId: null, zone: null },
    { id: 's10', kind: 'SHELF', code: 'S10', name: '10칸', parentId: 'b', sortOrder: 10, zoneId: null, zone: null },
  ]
  const { byId, children } = buildLocationIndex(nodes)
  it('builds full code and name from the tree', () => {
    expect(fullCode('s3', byId)).toBe('LV-B2-S3')
    expect(fullName('s3', byId)).toBe('거실 › 2번 책장 › 3칸')
  })
  it('inherits zone from the bookcase when the shelf has none', () => {
    expect(effectiveZone('s3', byId)?.name).toBe('고전')
    expect(effectiveZone('r', byId)).toBeNull()
  })
  it('collects descendants and sorts shelves numerically', () => {
    expect(descendantIds('r', children).sort()).toEqual(['b', 'r', 's10', 's3'])
    expect(children.get('b')!.map((n) => n.code)).toEqual(['S3', 'S10'])
  })
})

describe('misc', () => {
  it('formats copy codes', () => {
    expect(formatCopyCode(123)).toBe('HL-000123')
  })
  it('guesses family category from KDC', () => {
    expect(guessCategory('004.73')).toBe('IT·개발·데이터')
    expect(guessCategory('325.04')).toBe('경영·업무·자기계발')
    expect(guessCategory('320.9')).toBe('경제·투자·재테크')
    expect(guessCategory('813.7')).toBe('문학·소설')
    expect(guessCategory('911')).toBe('역사')
    expect(guessCategory(null)).toBe('미분류')
    expect(guessCategory('813', 'CHILD')).toBe('어린이 한글 그림책')
  })
  it('splits author strings', () => {
    expect(splitAuthors('데이비드 토머스, 앤드류 헌트 지음')).toEqual(['데이비드 토머스', '앤드류 헌트'])
    expect(splitAuthors('김난도 외')).toEqual(['김난도'])
  })
})

describe('author suffixes', () => {
  it('keeps name characters that look like role words', () => {
    expect(splitAuthors('저스틴 저')).toEqual(['저스틴'])
    expect(splitAuthors('한강 글, 이수지 그림')).toEqual(['한강', '이수지'])
  })
})
