#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

skip_docker="false"
require_clean="false"
upstream_version=""

usage() {
  cat <<'EOF'
Usage: preflight.sh [options]

Options:
  --skip-docker                  Do not check Docker or Buildx.
  --require-clean                Fail when the Git working tree is not clean.
  --upstream-version vX.Y.Z      Check the branch against this upstream version.
  -h, --help                     Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-docker)
      skip_docker="true"
      shift
      ;;
    --require-clean)
      require_clean="true"
      shift
      ;;
    --upstream-version)
      upstream_version="${2:-}"
      shift 2
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

permavent_assert_repository_layout
permavent_prepare_node_runtime
permavent_require_command git

failures=0
branch_name="$(permavent_current_branch)"

if [[ -z "$branch_name" ]]; then
  permavent_error "The repository is in detached HEAD state."
  failures=$((failures + 1))
else
  printf 'Branch: %s\n' "$branch_name"
fi

if [[ -z "$upstream_version" && -n "$branch_name" ]]; then
  upstream_version="$(permavent_version_from_branch "$branch_name")"
fi

if [[ -n "$upstream_version" ]]; then
  permavent_validate_upstream_version "$upstream_version"
  base_branch="$(permavent_expected_base_branch "$upstream_version")"

  if ! git -C "$PERMAVENT_REPOSITORY_ROOT" show-ref --verify --quiet "refs/heads/${base_branch}"; then
    permavent_error "Expected local base branch '${base_branch}' does not exist."
    failures=$((failures + 1))
  elif ! git -C "$PERMAVENT_REPOSITORY_ROOT" merge-base --is-ancestor "$base_branch" HEAD; then
    permavent_error "Current HEAD is not based on '${base_branch}'."
    failures=$((failures + 1))
  else
    printf 'Base branch: %s\n' "$base_branch"
  fi

  if [[ -n "$branch_name" && "$branch_name" != *"-${upstream_version}" && "$branch_name" != "${base_branch}" ]]; then
    permavent_error "Branch '${branch_name}' does not end with '-${upstream_version}'."
    failures=$((failures + 1))
  fi
else
  permavent_error "Could not determine the upstream version from the branch name."
  failures=$((failures + 1))
fi

if [[ "$branch_name" == permavent/custom-v* ]]; then
  printf 'Warning: this is a clean Permavent base branch; use a feature branch for development.\n' >&2
fi

expected_node_version="$(tr -d '[:space:]' < "${PERMAVENT_REPOSITORY_ROOT}/.nvmrc")"
expected_node_version="${expected_node_version#v}"
if ! command -v node >/dev/null 2>&1; then
  permavent_error "Node.js ${expected_node_version} is required but Node.js was not found."
  failures=$((failures + 1))
else
  actual_node_version="$(node --version)"
  if [[ "$actual_node_version" != "v${expected_node_version}" ]]; then
    permavent_error "Node.js v${expected_node_version} is required; found ${actual_node_version}."
    failures=$((failures + 1))
  else
    printf 'Node.js: %s\n' "$actual_node_version"
  fi
fi

expected_yarn_version="$(sed -n 's/.*"packageManager": "yarn@\([^"]*\)".*/\1/p' "${PERMAVENT_REPOSITORY_ROOT}/package.json")"
if ! command -v corepack >/dev/null 2>&1; then
  permavent_error "Corepack is required to run Yarn ${expected_yarn_version}."
  failures=$((failures + 1))
else
  actual_yarn_version="$(cd "$PERMAVENT_REPOSITORY_ROOT" && corepack yarn --version 2>/dev/null || true)"
  if [[ "$actual_yarn_version" != "$expected_yarn_version" ]]; then
    permavent_error "Yarn ${expected_yarn_version} is required; found '${actual_yarn_version:-unavailable}'."
    failures=$((failures + 1))
  else
    printf 'Yarn: %s\n' "$actual_yarn_version"
  fi
fi

working_tree_status="$(git -C "$PERMAVENT_REPOSITORY_ROOT" status --porcelain --untracked-files=normal)"
if [[ -n "$working_tree_status" ]]; then
  if [[ "$require_clean" == "true" ]]; then
    permavent_error "The Git working tree is not clean."
    failures=$((failures + 1))
  else
    printf 'Working tree: contains local changes\n'
  fi
else
  printf 'Working tree: clean\n'
fi

if [[ "$skip_docker" == "false" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    permavent_error "Docker was not found in PATH."
    failures=$((failures + 1))
  elif ! docker info >/dev/null 2>&1; then
    permavent_error "Docker is installed but the Docker daemon is unavailable."
    failures=$((failures + 1))
  elif ! docker buildx version >/dev/null 2>&1; then
    permavent_error "Docker Buildx is unavailable."
    failures=$((failures + 1))
  else
    printf 'Docker: available with Buildx\n'
  fi
fi

if ((failures > 0)); then
  permavent_fail "Preflight failed with ${failures} problem(s)."
fi

printf 'Preflight passed.\n'
