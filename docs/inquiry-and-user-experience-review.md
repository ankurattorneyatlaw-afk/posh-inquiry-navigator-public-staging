# Navigator product and user experience review — 5 November 2026

Scope: existing app, account lifecycle, IC/LC workflow, individual guidance, paid positioning and visual experience. Ratings are internal product judgments, not independent legal, security or accessibility certification.

| Perspective | Strength | Remaining gap / priority | Internal rating |
|---|---|---|---|
| IC/LC and presiding members | Contextual drafts, chronology, human decisions, exception follow-ups | Institution must retain source records; locally exported session recovery needs prominent onboarding | 8/10 |
| External member | Neutral process, witness/evidence records, no fictitious automatic decisions | No shared multi-member case workspace; current licence seats are not collaboration | 7/10 |
| Aggrieved woman | Free rights guidance, writing assistance and conciliation distinctions | Personalised support needs actual conflict-checked provider acceptance and secure handling | 7/10 |
| Respondent | Reply opportunity, evidence index and neutral preparation | Same personalised-service operational prerequisites; payment gives no Committee priority | 7/10 |
| Witness | Contextual appearance/examination drafts | No witness portal; issue notices and protect identities externally | 6/10 |
| Employer / District Officer | Report forwarding and implementation monitoring | No integrated disciplinary order or institution-wide compliance management | 7/10 |
| Buyer / administrator | Email OTP, verified plan access, owner grant/revoke controls | Manual account provisioning, purchase verification and renewal; planned tiers exceed delivered scope | 6/10 |
| Mobile / accessibility | Responsive cards, large targets, collapsed detail, focus states | Independent screen-reader and user acceptance study still needed | 7/10 |

## Release changes

65 contextual Word templates, including full inquiry report, findings matrix, Committee reply-opportunity review, approval and implementation monitoring. No-reply cases do not produce a false respondent reply. No-material and repeated-record branches avoid forced downloads. Earlier documents form one collapsed archive. Actual statutory dates remain independent of downloads and arbitrary first meetings. Account presentation puts the workspace first, hides administrative references and owner tools, and corrects the authenticator requirement. Current capability and planned catalogue are distinguished.

Individual preparation support is published as two enquiry-based packages, not instant checkout: complaint preparation and response preparation. Each defines a checklist, structured review and one clarification round; the written offer must define the named provider, deliverables, fixed fee/taxes, timing, clarification window, cancellation/refund terms, secure handling and conflict clearance before payment. No new case intake database, auto-charge or entitlement is introduced. Basic rights and available free drafts remain free.

## User lifecycle and operational boundaries

Discover role → free guidance or Committee preview → review available scope → agree written commercial terms → provision confirmed account → email OTP → manually verified plan → guided session → institution-controlled documents/exports → access expiry/renewal/support. The owner can find accounts, assign access and revoke access; this does not retract files already downloaded. Knowledge-only access does not unlock inquiry tools.

Individual support lifecycle: case-free enquiry → secure conflict check → written scope/fee and provider acceptance → agreed secure engagement → reviewed materials → one clarification round → closure/retention handling. Do not use ordinary email for complaint/evidence uploads. Support for opposing parties or Committee and party in the same matter must not compromise professional independence. Central Rule 7(6) excludes legal practitioner representation before the Committee where applicable; packages do not promise it.

## Next product priorities

1. Validate the complete journey with real IC and LC practitioners using synthetic scenarios; prioritise comprehension, exception recovery and export/restore discovery.
2. Publish an owner operating procedure for provisioning, expiry reminders, support response and renewal. Do not advertise automated seats, collaboration, read-only retention or 44-section automation until implemented and tested.
3. Build a role-specific welcome and first-session checklist around the current step, next action and required export; retain no case data on the server.
4. Measure package demand before committing a price list. Verify provider capacity, professional obligations and secure handling outside the app before accepting an engagement.
5. Independent accessibility/security review and a documented service continuity plan before promising production availability. Free hosting may cold-start; this release adds no paid hosting.

## Verification and limits

Automated unit/security checks and desktop/mobile browser journeys cover oral intake, six conciliation statuses and respondent notice through report/implementation. Five new blank Word templates were rendered and visually inspected page by page. This is tested software, not a guarantee of lawful results in every factual or service-rule situation. No case information is stored by Navigator. Dates and session history are tab-local until explicitly exported; refresh/close loses unexported state. No background email escalation is sent.

Sources: POSH Act sections 9–16 and Central Rules 6–7; official Rules: https://spniwcd.wcd.gov.in/uploads/pdf/1719914401_2NUqe91gql.pdf. Detailed applicability remains for competent human review.


## 5.4.0 follow-through — session and membership experience

Implemented full-session recovery downloads, including validated workflow answers, review decisions, document phase and timeline history. Restore previews the file and requires explicit replacement; invalid imports leave current work untouched. Older timeline-only exports restart questions at P01 rather than presenting invented workflow recovery. Files are local readable JSON and do not include Word files or unrecorded form text. No web-storage or server case persistence was introduced.

Added leave/restart/scenario-change warnings and full recovery download during access-verification holds. Added a collapsed first-session checklist, current-work-first layout, a visible account/renewal link and IST access-end details. Active plans ending within 30 or seven days have renewal guidance and a calendar reminder download. Missing access and knowledge-only access each have an appropriate next action. The owner operating procedure now covers provisioning, verified renewals, expiry, support and continuity.

Still operational rather than automated: account provisioning, purchase verification, renewal acceptance and fee collection. Reminders require the user's calendar import; Navigator sends no scheduled renewal emails. Shared case collaboration, automatic case saving and planned higher-tier automation remain outside the released scope. Practitioner usability studies, independent security/accessibility certification and paid availability guarantees remain future validation work.


## 5.4.1 recovery hardening

The prior release treated download initiation as a saved copy and cleared its warning too early. The default save now writes and reads back the user's selected file where the browser supports a Save dialog. The browser-download fallback keeps its link usable and requires a matching local-file check before claiming success. Cancelled/failed writes do not clear protection. Recovery schema 2 also preserves supported unfinished timeline and contextual document fields without submitting them. Restore rejects incomplete draft payloads and rolls back unexpected application failures; older exports remain compatible and do not inherit unrelated draft values.

Browser tests cover completed disk files, source-browser closure, a fresh browser restore, complete inquiry closure recovery, unchanged statutory dates and simulated permission/write/read-back failures. This remains local recovery, not cloud backup or a tamper-proof institutional record.
