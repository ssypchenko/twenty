# Twenty 2.46.0 — Permavent manual acceptance checklist (Test only)

**Prepared:** 2026-10-13. **Operator:** owner, in browser and optionally an authenticated native MCP client. **Target:** `https://crm-test.permavent.co.uk` (never Live), Core image `ghcr.io/ssypchenko/twenty:v2.46.0-permavent.stage5-ecc93f976d54`, source `ecc93f976d5495c0340603c4646f1d93f3e26413`. Test CLI upgrade **12/12 successful workspaces**; owner says Test browser starts and displays 2.46.0. Test worker remains **stopped** at the checkpoint; all four Apps are **not yet applied**. No screenshots, UI acceptance or role-specific successful interactions are yet reported.

## Before testing

- Record outcome per ID: **PASS / FAIL / SKIP**. When FAIL, capture exact screen, current user role, object/record, expected versus actual and screenshot. When SKIP, capture why (App not deployed, missing feature flag, no matching ERP customer, missing report config, worker stopped).
- Use a Test administrator (Security and Layout rights), a restricted **Sales Rep** assigned a specific ERP sales territory, optionally a Sales Manager, and if possible an additional user without Security or write rights. Do not use Live customers for mutations; make uniquely named disposable TEST records and clean them up only after successful audit checks.
- Choose actual Test examples before starting: one Company linked to ERP via `erpCustomerCode`, one Branch linked via `erpDeliveryContactCode`, one Company/Branch with no ERP link, an `NSR` Company with valid Branch, and a Company with exactly one in-scope Branch. Where no sample exists, SKIP rather than invent a result.
- The `IS_PERMAVENT_COMPANY_WIDE_SIDE_PANEL_ENABLED` feature flag controls wide side-panel/Opening Tab features. The user-audit recorder also requires `PERMAVENT_USER_AUDIT_ENABLED` and object audit-logging to be enabled; absence of events under disabled conditions is not proof of failure.
- The Test SMTP host/from-address matches Live, even though the owner says Test does **not** send real email. **Do not click Send invite / password reset / real SharePoint Publish until a harmless Test-only destination is independently confirmed.** ERP requests are Read Only by owner confirmation.
- `CODE_INTERPRETER_TYPE=DISABLED`: do not expect functional Python Code Interpreter execution yet. The external Python ERP MCP is **not** Twenty's built-in CRM MCP.

## A — Now: Twenty Core 2.46, server running, worker stopped

| ID | Navigate / action | Expected manual result |
| --- | --- | --- |
| A01 | Test URL → login as Admin; open About/version indicator | Twenty **2.46.0**, no blank screens or repeated errors; saved workspace session works |
| A02 | Main navigation → **Companies**, **People**, **Opportunities**, **Tasks**; open existing records | Original data and relations remain visible; no schema/GraphQL error, record view opens |
| A03 | **Companies** → existing test company → change one harmless field → reload | Change persists and is visible; edit permitted for Admin; use a distinct disposable test value |
| A04 | **Companies** → a Company with a **Branch** relation → open Branch | Relation, existing custom ERP identifiers, contact/ownership fields and branch navigation survived |
| A05 | **Settings → Workspace → Data model** → Company and Branch metadata/custom object list | `Branch` and historically configured custom objects/fields (ERP customer/delivery codes, Sales Rep assignment, custom relations) still exist; don't edit schema during this review |
| A06 | Admin → **Companies / My Companies** and **Branches / My Branches** where configured; Sales Rep account repeat | Admin sees allowed records, Sales Rep focuses on assigned owner/ERP territory; unrelated territory should not appear under restricted views; filters/search remain usable |
| A07 | Company list → click a Company to open **side panel**; repeat for a Branch | Native side panel works with correct record and relations; when wide-panel feature enabled, Company/Branch panel is wider, resizable and preserves width across reopen |
| A08 | **Settings → Workspace → Layout** → Company or Branch record layout → edit tab menu → `Use as opening tab` → save; open record in side panel | Chosen tab opens automatically on side panel (and mobile). The selected tab menu now says `Default opening tab`; switching the setting, removing/renaming a tab and reopening should not leave a blank panel. Feature-flag dependent |
| A09 | Company/Branch record → **Notes** widget/card | Compact list shows date plus preview; click row opens Note; New note works and shows after reload; empty state says `No notes` when applicable |
| A10 | Company/Branch record → **Tasks** widget/card | Compact list prioritises open tasks, shows count and New task; selecting a task opens it; no duplicated relationship pills on compact rows; empty state `No open tasks` as applicable |
| A11 | Switch to mobile-sized browser window; reopen Company/Branch, tabs, Notes/Tasks | Tab/default opening behavior and compact widgets usable; no clipped controls; return to desktop |
| A12 | **Settings → Workspace → General** as Admin → **User activity log** tab | Tab is present only for principal with `Security`; user, action, record type, period and advanced Record ID filters render without GraphQL errors. With worker stopped, new events need not show yet |
| A13 | Log in as restricted Sales Rep and a role without `Security`; return to Settings → General | `User activity log` / `Security` / `Logs` tabs unavailable to roles without that permission; direct protected audit GraphQL request should be refused rather than return rows |
| A14 | Restricted Sales Rep → Companies/Branches in/out of assigned territory; attempt a forbidden field/edit | Only role-authorised data visible; operations outside role/row/field rights denied. An Admin should still edit its allowed test record |
| A15 | **Settings → Workspace → MCP & APIs** as authorised user | Built-in Twenty 2.46 MCP/API configuration is present as appropriate to role. For a full MCP operation test see A16; this is not the independent Permavent ERP MCP |
| A16 | Using a separate authenticated **Twenty CRM native MCP client**, if connected: list tool catalogue, read record, create/update disposable record; repeat as restricted actor | Tools catalogue/read works; authorised write accepted; out-of-role/field/cross-workspace write denied. If no native MCP client/token configured: SKIP, **not a browser-only pass** |
| A17 | **Settings → Layout** → existing record-page layout → verify other historical custom tabs/widgets | Existing tabs/widgets and identifiers survived migration, edits/save in Test work; no accidental layout reset |
| A18 | Switch dark/light theme (if available), refresh and repeat key panels | Text, widgets, compact list controls, dates and side panels remain readable |

## B — Only after the **Test worker 2.46** is started and healthy

| ID | Navigate / action | Expected manual result |
| --- | --- | --- |
| B01 | As Admin → edit harmless test record; **Settings → General → User activity log**, wait for queued processing, reload | A `UPDATED` event (and `CREATED` for new records) with correct actor, timestamp, object and changed fields appears when recording enabled and audited object opted in |
| B02 | User activity log → filter **User**, **Action**, **Record type**, period; click record and use advanced Record ID | Results filter as selected, record link opens correct side panel. Sensitive values and rich content are omitted/redacted, not leaked |
| B03 | Sales Rep → edit permitted test record; try denied mutation, then Admin reviews log | Permitted action attributed to the Sales Rep (not an admin/API key). `RLS_DENIED` may appear if the rejected path is instrumented; it must not leak protected values |
| B04 | Create/update tasks or workflow-triggered test activity; refresh UI | Worker-backed jobs/events process and result appears without unexpected notification to real users |
| B05 | Settings/security, invitation/email-related UI: inspect only safe previews/branding where available | Company branding/subject localization preserved. Do not send real mail from Test unless confirmed safe |

## C — Only after the **four Apps** have been applied on upgraded Test and their variables configured

Apps are separate from the Core Docker image: `My Area`, `Sales Statistics`, `Sales History`, `Weekly Sales Report` missing **now** is expected, not a Core failure. For each App first perform read-only `corepack yarn twenty --remote test plan`; check destructive changes, only then apply via the guarded Test-only workflow. Source compilation passed locally; actual Test App apply remains pending.

| ID | Navigate / action | Expected manual result |
| --- | --- | --- |
| C01 | **Settings → Workspace → Apps** as Admin | Four registered Apps have correct status/permissions/configuration after Test apply. No unexpected deleted layouts/objects |
| C02 | **Companies** → ERP-linked Company → **Sales History** tab | Monthly product results for ERP default last 12 months; columns `Month`, `Product`, `Quantity`, `Avg unit price`. Code before product description, months newest-first, products code-sorted |
| C03 | Same Sales History and a linked **Branch** record → **Sales History** | Values belong to Company `erpCustomerCode` vs Branch `erpDeliveryContactCode` respectively; **no margin column and no `After rebates` field**, even for Admin. Null price shows `—`, amounts GBP with two decimals |
| C04 | Sales History → reopen tab; click `Refresh`; inspect last updated/period notice | Cache does not mix Company/Branch or sales scopes; manual Refresh retrieves fresh data; product count/period/territory notice shown. Empty linked record says no sales, unlinked record says not linked rather than error |
| C05 | Sales History as restricted Sales Rep versus Admin/Sales Manager | Only server-derived assigned territory for Sales Rep; Admin/Manager all-territory when configured. No browser access to API key, no user-selectable override of `SALESREP` |
| C06 | Main navigation → **My Area** as Sales Rep | Standalone searchable list of owned/ERP-assigned Companies and Branches; unrelated territory excluded. Selecting Company or Branch opens native Twenty side panel |
| C07 | My Area → inspect `NSR` Company and its Branch | The `NSR` Company row is hidden; its valid Branch may remain visible. A visible in-scope Company with exactly one in-scope Branch appears **without a redundant Branch row**. Orphaned Branch not shown |
| C08 | My Area → search, filter Company/Branch, check row grouping/sort | Search and type filters work locally, Company before its eligible Branches; filter doesn't change the one-Branch deduplication rule |
| C09 | My Area → **Monthly** and **YTD** target tabs as Sales Rep with unique active primary assignment | Monthly and January-to-current-month cumulative target, forecast and completion percentage; colour/pace consistent with progress. If no primary assignment, target panel may legitimately be absent |
| C10 | Main navigation → **Sales Statistics** expandable folder | Three reports open: Top Spending, Customers Without Recent Invoices (Lapsed), and Declining Sales |
| C11 | Sales Statistics → **Top Spending** → 10/20/50/All | Net Sales, period is most recent 90-day invoice window; number of rows respects selection; descending order. Net Sales is after discount and potential rebate as per ERP contract |
| C12 | Sales Statistics → **Customers Without Recent Invoices** → sample rows | Customer with orders within 365 days but no invoice within 90 days; `Orders Net Amount`, last order date and days since last order readable |
| C13 | Sales Statistics → **Declining Sales** | YTD current vs same period previous year: `This year`, `Last year`, `Difference`, `Difference %`. Largest monetary drop first; prior-year zero shows percentage `—` |
| C14 | Click linked Company and Branch in statistics; repeat on narrow screen | Exactly matching native Company/Branch panel opens; missing/inaccessible/ambiguous CRM match fails safely; mobile results use readable cards |
| C15 | All 3 statistics reports as Sales Rep versus Admin/Sales Manager | Territory scoped by server for Sales Rep; privileged role all-territory when authorised. Invalid/absent rep scope shows no ERP results instead of broad fallback |
| C16 | Navigation → **Weekly Sales Report** as Sales Rep → Generate current week | Server-derived current actor; period Monday 00:00 Europe/London to generation time; background Python integration returns job/status; closing/reopening page does not create duplicate or cancel work. Requires app variables, server feature and external Python endpoint |
| C17 | Weekly Sales Report → draft preview and review items | Emails/Notes grouped Branch before Company; unlinked/ambiguous activity under Review with reason; internal email without CRM Person under Internal Work. Links open source CRM Note/message if permitted |
| C18 | Weekly Sales Report → change draft text → Save → leave/reopen | Saved revision and text persist. Unsaved edits cannot be published; regeneration asks confirmation because it replaces edits; published report is read-only |
| C19 | Weekly Sales Report as another Sales Rep / Manager without matching Sales Rep actor | Cannot read, edit, generate or publish another actor's report; cannot supply another actor from browser. Missing external Python routing/key should give explicit error, not silent success |
| C20 | Weekly Sales Report → **Publish** | **SKIP by default:** do not execute a real SharePoint publish without confirming a Test-only destination and explicit permission; only inspect preview/confirmation in ordinary migration checks |

## D — Release decisions

- **Core browser gate:** A01–A15 and A17–A18 PASS, or documented SKIP for known disabled feature flags. A16 (MCP CRUD) separately tested before claiming native MCP security acceptance.
- **Worker gate:** B01–B04 PASS or justified SKIP when recording/automation is disabled on Test.
- **Apps gate:** All four remote plans reviewed, no unapproved destructive changes, four app applies complete, C01–C19 PASS or explicitly justified SKIP; C20 requires a safe test SharePoint destination.
- **Block Live** on missing historical record data, cross-role data leakage, audit leaks, wrong ERP territory, incorrect sales price/metric, unsafe SMTP, unexpected real SharePoint publish, wrong customer/branch navigation, or broken Company/Branch layouts. Cosmetic/disabled Test-only features may be triaged separately.
- **No inference:** developer unit/typecheck and Test server health do not establish user-role/ERP/UI/MCP/Apps correctness. Capture screenshots, role, record and labels for any FAIL.

## Reference sources

- Core: `docs/change-plans/20261012-twenty-v2.46-stage2-progress-handover.md`; source `SettingsGeneral.tsx`, `SettingsUserActivityLog.tsx`, `PermaventOpeningTabSettingsItem.tsx`, `useIsPermaventCompanyWideSidePanel.ts`, native Twenty MCP and User Audit modules.
- Apps: `ssypchenko/permavent-twenty-apps` on `permavent/upgrade-apps-v2.46.0`; `apps/*/README.md`, `docs/capabilities/*`, and `docs/handovers/20261013-twenty-v2.46-apps-migration.md`.
