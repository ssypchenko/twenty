#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  printf '%s\n' 'Error: scripts/permavent/lib/common.sh is a Bash library. Do not source it from zsh; run an executable helper directly or activate NVM in the current shell.' >&2
  return 1 2>/dev/null || exit 1
fi

if [[ -n "${PERMAVENT_COMMON_SH_LOADED:-}" ]]; then
  return 0
fi

PERMAVENT_COMMON_SH_LOADED=1
PERMAVENT_SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PERMAVENT_REPOSITORY_ROOT="$(cd "${PERMAVENT_SCRIPT_ROOT}/../.." && pwd)"
PERMAVENT_IMAGE_REPOSITORY="ghcr.io/ssypchenko/twenty"

permavent_error() {
  printf 'Error: %s\n' "$*" >&2
}

permavent_fail() {
  permavent_error "$*"
  exit 1
}

permavent_require_command() {
  local command_name="$1"

  command -v "$command_name" >/dev/null 2>&1 ||
    permavent_fail "Required command '${command_name}' was not found in PATH."
}

permavent_prepare_node_runtime() {
  local nvmrc_path="${PERMAVENT_REPOSITORY_ROOT}/.nvmrc"
  local expected_node_version
  local current_node_version=""
  local nvm_node_bin

  [[ -f "$nvmrc_path" ]] ||
    permavent_fail "Repository .nvmrc was not found at ${nvmrc_path}."

  expected_node_version="$(tr -d '[:space:]' < "$nvmrc_path")"
  expected_node_version="${expected_node_version#v}"

  if command -v node >/dev/null 2>&1; then
    current_node_version="$(node --version 2>/dev/null || true)"
  fi

  if [[ "$current_node_version" == "v${expected_node_version}" ]]; then
    return 0
  fi

  nvm_node_bin="${NVM_DIR:-${HOME}/.nvm}/versions/node/v${expected_node_version}/bin"

  if [[ -x "${nvm_node_bin}/node" ]]; then
    export PATH="${nvm_node_bin}:${PATH}"
  fi
}

permavent_assert_repository_layout() {
  [[ -f "${PERMAVENT_REPOSITORY_ROOT}/package.json" ]] ||
    permavent_fail "Repository package.json was not found at ${PERMAVENT_REPOSITORY_ROOT}."
  [[ -f "${PERMAVENT_REPOSITORY_ROOT}/packages/twenty-docker/twenty/Dockerfile" ]] ||
    permavent_fail "The Twenty production Dockerfile was not found."
}

permavent_current_branch() {
  git -C "$PERMAVENT_REPOSITORY_ROOT" branch --show-current
}

permavent_version_from_branch() {
  local branch_name="$1"

  if [[ "$branch_name" =~ (v[0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  fi
}

permavent_validate_upstream_version() {
  local upstream_version="$1"

  [[ "$upstream_version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
    permavent_fail "Upstream version must use the vX.Y.Z format."
}

permavent_validate_release_number() {
  local release_number="$1"

  [[ "$release_number" =~ ^[0-9]+$ ]] ||
    permavent_fail "Release number must be a non-negative integer."
}

permavent_image_tag() {
  local upstream_version="$1"
  local release_number="$2"

  printf '%s:%s-permavent.%s\n' \
    "$PERMAVENT_IMAGE_REPOSITORY" \
    "$upstream_version" \
    "$release_number"
}

permavent_expected_base_branch() {
  local upstream_version="$1"

  printf 'permavent/custom-%s\n' "$upstream_version"
}

permavent_print_command() {
  printf '  '
  printf '%q ' "$@"
  printf '\n'
}

permavent_run() {
  permavent_print_command "$@"

  if [[ "${PERMAVENT_DRY_RUN:-false}" == "true" ]]; then
    return 0
  fi

  "$@"
}
