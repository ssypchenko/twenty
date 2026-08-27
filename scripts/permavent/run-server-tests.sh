#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

PERMAVENT_DRY_RUN="false"
test_paths=()

usage() {
  cat <<'EOF'
Usage: run-server-tests.sh [--dry-run] <test-path> [<test-path> ...]

Test paths may be repository-relative, server-package-relative or absolute.
They are normalised before Jest runs from packages/twenty-server.
EOF
}

normalise_test_path() {
  local test_path="$1"
  local absolute_server_root="${PERMAVENT_REPOSITORY_ROOT}/packages/twenty-server/"

  test_path="${test_path#${absolute_server_root}}"
  test_path="${test_path#packages/twenty-server/}"

  [[ "$test_path" == src/* ]] ||
    permavent_fail "Server test path must resolve below packages/twenty-server/src: ${1}"
  [[ -f "${PERMAVENT_REPOSITORY_ROOT}/packages/twenty-server/${test_path}" ]] ||
    permavent_fail "Server test file was not found: ${1}"

  printf '%s\n' "$test_path"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      PERMAVENT_DRY_RUN="true"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      permavent_error "Unknown option: $1"
      usage >&2
      exit 1
      ;;
    *)
      test_paths+=("$1")
      shift
      ;;
  esac
done

[[ "${#test_paths[@]}" -gt 0 ]] || {
  usage >&2
  exit 1
}

permavent_assert_repository_layout
permavent_prepare_node_runtime

if [[ "$PERMAVENT_DRY_RUN" == "false" ]]; then
  permavent_require_command corepack
fi

normalised_test_paths=()
for test_path in "${test_paths[@]}"; do
  normalised_test_paths+=("$(normalise_test_path "$test_path")")
done

cd "$PERMAVENT_REPOSITORY_ROOT"
permavent_run corepack yarn nx jest twenty-server \
  --runInBand \
  --runTestsByPath \
  "${normalised_test_paths[@]}"
