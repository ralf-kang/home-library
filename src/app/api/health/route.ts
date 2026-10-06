import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** 배포 확인용(무인증). DB 연결까지 확인한다. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ ok: true, version: process.env.APP_VERSION || 'dev' })
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
