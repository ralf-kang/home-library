/**
 * 운영 seed — 컨테이너 기동 때마다 실행되므로 반드시 멱등이어야 한다.
 * 구성원이 한 명도 없을 때(최초 배포)만 첫 관리자·기본 구역·예시 공간을 만든다.
 * 이후에는 아무것도 바꾸지 않는다(가족이 설정 화면에서 바꾼 값을 덮어쓰지 않기 위해).
 *
 * 주의: Dockerfile에서 tsc로 이 파일 하나만 컴파일한다 — '@/…' 경로 별칭이나 src/ import 금지.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_ZONES: { name: string; color: string }[] = [
  { name: '고전', color: '#9acd32' },
  { name: '소설', color: '#e8a33d' },
  { name: '인문', color: '#8a5a44' },
  { name: '경영·경제', color: '#2f6a7a' },
  { name: 'IT', color: '#4b5d8a' },
  { name: '자격증', color: '#7a6a2f' },
  { name: '어린이-한글', color: '#e07a9a' },
  { name: '어린이-영어', color: '#5aa0d8' },
]

// 기획서 '서가 위치 체계'의 예시 공간. 실제 집 구조에 맞게 설정 화면에서 고치면 된다.
const EXAMPLE_ROOMS = [
  { code: 'LV', name: '거실' },
  { code: 'ST', name: '서재' },
  { code: 'KD', name: '아이방' },
]

async function main() {
  const memberCount = await prisma.member.count()
  if (memberCount > 0) {
    console.log(`[seed] 구성원 ${memberCount}명 존재 — 최초 seed 건너뜀`)
    return
  }
  const adminName = process.env.SEED_ADMIN_NAME || '관리자'
  await prisma.member.create({ data: { name: adminName, isAdmin: true, role: 'ADULT' } })
  for (const [i, z] of DEFAULT_ZONES.entries()) {
    await prisma.zone.upsert({ where: { name: z.name }, create: { ...z, sortOrder: i }, update: {} })
  }
  if ((await prisma.location.count()) === 0) {
    for (const [i, r] of EXAMPLE_ROOMS.entries()) {
      await prisma.location.create({ data: { kind: 'ROOM', code: r.code, name: r.name, sortOrder: i } })
    }
  }
  console.log(`[seed] 최초 seed 완료 — 관리자 '${adminName}', 구역 ${DEFAULT_ZONES.length}개, 예시 공간 ${EXAMPLE_ROOMS.length}개`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
