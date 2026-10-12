# Permavent Twenty 2.46.0 — implementation branch entry

**Created:** 2026-10-12. **Current state:** documentation-only Stage 1 checkpoint; NO Permavent application code yet ported, built or tested.

## Branch contract

- This branch `permavent/port-v2.46.0` was created from the immutable upstream source `twenty/v2.46.0`, commit `9070979232c4f37165108a2eb5a4042e0cfdc3d6`.
- Preserve the sibling `permavent/upstream-v2.46.0` as an **unmodified clean source**. Do not rebase it onto `main`.
- Our actual accepted source is `ssypchenko/twenty/main` at `7546570ec82fcd7d1a3b7d7599c161d11c044424`, **not** the older `permavent/prod-v2.35.2` branch.
- The control/evidence branch is `permavent/upgrade-v2.46.0-preparation`; it is still based on the old accepted 2.35.2 code and is not the 2.46 code branch.

## Required reading before changing source

- [Full migration plan](https://github.com/ssypchenko/twenty/blob/permavent/upgrade-v2.46.0-preparation/docs/change-plans/20261012-twenty-v2.46.0-upgrade-plan.md)
- [Stage 0 assessment](https://github.com/ssypchenko/twenty/blob/permavent/upgrade-v2.46.0-preparation/docs/change-plans/20261012-twenty-v2.46.0-stage0-assessment.md)
- [Stage 1 source inventory and all 21 commit decisions](https://github.com/ssypchenko/twenty/blob/permavent/upgrade-v2.46.0-preparation/docs/change-plans/20261012-twenty-v2.46.0-stage1-source-inventory.md)
- [Per-file disposition (198 paths)](https://github.com/ssypchenko/twenty/blob/permavent/upgrade-v2.46.0-preparation/docs/change-plans/evidence/20261012-stage1-port-disposition.json)
- [Live/Test safety handover](https://github.com/ssypchenko/twenty/blob/permavent/upgrade-v2.46.0-preparation/docs/change-plans/handovers/20261012-twenty-v2.46.0-upgrade-handover.md)

## Invariants for Stage 2

- Stage 1 mapped 198 custom paths: 61 upstream changed files, 34 unchanged upstream, 97 custom-only, two missing/renamed paths, two target path collisions, and two previously removed files that still exist upstream. The exact file/commit matrix is in the linked evidence.
- The old `twenty/v2.35.2` tag is **not** an ancestor of the new target tag: three old-release commits diverged. Inspect their migration/permissions/metadata functionality.
- The upstream global comparison is 1847 commits; GitHub API only returned 300 changed file entries. Do a full local rename-aware `git diff` before bulk porting.
- Make small, reviewable commits by feature. Never blindly cherry-pick old GraphQL generated code, obsolete UI resizer modules, old database upgrade commands, or old security/permissions handlers.
- Preserve existing Sales Scope/Delegated MCP auth, audit, weekly sales report, interpreter, Company/Branch wide panel, opening tab and user schema; all four Git Apps remain on unsupported <2.36 server ranges until SDK compatibility tests.
- Runtime review, target OCI digest and independent backup/restore are still blocking **Test/Live** migration. This documentation-only commit must not be mistaken for a completed port or an authorised deployment.
