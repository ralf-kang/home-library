const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]
const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

/** "사피엔스 2" → "ㅅㅍㅇㅅ2". 공백은 제거하고 한글 외 문자는 소문자로 그대로 둔다. */
export function toChosung(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= HANGUL_START && code <= HANGUL_END) {
      out += CHOSUNG[Math.floor((code - HANGUL_START) / 588)]
    } else if (!/\s/.test(ch)) {
      out += ch.toLowerCase()
    }
  }
  return out
}

/** 검색어가 초성(자음)으로만 이루어졌는지 — 그렇다면 초성 컬럼으로 검색한다. */
export function isChosungQuery(q: string): boolean {
  const compact = q.replace(/\s/g, '')
  return compact.length >= 2 && /^[ㄱ-ㅎ]+$/.test(compact)
}
