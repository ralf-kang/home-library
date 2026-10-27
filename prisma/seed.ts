/**
 * 운영 seed — 컨테이너 기동 때마다 실행된다(docker-entrypoint.sh).
 *
 * 플랫폼 전환 후에는 가구(서재)를 사용자가 온보딩 화면에서 직접 만들고, 기본 구역·예시 공간도 그때 만든다
 * (src/server/households.ts createHousehold). 그래서 여기서는 DB 연결만 확인하고 아무것도 바꾸지 않는다.
 * 나중에 전역 기준 데이터(예: 법정동 코드 캐시)가 필요하면 이곳에 멱등하게 추가한다.
 *
 * 주의: Dockerfile에서 tsc로 이 파일 하나만 컴파일한다 — '@/…' 경로 별칭이나 src/ import 금지.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [users, households] = await Promise.all([prisma.user.count(), prisma.household.count()])
  console.log(`[seed] 사용자 ${users}명, 서재 ${households}곳 — 변경 없음`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
