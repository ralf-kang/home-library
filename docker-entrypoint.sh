#!/bin/sh
# docker-entrypoint.sh — home-library
# 기동 시: Prisma 스키마를 공용 PostgreSQL에 동기화 → 최초 seed(멱등) → Next.js standalone 서버 시작.
#
# `migrate deploy`가 아니라 `db push`인 이유는 vistor-report와 같다: prisma/migrations/가
# 아직 없고, 빈 migrations 디렉터리에 migrate deploy를 실행하면 테이블을 만들지 않은 채
# 조용히 끝난다. 정식 마이그레이션 이력을 시작하면 migrate deploy로 바꿀 것(CLAUDE.md 참고).
set -e

echo "[entrypoint] Prisma db push (스키마 동기화)..."
# --accept-data-loss는 일부러 넣지 않는다 — 데이터 손실이 필요한 스키마 변경이면 자동 승인 대신 에러로 멈춘다.
node node_modules/prisma/build/index.js db push --skip-generate

echo "[entrypoint] Seed (구성원이 없을 때만 첫 관리자·기본 구역·예시 공간 생성)..."
node prisma/dist/seed.js

echo "[entrypoint] 준비 완료. 서버를 시작합니다."
exec "$@"
