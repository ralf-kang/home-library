#!/usr/bin/env bash
# ci/verify.sh — 소스 검증 단계 (CI 도구와 무관한 파이프라인 본체)
#
#   ci/verify.sh install|lint|typecheck|test|build|all
#
# GitHub Actions(.github/workflows/ci.yml)와 Jenkins(Jenkinsfile)는 이 스크립트를 부르기만 한다.
# 단계 로직을 YAML/Jenkinsfile 에 직접 쓰지 말 것 — 두 CI 를 같은 동작으로 유지하기 위함.
#
# 환경변수
#   APPEARANCE_TEST_DATABASE_URL  있으면 test 단계 전에 그 DB 에 스키마를 만들고 통합 테스트까지 실행
#                                 (DB 이름이 hl_appearance_check_ 로 시작해야 테스트가 동작 — 운영 DB 오사용 방지)
set -euo pipefail
cd "$(dirname "$0")/.."
export NEXT_TELEMETRY_DISABLED=1

install()   { npm ci --no-audit --no-fund; npx prisma generate; }
lint()      { npm run lint; }
typecheck() { npm run typecheck; }
test_()     {
  if [ -n "${APPEARANCE_TEST_DATABASE_URL:-}" ]; then
    echo "==> 통합 테스트 DB 스키마 준비"
    DATABASE_URL="$APPEARANCE_TEST_DATABASE_URL" npx prisma db push --skip-generate
  else
    echo "==> APPEARANCE_TEST_DATABASE_URL 없음: DB 통합 테스트는 건너뜀"
  fi
  npm test
}
build()     { npm run build; }

run() { echo "==> $1"; "$2"; }
case "${1:-all}" in
  install)   run install install ;;
  lint)      run lint lint ;;
  typecheck) run typecheck typecheck ;;
  test)      run test test_ ;;
  build)     run build build ;;
  all)       run install install; run lint lint; run typecheck typecheck; run test test_; run build build ;;
  *) echo "사용법: $0 install|lint|typecheck|test|build|all" >&2; exit 2 ;;
esac
