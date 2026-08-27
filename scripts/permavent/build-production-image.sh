#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

upstream_version=""
release_number=""
builder_name=""
PERMAVENT_DRY_RUN="false"

usage() {
  cat <<'EOF'
Usage: build-production-image.sh --upstream-version vX.Y.Z --release N [options]

Options:
  --builder <name>      Use a specific Docker Buildx builder.
  --dry-run             Print the canonical build command without running it.
  -h, --help            Show this help.

The script builds the production target and never pushes the image.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --upstream-version)
      upstream_version="${2:-}"
      shift 2
      ;;
    --release)
      release_number="${2:-}"
      shift 2
      ;;
    --builder)
      builder_name="${2:-}"
      shift 2
      ;;
    --dry-run)
      PERMAVENT_DRY_RUN="true"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      permavent_error "Unknown option: $1"
      usage >&2
      exit 1
      ;;
  esac
done

[[ -n "$upstream_version" ]] || permavent_fail "--upstream-version is required."
[[ -n "$release_number" ]] || permavent_fail "--release is required."
permavent_validate_upstream_version "$upstream_version"
permavent_validate_release_number "$release_number"
permavent_assert_repository_layout

branch_name="$(permavent_current_branch)"
if [[ "$branch_name" != *"-${upstream_version}" && "$branch_name" != "$(permavent_expected_base_branch "$upstream_version")" ]]; then
  permavent_fail "Branch '${branch_name}' does not match upstream version ${upstream_version}."
fi

if [[ "$PERMAVENT_DRY_RUN" == "false" ]] &&
  [[ -n "$(git -C "$PERMAVENT_REPOSITORY_ROOT" status --porcelain --untracked-files=normal)" ]]; then
  permavent_fail "The Git working tree must be clean for a production image build."
fi

if [[ "$PERMAVENT_DRY_RUN" == "false" ]]; then
  permavent_require_command docker
  docker info >/dev/null 2>&1 || permavent_fail "The Docker daemon is unavailable."
  docker buildx version >/dev/null 2>&1 || permavent_fail "Docker Buildx is unavailable."
fi

image_tag="$(permavent_image_tag "$upstream_version" "$release_number")"
source_url="$(git -C "$PERMAVENT_REPOSITORY_ROOT" config --get remote.origin.url)"
source_revision="$(git -C "$PERMAVENT_REPOSITORY_ROOT" rev-parse HEAD)"
created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
build_command=(
  docker buildx build
  --platform linux/amd64
  --target twenty
  --build-arg "APP_VERSION=${upstream_version}"
  --label "org.opencontainers.image.source=${source_url}"
  --label "org.opencontainers.image.revision=${source_revision}"
  --label "org.opencontainers.image.version=${upstream_version}"
  --label "org.opencontainers.image.created=${created_at}"
  --file packages/twenty-docker/twenty/Dockerfile
  --tag "$image_tag"
  --load
)

if [[ -n "$builder_name" ]]; then
  build_command+=(--builder "$builder_name")
fi

build_command+=(.)

printf 'Production image: %s\n' "$image_tag"
printf 'Source branch: %s\n' "$branch_name"
printf 'Source commit: %s\n' "$source_revision"
printf 'Build command:\n'

cd "$PERMAVENT_REPOSITORY_ROOT"
permavent_run "${build_command[@]}"

if [[ "$PERMAVENT_DRY_RUN" == "true" ]]; then
  printf 'Build dry run completed.\n'
  exit 0
fi

printf 'Build completed. Verify the image before publication:\n'
permavent_print_command \
  "${SCRIPT_DIR}/verify-production-image.sh" \
  --image "$image_tag" \
  --upstream-version "$upstream_version"
