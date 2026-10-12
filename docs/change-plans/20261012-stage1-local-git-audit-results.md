# Stage 1 — accepted local Git audit (2026-10-12)

**Input:** user-supplied `twenty-stage1-audit-20261012.zip` produced on their Mac from source repository. This report distinguishes actual local Git evidence from targeted later GitHub source examination. No source port, build, deployment, Test/Live migration or changes to source files were carried out.

## Verified exact refs and repository status

| Item | Result |
| --- | --- |
| Fork remote | `origin https://github.com/ssypchenko/twenty.git`; upstream remote points to `twentyhq/twenty` |
| `origin/main` | `7546570ec82fcd7d1a3b7d7599c161d11c044424` (accepted build branch) |
| Original upstream tag | `twenty/v2.35.2` = `b1c895c44bfa36537c4ab0be10b171c876e05336` |
| Target upstream tag | `twenty/v2.46.0` = `9070979232c4f37165108a2eb5a4042e0cfdc3d6` |
| Merge base | `315697a079506621110a1e9ae65293c80b5df38e` |
| Ahead/behind (old vs target) | 3 old-only commits; 1,847 target-only commits |
| Local worktree status at audit | Empty status output (clean at moment of capture) |
| Target tree | 37,388 file paths |

All named refs were verified by the user's scripted `git cat-file` / `git rev-parse` checks, which did not abort.

## Complete upstream rename-aware inventory

User's exact local Git operations:
- `git diff --find-renames=50% -l0 --name-status BASE TARGET` returned **23,861 name-status records**:
  - **10,562** added (`A`).
  - **7,702** modified (`M`).
  - **2,208** deleted (`D`).
  - **3,389** detected renames (`R`), with variable similarity percentages. Rename detection is a *Git heuristic* and may mispair same-content but unrelated files; interpret suspicious `R100` results cautiously.
- `git diff --no-renames --name-only BASE TARGET` contained **27,250 paths**.
- Custom fork `git diff --find-renames=50% -l0 --name-status BASE FORK` contained **198** records: **99** additions, **97** modifications, **2** deletions.

### Critical correction: the empty conflict candidate file is incorrect

The uploaded `conflict-candidates.txt` contained **0 entries**, but the raw source file sets independently give:

- **65** path overlaps between the 198 custom file paths and the upstream 27,250 changed paths.
- Overlap classification per full rename-aware upstream name-status inventory: **61 upstream modified**, **2 upstream deleted**, **2 upstream added**.
- Exactly the 65 hazardous-path categories previously established via GitHub blob probes: `UPSTREAM_CHANGED_REBASE_MANUALLY=61`; `UPSTREAM_REMOVED_OR_MOVED=2`; `ADDED_PATH_COLLISION=2`. No disagreement between independent methods.

**Probable explanation:** the script sorted lists with `LC_ALL=C sort` but called `comm -12` without `LC_ALL=C`. On the original macOS terminal the locale-specific collation order may have made `comm` return no intersection. Source files are trustworthy; the derived empty output is not. No new scan is required; the 65 names are marked as `local_git_upstream_overlap_status` in the [machine-readable Stage 1 matrix](evidence/20261012-stage1-port-disposition.json).

Reproduction on the same Mac with explicit consistent locale:
`LC_ALL=C comm -12 permavent-files.txt upstream-changed-files.txt | wc -l` => expected **65**. This is not an actual rerun on the Mac; it is a validated recomputation using its archived files.

**Terminology:** these are **overlap / merge review candidates**, not 65 proven textual conflicts. Also review the two files removed *by our fork* but still present upstream, and the 97 custom-only paths requiring integration.

### Two paths removed rather than renamed in upstream

Exact `D` records, not `R`, in the complete local Git inventory:

1. `packages/twenty-front-component-renderer/src/types/FrontComponentExecutionContext.ts`. The target still has `packages/twenty-sdk/src/sdk/front-component/types/FrontComponentExecutionContext.ts` plus renderer remote worker get/set/seed context utilities, but no direct detected rename. Review new context owner and app token pair before transferring workspace member identity.
2. `packages/twenty-front/src/modules/ui/layout/resizable-panel/components/ResizablePanelGap.tsx`. No same-path direct rename. The target `SidePanelForDesktop.tsx` implements dragging using `isResizablePanelDraggingState`; integrate responsive/keyboard resize against its new lifecycle.

Both old locations are absent from the target tree.

### Two added-file collisions

The old fork marked these as `A`, but upstream 2.46 already contains them (so they appear in the upstream non-rename list as `A`):

- `packages/twenty-server/src/engine/api/graphql/workspace-query-runner/listeners/__tests__/entity-events-to-db.listener.spec.ts`
- `packages/twenty-server/src/engine/workspace-manager/workspace-migration/utils/__tests__/compute-ordered-migration-actions.util.spec.ts`

Merge tests rather than overwriting upstream coverage.

## Three old-release-only commits — provenance and target check

The local audit lists:
1. [`ddf58fe31af0e663ee8894fcf050e83395d387a6`](https://github.com/twentyhq/twenty/commit/ddf58fe31af0e663ee8894fcf050e83395d387a6) — ORM field metadata projection held on record-query path.
2. [`8a70fa278a0659c6250548df7294b4598beed7f3`](https://github.com/twentyhq/twenty/commit/8a70fa278a0659c6250548df7294b4598beed7f3) — timeline activity `searchVector` deletion and `TS_VECTOR` restoration.
3. [`b1c895c44bfa36537c4ab0be10b171c876e05336`](https://github.com/twentyhq/twenty/commit/b1c895c44bfa36537c4ab0be10b171c876e05336) — repair physical `searchVector` column if removed by cascade.

Their combined merge-base -> old-tag patch spans **46 distinct paths** (40 modified, 6 added); this is not 46 additional customisations by Permavent.

**Source-level findings against exact `twenty/v2.46.0`:**
- The `2-35-workspace-command-1787749300000-backfill-timeline-activity-search-field-metadata.command.ts` file **exists** in 2.46. Its **309 lines** compare to 309 in 2.35; a direct read found exactly one changed line — the renamed `UniversalUpdateFieldAction` type import. The `RegisteredWorkspaceCommand('2.35.0', 1787749300000)` and searchVector repair logic remain. **No reason to cherry-pick this old command.** Its actual execution state in our workspace still must be assessed during isolated Test.
- `OrmFlatFieldMetadata` type and `workspace-orm-flat-field-metadata-map-cache.service.ts` exist in 2.46. The old cache method's derived-map invalidation is present in target through `withDerivedFieldMetadataMaps` helper; this is a refactor.
- The old `engine/twenty-orm/global-workspace-orm.manager.ts` path is **absent** in target; newer `engine/twenty-orm/workspace-orm.manager.ts` exists and consumes `flatFieldMetadataMapsOrm`. Current `build-row-level-permission-record-filter.util.ts` uses `OrmFlatFieldMetadata`.
- These checks support *functional equivalent presence* for core source-level concepts. They do **not** prove permission correctness, migration application, feature availability or search-vector integrity for our existing historical workspace.

**Recommendation:** do **not** automatically cherry-pick the three old-release-only commits, replace target files with 2.35 ones, or replay database patches. In Stage 2/4 run: searchVector metadata and physical generated column inspection on an isolated clone; workspace CRM search and upgraded timeline activity; metadata cache invalidation after field creation/update; ORM create/update/read and permission denial tests. If any fail, fix the target version-specific behaviour based on evidence.

## Next stage and remaining gates

- Source inventory and local rename-aware comparison **complete**. Source port starts in `permavent/port-v2.46.0`, not clean `permavent/upstream-v2.46.0` and not the old 2.35-based planning branch.
- First implement auth/permission and business-scope changes carefully: record-level sharing and `RawAuthContext` changes in 2.46; never widen API/MCP access just to satisfy tests.
- Four Twenty Apps (and one workspace-local Custom app) remain separate compatibility/migration work.
- **Not performed:** actual three-way patch/cherry-pick dry-run, typecheck/unit tests, integration tests, lockfile audit, OCI image digest validation, backup/restore rehearsal or server inspection. Stage 0 blocks Test/Live rollout. Source code remains unmodified.
