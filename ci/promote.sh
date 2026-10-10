#!/usr/bin/env bash
# ci/promote.sh — 새 이미지를 gitops 저장소(테스트 overlay)에 반영 = "배포 요청"을 Git 커밋으로 남긴다 (CI 도구와 무관)
#
#   TAG=<git sha> GITOPS_TOKEN=<PAT> ci/promote.sh            # 커밋 + push
#   TAG=<git sha> DRY_RUN=1 GITOPS_TOKEN=<PAT> ci/promote.sh  # 바뀔 내용만 보고 push 안 함
#
# 하는 일은 딱 두 줄 수정: overlays/test/kustomization.yaml 의 images.newTag, APP_VERSION.
# 배포 자체는 Argo CD 가 이 저장소를 보다가 한다 — 여기서는 클러스터에 접속하지 않는다(사설망이라 접속할 수도 없다).
#
# 환경변수
#   TAG            필수. 이미지 태그(= 커밋 SHA 40자)
#   GITOPS_TOKEN   gitops 저장소 쓰기 권한 PAT. 없으면 경고만 하고 정상 종료(비밀값 등록 전에도 CI 가 깨지지 않게)
#   GITOPS_REPO    기본 ralf-kang/home-library-gitops
#   OVERLAY        기본 apps/home-library/overlays/test
#   IMAGE_DIGEST   있으면 커밋 메시지에 기록
set -euo pipefail
: "${TAG:?TAG 필요 (git sha)}"
GITOPS_REPO="${GITOPS_REPO:-ralf-kang/home-library-gitops}"
OVERLAY="${OVERLAY:-apps/home-library/overlays/test}"
SHORT="${TAG:0:7}"

if [ -z "${GITOPS_TOKEN:-}" ]; then
  echo "::warning title=promote 생략::GITOPS_TOKEN 비밀값이 없어 gitops 저장소를 갱신하지 않았습니다"
  exit 0
fi
trap 'echo "::error title=ci/promote.sh 실패::gitops 저장소 갱신 중 오류 (로그 확인)"' ERR

# 토큰을 URL 에 넣지 않고 헤더로 전달하고, 로그에 찍히지 않게 마스킹한다
B64="$(printf 'x-access-token:%s' "$GITOPS_TOKEN" | base64 | tr -d '\n')"
# ::add-mask:: 는 GitHub Actions 안에서만 쓴다 (다른 곳에서는 명령이 그대로 출력되어 값이 노출된다)
[ -n "${GITHUB_ACTIONS:-}" ] && echo "::add-mask::$B64"
unset GITOPS_TOKEN_RAW 2>/dev/null || true
git_() { git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $B64" "$@"; }

WORK="$(mktemp -d)"
git_ clone -q --depth 1 "https://github.com/$GITOPS_REPO.git" "$WORK"
cd "$WORK"
F="$OVERLAY/kustomization.yaml"
[ -f "$F" ] || { echo "::error::$F 없음"; exit 1; }

sed -i -E "s/^([[:space:]]+newTag:).*/\1 $TAG/" "$F"
sed -i -E "s/(APP_VERSION=).*/\1$SHORT/" "$F"
grep -q "newTag: $TAG" "$F" && grep -q "APP_VERSION=$SHORT" "$F" || { echo "::error::kustomization 수정 확인 실패"; exit 1; }

if git diff --quiet; then echo "이미 같은 버전($SHORT) — 커밋 없음"; exit 0; fi
git --no-pager diff --stat; git --no-pager diff -U0 | grep -E '^[+-][^+-]' || true
if [ "${DRY_RUN:-}" = "1" ]; then echo "DRY_RUN: push 생략"; exit 0; fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
MSG="deploy(test): home-library $SHORT

source: https://github.com/ralf-kang/home-library/commit/$TAG
${IMAGE_DIGEST:+digest: $IMAGE_DIGEST}"
git commit -q -am "$MSG"
for i in 1 2 3; do
  git_ push -q origin HEAD:main && { echo "==> gitops 갱신 완료: $SHORT"; exit 0; }
  echo "push 경합 — 다시 시도($i)"; git_ pull -q --rebase origin main
done
echo "::error::gitops push 3회 실패"; exit 1
