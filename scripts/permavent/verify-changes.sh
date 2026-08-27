#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

scope=""
base_ref=""
skip_build="false"
with_tests="false"
PERMAVENT_DRY_RUN="false"

usage() {
  cat <<'EOF'
Usage: verify-changes.sh <server|front|shared|emails|all> [options]

Options:
  --base <git-ref>     Base reference for the boundary check.
  --skip-build         Run lint and typecheck without a production build.
  --with-tests         Run unit tests for the selected projects.
  --dry-run            Print commands without running Nx.
  -h, --help           Show this help.
EOF
}

if [[ $# -gt 0 && "$1" != -* ]]; then
  scope="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      base_ref="${2:-}"
      shift 2
      ;;
    --skip-build)
      skip_build="true"
      shift
      ;;
    --with-tests)
      with_tests="true"
      shift
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

case "$scope" in
  server | front | shared | emails | all)
    ;;
  *)
    permavent_error "A verification scope is required."
    usage >&2
    exit 1
    ;;
esac

permavent_assert_repository_layout
permavent_prepare_node_runtime

boundary_arguments=()
if [[ -n "$base_ref" ]]; then
  boundary_arguments+=(--base "$base_ref")
fi
"${SCRIPT_DIR}/check-boundaries.sh" "${boundary_arguments[@]}"

if [[ "$PERMAVENT_DRY_RUN" == "false" ]]; then
  permavent_require_command corepack
fi

run_project_checks() {
  local project_name="$1"

  permavent_run corepack yarn nx lint "$project_name" \
    --excludeTaskDependencies

  permavent_run corepack yarn nx typecheck "$project_name" \
    --excludeTaskDependencies

  if [[ "$with_tests" == "true" ]]; then
    permavent_run corepack yarn nx test "$project_name" \
      --configuration=ci \
      --excludeTaskDependencies
  fi

  if [[ "$skip_build" == "false" ]]; then
    permavent_run corepack yarn nx build "$project_name" \
      --excludeTaskDependencies
  fi
}

cd "$PERMAVENT_REPOSITORY_ROOT"

case "$scope" in
  server)
    run_project_checks twenty-server
    ;;
  front)
    run_project_checks twenty-front
    ;;
  shared)
    run_project_checks twenty-shared
    ;;
  emails)
    run_project_checks twenty-emails
    ;;
  all)
    run_project_checks twenty-shared
    run_project_checks twenty-emails
    run_project_checks twenty-server
    run_project_checks twenty-front
    ;;
esac

if [[ "$PERMAVENT_DRY_RUN" == "true" ]]; then
  printf 'Verification dry run completed.\n'
else
  printf 'Verification passed for scope: %s.\n' "$scope"
fi
