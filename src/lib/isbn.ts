/** 하이픈·공백을 제거한 숫자열(ISBN-10의 X 포함)만 남긴다. */
export function cleanIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase()
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10 === Number(isbn[12])
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) sum += (isbn[i] === 'X' ? 10 : Number(isbn[i])) * (10 - i)
  return sum % 11 === 0
}

/** ISBN-10/13 어느 쪽이든 받아 유효하면 ISBN-13으로 돌려준다. 아니면 null. */
export function normalizeIsbn(raw: string): string | null {
  const isbn = cleanIsbn(raw)
  if (isValidIsbn13(isbn)) return isbn
  if (isValidIsbn10(isbn)) {
    const core = '978' + isbn.slice(0, 9)
    let sum = 0
    for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
    return core + ((10 - (sum % 10)) % 10)
  }
  return null
}
