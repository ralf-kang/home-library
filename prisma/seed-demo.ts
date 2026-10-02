/**
 * 로컬 개발·시연용 데이터(운영에서 실행 금지 — 실행하면 기존 데이터를 지운다).
 * 기획서 부록 '사진 판독 도서 목록'의 일부 책으로 서가·읽기 기록·독후감을 채운다.
 *   npm run db:seed:demo
 */
import { PrismaClient, type AgeGroup, type ReadingStatus } from '@prisma/client'
import { toChosung } from '../src/lib/chosung'

const prisma = new PrismaClient()

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== '1') {
  console.error('운영 환경에서는 demo seed를 실행할 수 없습니다.')
  process.exit(1)
}

type B = [title: string, authors: string, publisher: string, category: string, shelf: string, extra?: { age?: AgeGroup; series?: string; vol?: number; isbn?: string }]

const BOOKS: B[] = [
  ['사피엔스', '유발 하라리', '김영사', '인문·철학·사회', 'ST-B1-S1', { isbn: '9788934972464' }],
  ['호모 데우스', '유발 하라리', '김영사', '인문·철학·사회', 'ST-B1-S1'],
  ['넥서스', '유발 하라리', '김영사', '인문·철학·사회', 'ST-B1-S1'],
  ['총, 균, 쇠', '재레드 다이아몬드', '문학사상', '역사', 'ST-B1-S1'],
  ['공정하다는 착각', '마이클 샌델', '와이즈베리', '인문·철학·사회', 'ST-B1-S2'],
  ['정의란 무엇인가', '마이클 샌델', '와이즈베리', '인문·철학·사회', 'ST-B1-S2'],
  ['지리의 힘', '팀 마샬', '사이', '인문·철학·사회', 'ST-B1-S2'],
  ['국가는 왜 실패하는가', '대런 애쓰모글루', '시공사', '인문·철학·사회', 'ST-B1-S2'],
  ['장하준의 경제학 강의', '장하준', '부키', '경제·투자·재테크', 'ST-B1-S3'],
  ['부의 시나리오', '오건영', '페이지2북스', '경제·투자·재테크', 'ST-B1-S3'],
  ['환율 전쟁', '왕양', '평단', '경제·투자·재테크', 'ST-B1-S3'],
  ['거인의 포트폴리오', '강환국', '페이지2북스', '경제·투자·재테크', 'ST-B1-S3'],
  ['트렌드 코리아 2026', '김난도 외', '미래의창', '경제·투자·재테크', 'LV-B2-S1'],
  ['타이탄의 도구들', '팀 페리스', '토네이도', '경영·업무·자기계발', 'LV-B2-S1'],
  ['업스트림', '댄 히스', '웅진지식하우스', '경영·업무·자기계발', 'LV-B2-S1'],
  ['구글은 어떻게 일하는가', '에릭 슈미트', '김영사', '경영·업무·자기계발', 'ST-B2-S1'],
  ['보고서 작성 실무 강의', '홍장표', '한빛미디어', '경영·업무·자기계발', 'ST-B2-S1'],
  ['실용주의 프로그래머', '데이비드 토머스, 앤드류 헌트', '인사이트', 'IT·개발·데이터', 'ST-B2-S2'],
  ['가상 면접 사례로 배우는 대규모 시스템 설계 기초', '알렉스 쉬', '인사이트', 'IT·개발·데이터', 'ST-B2-S2', { series: '가상 면접 사례로 배우는 대규모 시스템 설계 기초', vol: 1 }],
  ['가상 면접 사례로 배우는 대규모 시스템 설계 기초 2', '알렉스 쉬', '인사이트', 'IT·개발·데이터', 'ST-B2-S2', { series: '가상 면접 사례로 배우는 대규모 시스템 설계 기초', vol: 2 }],
  ['테스트 주도 개발', '켄트 벡', '인사이트', 'IT·개발·데이터', 'ST-B2-S2'],
  ['CODE', '찰스 펫졸드', '인사이트', 'IT·개발·데이터', 'ST-B2-S2'],
  ['정보보안기사 필기', '이기적', '영진닷컴', '자격증·수험서', 'ST-B2-S3'],
  ['리눅스마스터 1급', '이기적', '영진닷컴', '자격증·수험서', 'ST-B2-S3'],
  ['1984', '조지 오웰', '민음사', '문학·소설', 'LV-B1-S1', { series: '민음사 세계문학전집' }],
  ['동물농장', '조지 오웰', '민음사', '문학·소설', 'LV-B1-S1', { series: '민음사 세계문학전집' }],
  ['위대한 개츠비', 'F. 스콧 피츠제럴드', '민음사', '문학·소설', 'LV-B1-S1', { series: '민음사 세계문학전집' }],
  ['1Q84 1', '무라카미 하루키', '문학동네', '문학·소설', 'LV-B1-S2', { series: '1Q84', vol: 1 }],
  ['1Q84 2', '무라카미 하루키', '문학동네', '문학·소설', 'LV-B1-S2', { series: '1Q84', vol: 2 }],
  ['1Q84 3', '무라카미 하루키', '문학동네', '문학·소설', 'LV-B1-S2', { series: '1Q84', vol: 3 }],
  ['아몬드', '손원평', '창비', '문학·소설', 'LV-B1-S2'],
  ['은하영웅전설 1', '다나카 요시키', '이타카', '장편 시리즈·만화', 'LV-B1-S3', { series: '은하영웅전설', vol: 1 }],
  ['은하영웅전설 2', '다나카 요시키', '이타카', '장편 시리즈·만화', 'LV-B1-S3', { series: '은하영웅전설', vol: 2 }],
  ['은하영웅전설 4', '다나카 요시키', '이타카', '장편 시리즈·만화', 'LV-B1-S3', { series: '은하영웅전설', vol: 4 }],
  ['미생 1', '윤태호', '더오리진', '장편 시리즈·만화', 'LV-B1-S3', { series: '미생', vol: 1 }],
  ['창백한 푸른 점', '칼 세이건', '사이언스북스', '과학·교양', 'LV-B2-S2'],
  ['열두 발자국', '정재승', '어크로스', '과학·교양', 'LV-B2-S2'],
  ['메이지의 날씨 놀이', '루시 커즌스', '웅진주니어', '어린이 한글 그림책', 'KD-B1-S1', { age: 'CHILD', series: '메이지 이중언어그림책', vol: 6 }],
  ['메이지의 첫 시계 놀이', '루시 커즌스', '웅진주니어', '어린이 한글 그림책', 'KD-B1-S1', { age: 'CHILD', series: '메이지 이중언어그림책', vol: 5 }],
  ['메이지, 수영을 배우다', '루시 커즌스', '웅진주니어', '어린이 한글 그림책', 'KD-B1-S1', { age: 'CHILD', series: '메이지 이중언어그림책', vol: 25 }],
  ['색깔 괴물', '아나 예나스', '청어람아이', '어린이 한글 그림책', 'KD-B1-S1', { age: 'CHILD' }],
  ["We Are in a Book!", 'Mo Willems', 'Hyperion', '어린이 영어 그림책', 'KD-B1-S2', { age: 'CHILD', series: 'Elephant & Piggie' }],
  ["I Broke My Trunk!", 'Mo Willems', 'Hyperion', '어린이 영어 그림책', 'KD-B1-S2', { age: 'CHILD', series: 'Elephant & Piggie' }],
  ['What Do You Want to Be?', 'Mango Lion', '망고리언', '어린이 영어 그림책', 'KD-B1-S2', { age: 'CHILD', series: 'Mango Lion English' }],
]

async function main() {
  // 초기화(데모 전용)
  await prisma.$transaction([
    prisma.recommendationRun.deleteMany(),
    prisma.note.deleteMany(),
    prisma.reading.deleteMany(),
    prisma.wishItem.deleteMany(),
    prisma.loan.deleteMany(),
    prisma.copyMove.deleteMany(),
    prisma.copy.deleteMany(),
    prisma.book.deleteMany(),
    prisma.series.deleteMany(),
    prisma.location.deleteMany({ where: { kind: 'SHELF' } }),
    prisma.location.deleteMany({ where: { kind: 'BOOKCASE' } }),
    prisma.location.deleteMany(),
    prisma.zone.deleteMany(),
    prisma.member.deleteMany(),
  ])

  const dad = await prisma.member.create({ data: { name: '아빠', isAdmin: true, sortOrder: 0 } })
  const mom = await prisma.member.create({ data: { name: '엄마', isAdmin: true, sortOrder: 1 } })
  const kid = await prisma.member.create({ data: { name: '아이', role: 'CHILD', sortOrder: 2 } })

  const zone = async (name: string, color: string) => prisma.zone.create({ data: { name, color } })
  const zClassic = await zone('고전', '#9acd32')
  const zNovel = await zone('소설', '#e8a33d')
  const zHum = await zone('인문', '#8a5a44')
  const zIt = await zone('IT', '#4b5d8a')
  const zEco = await zone('경영·경제', '#2f6a7a')
  const zKidKo = await zone('어린이-한글', '#e07a9a')
  const zKidEn = await zone('어린이-영어', '#5aa0d8')

  const shelfIds = new Map<string, string>()
  const room = async (code: string, name: string, cases: { code: string; name: string; shelves: (string | null)[] }[]) => {
    const r = await prisma.location.create({ data: { kind: 'ROOM', code, name } })
    for (const [ci, c] of cases.entries()) {
      const bc = await prisma.location.create({ data: { kind: 'BOOKCASE', code: c.code, name: c.name, parentId: r.id, sortOrder: ci } })
      for (const [si, zoneId] of c.shelves.entries()) {
        const sh = await prisma.location.create({
          data: { kind: 'SHELF', code: `S${si + 1}`, name: `${si + 1}칸`, parentId: bc.id, zoneId, sortOrder: si + 1 },
        })
        shelfIds.set(`${code}-${c.code}-S${si + 1}`, sh.id)
      }
    }
  }
  await room('LV', '거실', [
    { code: 'B1', name: '1번 책장', shelves: [zClassic.id, zNovel.id, zNovel.id] },
    { code: 'B2', name: '2번 책장', shelves: [zEco.id, null, null] },
  ])
  await room('ST', '서재', [
    { code: 'B1', name: '철제 선반 왼쪽', shelves: [zHum.id, zHum.id, zEco.id] },
    { code: 'B2', name: '철제 선반 오른쪽', shelves: [zEco.id, zIt.id, zIt.id] },
  ])
  await room('KD', '아이방', [{ code: 'B1', name: '그림책장', shelves: [zKidKo.id, zKidEn.id] }])

  const books = new Map<string, string>()
  for (const [title, authors, publisher, category, shelf, extra] of BOOKS) {
    const series = extra?.series
      ? await prisma.series.upsert({ where: { name: extra.series }, create: { name: extra.series }, update: {} })
      : null
    const book = await prisma.book.create({
      data: {
        title,
        titleChosung: toChosung(title),
        authors,
        publisher,
        category,
        isbn13: extra?.isbn ?? null,
        ageGroup: extra?.age ?? 'ADULT',
        seriesId: series?.id,
        volumeNo: extra?.vol ?? null,
      },
    })
    books.set(title, book.id)
    const owner = extra?.age === 'CHILD' ? kid.id : category.startsWith('IT') || category.startsWith('자격증') ? dad.id : null
    const copy = await prisma.copy.create({ data: { bookId: book.id, locationId: shelfIds.get(shelf), ownerId: owner, lendable: !category.startsWith('자격증') } })
    await prisma.copyMove.create({ data: { copyId: copy.id, toLocationId: shelfIds.get(shelf), movedById: dad.id } })
  }
  // 같은 책 두 권(기획서: 손자병법·바리스타 등) 예시
  await prisma.copy.create({ data: { bookId: books.get('공정하다는 착각')!, locationId: shelfIds.get('LV-B2-S2'), ownerId: mom.id } })

  const month = (m: number) => new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth() - m, 10))
  const read = async (member: string, title: string, status: ReadingStatus, rating: number | null, monthsAgo: number, notes: [string, 'REVIEW' | 'QUOTE' | 'MEMO'][] = []) => {
    const r = await prisma.reading.create({
      data: {
        memberId: member,
        bookId: books.get(title)!,
        status,
        rating,
        finishedAt: status === 'DONE' ? month(monthsAgo) : null,
        startedAt: month(monthsAgo + 1),
        readCount: status === 'DONE' ? 1 : 0,
      },
    })
    for (const [body, kind] of notes) await prisma.note.create({ data: { readingId: r.id, kind, body } })
  }
  await read(dad.id, '사피엔스', 'DONE', 5, 1, [['인지혁명·농업혁명·과학혁명의 틀로 인류사를 다시 보게 한다. 허구를 믿는 능력이 협력의 기반이라는 대목이 핵심.', 'REVIEW']])
  await read(dad.id, '호모 데우스', 'DONE', 4, 3)
  await read(dad.id, '공정하다는 착각', 'DONE', 5, 5, [['능력주의는 승자에게 오만을, 패자에게 굴욕을 남긴다.', 'QUOTE']])
  await read(dad.id, '실용주의 프로그래머', 'DONE', 5, 7, [['깨진 창문을 방치하지 말 것 — 운영 시스템 관리에도 그대로 적용된다.', 'MEMO']])
  await read(dad.id, '장하준의 경제학 강의', 'DONE', 4, 2)
  await read(dad.id, '부의 시나리오', 'DONE', 4, 4)
  await read(dad.id, '가상 면접 사례로 배우는 대규모 시스템 설계 기초', 'READING', null, 0)
  await read(dad.id, '넥서스', 'WANT', null, 0)
  await read(dad.id, '정보보안기사 필기', 'REFERENCE', null, 0)
  await read(mom.id, '아몬드', 'DONE', 5, 1, [['감정을 느끼지 못하는 소년이 타인과 연결되는 과정이 담담해서 더 아프다.', 'REVIEW']])
  await read(mom.id, '1984', 'DONE', 4, 6)
  await read(mom.id, '타이탄의 도구들', 'READING', null, 0)
  await read(kid.id, '색깔 괴물', 'DONE', 5, 0)
  await read(kid.id, '메이지의 날씨 놀이', 'DONE', 4, 1)

  await prisma.wishItem.create({ data: { memberId: dad.id, title: '21세기를 위한 21가지 제언', authors: '유발 하라리', publisher: '김영사', reason: '좋아하신 유발 하라리의 다른 책', source: 'RECOMMEND' } })

  console.log(`[demo] 구성원 3명, 책 ${BOOKS.length}권, 칸 ${shelfIds.size}개를 만들었습니다. 로그인 PIN은 .env의 FAMILY_PIN.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
