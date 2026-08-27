#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

base_ref=""

usage() {
  cat <<'EOF'
Usage: check-boundaries.sh [--base <git-ref>]

Checks changed files for modifications to Enterprise-licensed sources, imports
from known Enterprise row-level permission modules and changes to frozen legacy
TypeORM migrations.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      base_ref="${2:-}"
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
permavent_require_command git

if [[ -z "$base_ref" ]]; then
  branch_name="$(permavent_current_branch)"
  upstream_version="$(permavent_version_from_branch "$branch_name")"
  [[ -n "$upstream_version" ]] ||
    permavent_fail "Use --base because the upstream version could not be derived from the branch name."
  base_ref="$(permavent_expected_base_branch "$upstream_version")"
fi

git -C "$PERMAVENT_REPOSITORY_ROOT" rev-parse --verify "$base_ref" >/dev/null 2>&1 ||
  permavent_fail "Base Git reference '${base_ref}' does not exist."

changed_files_file="$(mktemp)"
added_lines_file="$(mktemp)"
trap 'rm -f "$changed_files_file" "$added_lines_file"' EXIT

{
  git -C "$PERMAVENT_REPOSITORY_ROOT" diff --name-only --diff-filter=ACMRD "${base_ref}...HEAD"
  git -C "$PERMAVENT_REPOSITORY_ROOT" diff --name-only --diff-filter=ACMRD
  git -C "$PERMAVENT_REPOSITORY_ROOT" diff --cached --name-only --diff-filter=ACMRD
  git -C "$PERMAVENT_REPOSITORY_ROOT" ls-files --others --exclude-standard
} | sed '/^$/d' | sort -u > "$changed_files_file"

if [[ ! -s "$changed_files_file" ]]; then
  printf 'Boundary check passed: no changed files.\n'
  exit 0
fi

failures=0

while IFS= read -r file_path; do
  absolute_path="${PERMAVENT_REPOSITORY_ROOT}/${file_path}"

  if [[ "$file_path" == packages/twenty-server/src/database/typeorm/core/legacy-typeorm-migrations-do-not-add/* ]]; then
    permavent_error "Frozen legacy migration changed: ${file_path}"
    failures=$((failures + 1))
  fi

  if [[ ! -f "$absolute_path" ]]; then
    if git -C "$PERMAVENT_REPOSITORY_ROOT" show "${base_ref}:${file_path}" 2>/dev/null |
      awk 'NR <= 5 && /@license Enterprise/ { found = 1 } END { exit !found }'; then
      permavent_error "Enterprise-licensed source deleted or renamed: ${file_path}"
      failures=$((failures + 1))
    fi
    continue
  fi

  if head -n 5 "$absolute_path" | grep -Fq '@license Enterprise'; then
    permavent_error "Enterprise-licensed source changed: ${file_path}"
    failures=$((failures + 1))
  fi

  case "$file_path" in
    *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs)
      : > "$added_lines_file"

      if git -C "$PERMAVENT_REPOSITORY_ROOT" ls-files --error-unmatch "$file_path" >/dev/null 2>&1; then
        {
          git -C "$PERMAVENT_REPOSITORY_ROOT" diff --unified=0 "${base_ref}...HEAD" -- "$file_path"
          git -C "$PERMAVENT_REPOSITORY_ROOT" diff --unified=0 --cached -- "$file_path"
          git -C "$PERMAVENT_REPOSITORY_ROOT" diff --unified=0 -- "$file_path"
        } | awk '/^\+\+\+/{next} /^\+/{print substr($0, 2)}' > "$added_lines_file"
      else
        cp "$absolute_path" "$added_lines_file"
      fi

      if grep -En \
        '(row-level-permission-predicate|flat-row-level-permission-predicate|RowLevelPermissionPredicate)' \
        "$added_lines_file" >/dev/null; then
        permavent_error "Changed code references an Enterprise row-level permission module or type: ${file_path}"
        failures=$((failures + 1))
      fi
      ;;
  esac
done < "$changed_files_file"

if ((failures > 0)); then
  permavent_fail "Boundary check failed with ${failures} problem(s)."
fi

printf 'Boundary check passed for changes against %s.\n' "$base_ref"
