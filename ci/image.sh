#!/usr/bin/env bash
# ci/image.sh — 이미지 1회 빌드 → 취약점 스캔 → Harbor push (CI 도구와 무관한 파이프라인 본체)
#
#   IMAGE=harbor.ralfkang.synology.me/hl-test/home-library TAG=<git sha> ci/image.sh
#
# 원칙
#   - 태그는 git 커밋 SHA (불변). :latest 는 만들지 않는다.
#   - Trivy 게이트: 고칠 수 있는(fixed 버전이 있는) CRITICAL 이 있으면 실패. HIGH 이하는 보고만.
#   - HARBOR_USERNAME/HARBOR_PASSWORD 가 없으면 빌드·스캔만 하고 push 는 건너뛴다(포크 PR, 비밀값 미등록 상태).
#   - 결과 digest 를 image-digest.txt 에 남긴다 → 이후 단계(gitops 갱신, 운영 승격)는 태그가 아니라 digest 로 참조.
#   - 실패하면 어느 단계인지 ::error 줄로 남긴다 (GitHub Actions 는 PR 화면 주석으로 표시, Jenkins 는 로그 한 줄).
set -euo pipefail
cd "$(dirname "$0")/.."
: "${IMAGE:?IMAGE 필요 (예: harbor.ralfkang.synology.me/hl-test/home-library)}"
: "${TAG:?TAG 필요 (git sha)}"
TRIVY_IMAGE="${TRIVY_IMAGE:-aquasec/trivy:0.58.1}"
REGISTRY="${IMAGE%%/*}"
REF="$IMAGE:$TAG"
STAGE=init
trap 'echo "::error title=ci/image.sh 실패::단계=$STAGE (자세한 내용은 로그)"' ERR

STAGE=build
echo "==> build $REF"
docker build --pull -t "$REF" \
  --label org.opencontainers.image.revision="$TAG" \
  --label org.opencontainers.image.source="${SOURCE_URL:-https://github.com/ralf-kang/home-library}" .

trivy() {
  docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$HOME/.cache/trivy:/root/.cache/" -v "$PWD:/out" \
    "$TRIVY_IMAGE" image --scanners vuln --no-progress "$@" "$REF"
}
STAGE=scan
echo "==> scan (보고: HIGH,CRITICAL)"
trivy --severity HIGH,CRITICAL --exit-code 0
echo "==> scan (게이트: 고칠 수 있는 CRITICAL 이 있으면 실패)"
trivy --severity CRITICAL --ignore-unfixed --format json --output /out/trivy-critical.json --exit-code 0
n="$(jq '[.Results[]?.Vulnerabilities[]?] | length' trivy-critical.json)"
if [ "$n" -gt 0 ]; then
  # 취약점마다 한 줄: 어떤 패키지를 몇 버전으로 올리면 되는지
  jq -r '.Results[]? | .Target as $t | .Vulnerabilities[]? |
    "::error title=CRITICAL \(.VulnerabilityID)::\(.PkgName) \(.InstalledVersion) -> \(.FixedVersion) [\($t)] \(.Title // "")"' trivy-critical.json
  echo "==> 고칠 수 있는 CRITICAL 취약점 ${n}건 → 실패"
  STAGE="scan-gate(${n}건)"
  exit 1
fi

if [ -z "${HARBOR_USERNAME:-}" ] || [ -z "${HARBOR_PASSWORD:-}" ]; then
  echo "::warning title=push 생략::HARBOR_USERNAME/HARBOR_PASSWORD 비밀값이 없어 빌드·스캔만 했습니다"
  exit 0
fi
STAGE=push
echo "==> push $REF"
echo "$HARBOR_PASSWORD" | docker login "$REGISTRY" -u "$HARBOR_USERNAME" --password-stdin
docker push "$REF"
DIGEST="$(docker inspect --format '{{index .RepoDigests 0}}' "$REF")"
echo "$DIGEST" > image-digest.txt
echo "==> pushed: $DIGEST"
docker logout "$REGISTRY" >/dev/null
