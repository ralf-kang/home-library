import { describe, expect, it } from 'vitest'
import { matchLibrary, normalizeTitle } from '../src/lib/book-match'

describe('외부 검색 결과 ↔ 우리 서재 매칭', () => {
  const books = [
    { id: 'a', isbn13: '9788934972464', title: '사피엔스', authors: '유발 하라리' },
    { id: 'b', isbn13: null, title: '총, 균, 쇠 (개정판)', authors: '재레드 다이아몬드' },
    { id: 'c', isbn13: null, title: '1Q84 1', authors: '무라카미 하루키' },
    { id: 'd', isbn13: null, title: '어린 왕자', authors: '생텍쥐페리' },
    { id: 'e', isbn13: null, title: '어린 왕자', authors: '다른 번역가' },
  ]
  it('제목 정규화: 괄호·부제·권차·문장부호 제거', () => {
    expect(normalizeTitle('총, 균, 쇠 (개정판)')).toBe('총균쇠')
    expect(normalizeTitle('사피엔스: 유인원에서 사이보그까지')).toBe('사피엔스')
    expect(normalizeTitle('1Q84 1')).toBe('1q84')
  })
  it('ISBN-10/13 이 같으면 일치', () => {
    const m = matchLibrary([{ isbns: ['978-8934972464'], title: 'Sapiens', authors: [], snippet: null }], books)
    expect([...m.keys()]).toEqual(['a'])
  })
  it('ISBN 이 없으면 정규화 제목으로, 같은 제목이 여럿이면 저자로 좁힌다', () => {
    const m = matchLibrary(
      [
        { isbns: [], title: '총균쇠', authors: ['재레드 다이아몬드'], snippet: '총과 균과 쇠' },
        { isbns: [], title: '어린 왕자', authors: ['생텍쥐페리'], snippet: null },
      ],
      books,
    )
    expect([...m.keys()].sort()).toEqual(['b', 'd'])
  })
  it('관련 없는 책은 일치하지 않는다', () => {
    expect(matchLibrary([{ isbns: ['9780000000002'], title: '전혀 다른 책', authors: [], snippet: null }], books).size).toBe(0)
  })
})
