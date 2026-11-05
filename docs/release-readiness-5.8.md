# Navigator release readiness 5.8

The release targets the existing free-hosted procedural guide, not a shared case-management database. Account and plan data remain server-side; case choices remain in tab memory or user-controlled recovery files. 5.8 adds explicitly opt-in updates to a native user-selected file. No file handle is persisted between tabs or restarts.

## Resolved in this release

Recovery: prominent current-step unsaved control; explicit opt-in file updates every 15 seconds after an initial verified native Save; exclusive write lock, external-change check before and after lock acquisition, bounded/schema-validated export and read-back; stops on permission/write/corruption failures, restore, restart and scenario switch. A cancelled replacement does not resume writing to a previous case file. Fallback downloads continue to require an actual saved-file check. Closing or browser suspension before the next successful verification can still lose unsaved work; no browser can safely guarantee the final write on abrupt exit.

Customer journey: new accessible Help and recovery page linked from account and workspace; sign-in, first use, file contents, local updates, completion, manual renewal and outage instructions. No unsupported promise of automatic billing, background legal reminders, guaranteed uptime or confidential case storage.

Operations: documented access activation, expiry boundaries, manual renewal verification, safe support intake, incident handling, preflight/release verification and rollback procedure. Prior 5.7 source remains the rollback baseline. 5.8 changes no database schema, permissions or entitlements and retains schema-2 recovery and legacy-import support.

Accessibility: added labelled controls, no new modal or overlay; unsaved action remains in normal flow to avoid covering keyboard targets. Existing reduced motion and focus support retained. axe and keyboard/reflow regressions cover account, help, oral/conciliation, notice/hearing/evidence/witness and completion states on desktop and narrow screens. Actual assistive-technology user validation remains external.

Legal and documents: no deadline-engine or Word wording changes. The 5.7 source review remains applicable. All 65 entries receive editable Word generation, placeholder/neutrality and contextual routing checks. Rendered document fixtures now cover all 65 templates, 90 pages. Automated page checks found no blank pages or text outside page bounds; selected inquiry-report and production-notice pages were visually inspected. This is not represented as exhaustive visual approval of every page. Independent legal opinion, current sector-specific advice and complete Word visual acceptance remain required for an unqualified production certification.

Security: case-data transmission/storage constraints retained; negative request/access tests, cookie security, origin checks, OTP limits and plan boundaries remain part of the build gate. Local-file write failure and external modification are separately tested. In-memory rate limits reset with a process restart; provider rate limits and account monitoring remain relevant. A free plan does not supply an independent penetration test or paid breached-password screening.

## Release evidence

Build and tests are required before commit publication. Record exact commit/tree/deploy and live health version after Render reports LIVE. Recheck static hashes, protected assets and headers. Preserve existing user inquiry tabs; use synthetic fixtures for all verification. Detailed local QA results are intentionally excluded from the public repository.

## Acceptance boundary

This internal review can improve software and verify specific behavior. It cannot stand in for an independent practising lawyer's sign-off, disabled-user acceptance testing, a penetration test or an uptime agreement. Do not advertise a 10/10 certification or promise error-free handling of every real case. Institutions retain legal decisions, signed case files, access to originals and retention responsibility.
