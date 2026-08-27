#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

image_tag=""
upstream_version=""

usage() {
  cat <<'EOF'
Usage: verify-production-image.sh --image <image-tag> --upstream-version vX.Y.Z

Checks production image metadata and required backend, frontend and email build
outputs. The script never pushes the image.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)
      image_tag="${2:-}"
      shift 2
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

[[ -n "$image_tag" ]] || permavent_fail "--image is required."
[[ -n "$upstream_version" ]] || permavent_fail "--upstream-version is required."
permavent_validate_upstream_version "$upstream_version"
permavent_require_command docker

docker image inspect "$image_tag" >/dev/null 2>&1 ||
  permavent_fail "Image '${image_tag}' is not available locally."

architecture="$(docker image inspect "$image_tag" --format '{{.Architecture}}')"
operating_system="$(docker image inspect "$image_tag" --format '{{.Os}}')"
image_user="$(docker image inspect "$image_tag" --format '{{.Config.User}}')"
entrypoint="$(docker image inspect "$image_tag" --format '{{json .Config.Entrypoint}}')"
environment="$(docker image inspect "$image_tag" --format '{{range .Config.Env}}{{println .}}{{end}}')"
source_label="$(docker image inspect "$image_tag" --format '{{index .Config.Labels "org.opencontainers.image.source"}}')"
revision_label="$(docker image inspect "$image_tag" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
version_label="$(docker image inspect "$image_tag" --format '{{index .Config.Labels "org.opencontainers.image.version"}}')"
created_label="$(docker image inspect "$image_tag" --format '{{index .Config.Labels "org.opencontainers.image.created"}}')"
expected_source="$(git -C "$PERMAVENT_REPOSITORY_ROOT" config --get remote.origin.url)"
expected_revision="$(git -C "$PERMAVENT_REPOSITORY_ROOT" rev-parse HEAD)"

failures=0

check_value() {
  local label="$1"
  local actual_value="$2"
  local expected_value="$3"

  if [[ "$actual_value" != "$expected_value" ]]; then
    permavent_error "${label} must be '${expected_value}'; found '${actual_value}'."
    failures=$((failures + 1))
  else
    printf '%s: %s\n' "$label" "$actual_value"
  fi
}

check_value "Architecture" "$architecture" "amd64"
check_value "Operating system" "$operating_system" "linux"
check_value "User" "$image_user" "1000"
check_value "Entrypoint" "$entrypoint" '["/app/entrypoint.sh"]'
check_value "OCI source label" "$source_label" "$expected_source"
check_value "OCI revision label" "$revision_label" "$expected_revision"
check_value "OCI version label" "$version_label" "$upstream_version"

if [[ ! "$created_label" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; then
  permavent_error "OCI created label is missing or invalid: '${created_label}'."
  failures=$((failures + 1))
else
  printf 'OCI created label: %s\n' "$created_label"
fi

if ! grep -Fxq "APP_VERSION=${upstream_version}" <<< "$environment"; then
  permavent_error "APP_VERSION=${upstream_version} is missing from the image environment."
  failures=$((failures + 1))
else
  printf 'APP_VERSION: %s\n' "$upstream_version"
fi

if ! grep -Fxq 'NODE_ENV=production' <<< "$environment"; then
  permavent_error "NODE_ENV=production is missing from the image environment."
  failures=$((failures + 1))
else
  printf 'NODE_ENV: production\n'
fi

if ! docker run --rm --platform linux/amd64 --entrypoint /bin/sh "$image_tag" -c '
  test -x /app/entrypoint.sh &&
  test -s /app/packages/twenty-server/dist/main.js &&
  test -s /app/packages/twenty-server/dist/front/index.html &&
  test -d /app/packages/twenty-emails/dist
'; then
  permavent_error "Required production build outputs are missing from the image."
  failures=$((failures + 1))
else
  printf 'Image contents: backend, frontend and email outputs are present\n'
fi

email_render_check='const React = require("react");
const {
  PasswordResetLinkEmail,
  SendInviteLinkEmail,
  renderEmail,
} = require("twenty-emails");

const passwordProps = {
  duration: "24 hours",
  link: "https://crm.example.test/auth",
  locale: "en",
};
const inviteProps = {
  link: "https://crm.example.test/invite",
  workspace: { name: "Example workspace", logo: undefined },
  sender: {
    email: "sender@example.test",
    firstName: "Example",
    lastName: "Sender",
  },
  serverUrl: "https://crm.example.test",
  locale: "en",
};

(async () => {
  const checks = [
    {
      message: React.createElement(PasswordResetLinkEmail, {
        ...passwordProps,
        hasPassword: true,
      }),
      expectedValues: [passwordProps.duration, passwordProps.link],
      forbiddenValues: ["{duration}"],
    },
    {
      message: React.createElement(PasswordResetLinkEmail, {
        ...passwordProps,
        hasPassword: false,
      }),
      expectedValues: [passwordProps.duration, passwordProps.link],
      forbiddenValues: ["{duration}"],
    },
    {
      message: React.createElement(SendInviteLinkEmail, inviteProps),
      expectedValues: [
        inviteProps.link,
        inviteProps.workspace.name,
        inviteProps.sender.email,
      ],
      forbiddenValues: ["{workspaceName}", "{senderEmail}", "{senderName}"],
    },
  ];

  for (const { message, expectedValues, forbiddenValues } of checks) {
    const html = await renderEmail(message);
    if (typeof html !== "string" || html.length === 0) {
      throw new Error("Email rendering returned empty output.");
    }

    for (const expectedValue of expectedValues) {
      if (!html.includes(expectedValue)) {
        throw new Error(`Email rendering omitted expected value: ${expectedValue}`);
      }
    }

    for (const forbiddenValue of forbiddenValues) {
      if (html.includes(forbiddenValue)) {
        throw new Error(`Email rendering retained placeholder: ${forbiddenValue}`);
      }
    }
  }

  console.log("Email rendering: password reset, password set and invitation passed");
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});'

if ! docker run --rm --platform linux/amd64 --entrypoint node "$image_tag" -e "$email_render_check"; then
  permavent_error "Production email rendering failed."
  failures=$((failures + 1))
fi

if ((failures > 0)); then
  permavent_fail "Production image verification failed with ${failures} problem(s)."
fi

printf 'Production image verification passed.\n'
printf 'Publication remains manual. Run this command in the project owner Terminal:\n'
permavent_print_command docker push "$image_tag"
