# Navigator 5.7 review

Scope: existing free-hosted Navigator; account/entitlement database only. No live case, customer entitlement or credentials altered. Review performed 5 November 2026.

## Legal

Checked Sections 9–13, 16, 18 and Central Rule 7 against the reproduced Act/Rules in NHRC annexures A–B (pp. 193–208): https://nhrc.nic.in/assets/uploads/training_projects/NHRC_Study_rpt_sexual_harrasemnt_workplaceDec2023.pdf . Section 18 text also checked against the Supreme Court judgment of 20 January 2026: https://api.sci.gov.in/supremecourt/2025/39361/39361_2025_4_18_67590_Judgement_20-Jan-2026.pdf .

The two principal ordinary completion flows remain Section 10 settlement and Sections 11–13 inquiry/report. Procedural referrals, disputed competence, absence, protection and breach require reasoned human directions and owned follow-up, rather than fabricated completion.

Existing timeline keeps separate receipt, verified commencement/basis, first meeting, completion, report submission and recipient receipt. Section 11(4) states 90 days without expressly defining commencement. Receipt-based monitoring remains visible; applicable sector/service directions may impose receipt-based requirements. First meeting is never automatically substituted. Section 13(1) report: 10 days from inquiry completion. Section 13(4) action: 60 days from receipt of recommendations. Central Rule 7 uses 7 working days from complaint receipt for forwarding and up to 10 working days from actual prescribed-document receipt for reply. No automatic holiday extension of calendar-day periods or pause for interim relief/adjournment.

Corrected P01 legal attribution: writing assistance is Section 9(1); Rule 6 concerns authorised complainants. Existing oral route requires reasonable assistance and separate verified written receipt. Added relevant collapsed completion guidance: Section 18 appealability, actual recommendations date, 90-day wording and competent forum for inquiry; Section 11(1) settlement breach review for conciliation. Completion does not create a stay or extinguish remedies. No appeal deadline is guessed from report download or implementation. Sector-specific rules, criminal-law transition and contested dates still require qualified case-specific review.

All 65 template definitions retain structural/content safeguards and contextual access checks. Notice, response, evidence, witness, attendance and report tests passed. This is not an independent legal opinion or exhaustive case-law survey.

## Accessibility

Reference: https://www.w3.org/TR/WCAG22/ . Ran axe-core 4.14.0 against WCAG A/AA tags on 22 desktop/320px states covering account, intake, oral assistance, conciliation, respondent notice, first hearings, inquiry, witnesses, production, report and completed inquiry. Fixed two low-contrast small-text styles. Added platform reduced-motion handling and consistent focus outlines. Keyboard focus, labelled fields, earlier-answer correction/cancel, connection retry and mobile reflow remain regression-tested. Automated zero findings do not establish complete WCAG conformance; assistive-technology user validation remains outstanding.

Reproduce browser audit with PLAYWRIGHT_MODULE and AXE_SOURCE pointing to an installed Playwright module and axe-core 4.14.0 axe.min.js, then run scripts/standards-accessibility-browser.cjs. Completed-state scan uses the local synthetic QA recovery fixture; it contains no real case information and is excluded from publication.

## Security

Reviewed encrypted HttpOnly Secure SameSite cookies, same-origin JSON checks, bounded requests, OTP pending identity/expiry/attempt limits, server-protected paid assets, fail-closed access, parameter validation, local recovery parsing and CSP. Fixed sign-out so provider failure cannot prevent clearing the local session and pending OTP cookie; added regression tests for outage and expired-session logout. Server revocation failure remains explicitly reported.

Supabase advisor: one WARN, leaked-password protection disabled. Official docs say this feature requires Pro: https://supabase.com/docs/guides/auth/password-security . No paid upgrade made. Email OTP remains the primary sign-in. Private tables have RLS; paid-access policy restricts reads to the authenticated owner with a verified session. Public RPC wrappers are invokers; privileged implementation functions use an empty search path and explicit operator checks. Anonymous execution is denied for Navigator access/admin RPCs. Verified-session function checks confirmed/non-anonymous/non-banned identity, current auth session and OTP or AAL2; no user-editable metadata grants privileges.

Not a penetration test. In-memory rate limits reset on process restart; provider limits remain necessary. Browser-only case recovery depends on an explicitly saved and verified local file. Free hosting may cold-start. No scheduled case reminders or automatic renewals are promised.
