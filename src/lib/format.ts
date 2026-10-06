import type { CopyStatus, ReadingStatus, NoteKind, WishStatus, LocationKind } from '@prisma/client'

export function formatCopyCode(seq: number): string {
  return `HL-${String(seq).padStart(6, '0')}`
}

export const COPY_STATUS_LABEL: Record<CopyStatus, string> = {
  ON_SHELF: '서가에 있음',
  OUT_READING: '꺼내 둠',
  LOANED: '대여 중',
  LOST: '분실',
  DISPOSED: '처분',
}

export const READING_STATUS_LABEL: Record<ReadingStatus, string> = {
  WANT: '읽고 싶음',
  READING: '읽는 중',
  DONE: '완독',
  DROPPED: '중단',
  REFERENCE: '참고용',
}

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  REVIEW: '독후감',
  QUOTE: '인용구',
  MEMO: '메모',
}

export const WISH_STATUS_LABEL: Record<WishStatus, string> = {
  INTERESTED: '관심',
  PLANNED: '구매 예정',
  PURCHASED: '구매 완료',
  DISMISSED: '관심 없음',
}

export const LOCATION_KIND_LABEL: Record<LocationKind, string> = {
  ROOM: '공간',
  BOOKCASE: '책장',
  SHELF: '칸',
}

/** 가족이 쓰는 기본 분야 목록(기획서의 장서 현황 분류와 동일). 자유 입력도 허용한다. */
export const DEFAULT_CATEGORIES = [
  '인문·철학·사회',
  '경영·업무·자기계발',
  '경제·투자·재테크',
  'IT·개발·데이터',
  '문학·소설',
  '장편 시리즈·만화',
  '역사',
  '과학·교양',
  '자격증·수험서',
  '육아·교육·종교',
  '어린이 한글 그림책',
  '어린이 영어 그림책',
]

export function formatDate(d: Date | null | undefined): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}
