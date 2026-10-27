import nook from '@/img/photos/auth-reading-nook-1120.webp'
import family from '@/img/photos/landing-hero-family-reading-1536.webp'
import sharing from '@/img/photos/neighborhood-book-sharing-1536.webp'
import journal from '@/img/photos/me-reading-journal-desk-1536.webp'
import books from '@/img/photos/recommend-unread-books-selection-1536.webp'
import capture from '@/img/photos/add-photo-shelf-framing-1536.webp'

export const LIBRARY_COVERS = {
  nook: { label: '햇살 드는 독서 공간', image: nook },
  family: { label: '가족의 독서 시간', image: family },
  sharing: { label: '이웃과 책 나눔', image: sharing },
  journal: { label: '나의 독서 노트', image: journal },
  books: { label: '다시 펼치는 책', image: books },
  capture: { label: '가지런한 책장', image: capture },
} as const
