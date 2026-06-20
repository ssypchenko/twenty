# Permavent Twenty Fork Agent Instructions

These instructions apply to the whole repository on Permavent custom branches.
Keep clean base branches aligned with upstream and do not add Permavent-only files to them.

## Language

- Repository documentation, code comments, user-visible application text, console output, debug output and log messages must use British English.
- The assistant may reply to the project owner in Russian unless asked otherwise.
- Do not mix Russian into repository files unless the project owner explicitly requests a Russian-only note.

## Working Style

- Inspect existing patterns before editing code.
- Prefer small, focused changes.
- Do not refactor unrelated code or overwrite user changes.
- Keep operational documentation aligned with build, publication and deployment changes.
- Ask before making broad architectural changes.

## Security

- Never hard-code or print secrets, connection strings, tokens, tenant IDs or passwords.
- Do not store GHCR credentials in the repository or documentation.
- Do not include production data in examples, documentation, tests or logs.
- Use sanitised sample values in commands and fixtures.

## Canonical Runtime

- Use Node.js `24.16.0`, as defined in `.nvmrc` and the Twenty Dockerfile.
- Use the repository Yarn release through Corepack or `.yarn/releases/yarn-4.13.0.cjs`.

## GHCR Production Image

- Every image intended for GHCR or Test/Live deployment must explicitly use Docker target `twenty`.
- Never publish the Dockerfile default final stage, `twenty-app-dev`, `twenty-server` or any temporary verification image.
- Every release build must specify `--platform linux/amd64`, `--target twenty` and `--build-arg APP_VERSION=<upstream-version>`.
- Build directly with the final `ghcr.io/ssypchenko/twenty:<tag>` tag. Avoid extra local aliases unless they are required temporarily for diagnosis.
- Verify the target, platform, `APP_VERSION`, entrypoint, frontend asset and email render output before pushing.
- Record the published OCI digest before changing Test or Live.
- The project owner always runs `docker push` manually in their own Terminal. The agent must provide the exact command but must not execute or background a `docker push` command.
- After the project owner reports that the push has finished, the agent verifies the GHCR tag, platform and registry digest before deployment.

The canonical workflow is documented in `../docs/twenty-migration/05-custom-image-build-publish-and-cleanup.md` relative to the workspace root.

## Long-Running Commands

- Treat Docker builds, large image pushes or pulls, dependency installation, full repository builds and long test suites as long-running commands.
- `docker push` is a special case: the project owner runs it manually; the agent only supplies the command and verifies the result afterwards.
- Start only one long-running command at a time. Do not start parallel status commands while it is running.
- Do not keep an agent turn open by repeatedly polling a long-running command.
- Start the command as a durable detached job with a dedicated log and exit-status file. If reliable detachment is unavailable, provide the exact command for the project owner to run manually instead.
- After starting the command, end the turn and report:
  - the command purpose;
  - its PID when available;
  - the log path;
  - the exit-status path;
  - how the project owner can observe it in Docker Desktop or Activity Monitor;
  - the exact message the project owner should send when it appears complete.
- Activity Monitor or reduced CPU usage is only a completion hint. When the project owner returns, check the exit status, final log lines and expected output artifact before declaring success.
- If the process is still running, report that state and return control without waiting.
- Never restart a long-running command until the previous process and its output have been checked.

## Docker Storage

- Inspect Docker storage after every completed image build.
- Keep at most the current production image and one previous rollback image locally until Test verification completes.
- After the image is pushed and its registry digest is recorded, remove temporary verification images and redundant local aliases.
- After Test verification succeeds, remove the previous local production image unless it is still required for an imminent Live rollback. Registry copies are the durable rollback source.
- Keep the local BuildKit cache at or below 8 GB after a successful build and publication cycle.
- Prefer exact `docker image rm <tag>` commands and scoped `docker buildx prune` commands.
- Never run `docker system prune -a` for this project.
- Never prune Docker volumes as part of image cleanup.
- Before removing an image on a server, confirm that no running container uses it and that the required rollback image exists in GHCR.

## Verification

- After code changes, run relevant formatting, build and tests when available.
- For email changes, render password reset, password set and invitation templates from the production image.
- If verification cannot run, state why and provide practical manual checks.
- Documentation-only changes require link, command and secret-leak checks but not a runtime build.

## Git Hygiene

- Preserve unrelated user changes.
- Keep generated logs, status files, reports, local state and caches out of commits.
- Use focused commits on `permavent/custom-*` branches.
- Do not push commits or images unless the project owner has authorised publication.
