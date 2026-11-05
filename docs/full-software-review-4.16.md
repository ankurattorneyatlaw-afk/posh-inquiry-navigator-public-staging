# Full software review — staging 4.16

Scope: public homepage and institutional page, role-specific guidance and downloads, FAQ/library surfaces, guided inquiry and contextual documents, timelines, enquiry/community/analytics/test-payment handlers, navigation and server responses.

## Changes

- Use the same India calendar date for public date inputs, validation and guidance calculations. Reject impossible dates and invalid month offsets.
- Remove inactive descendants when an earlier public-guidance answer changes. Old conciliation selections cannot remain relevant after moving to an unrelated workplace concern.
- Point canonical, social and structured metadata at the separate current Navigator service; retain staging no-index controls.
- Preserve direct-link plan selection on demonstration requests. Recover from non-JSON server errors without clearing the form or falsely claiming success. Time-bound availability checks.
- Centralise client-network identification. Direct access uses the socket address; behind Render, use the validated last forwarding hop rather than caller-provided prefixes. Keep fixed global caps and bounded per-window maps. This assumes Render's proxy appends the trusted hop and is not a substitute for platform traffic protection.
- Explicitly submit new community questions and answers as pending. Public reads remain approval-filtered with allowlisted response fields.
- Add a minimal release health endpoint and a navigable 404 page. This does not change Render's configured TCP health check.

## Verification and limits

Automated tests cover date boundaries, branch pruning, request consent/origin/size limits, private enquiry success/failure, pending community submissions, public-field filtering, forwarding-prefix changes, privacy signals, live-key refusal and forged checkout verification. External writes are mocked; no real enquiries, posts, mail or payments are created.

Browser checks cover 14 public addresses at desktop and mobile widths, visible input labels, duplicate IDs, horizontal overflow, enquiry failure recovery and synthetic receipt download, both free role action plans and Word downloads, and recovery navigation. Guided inquiry regression checks retain oral/writing assistance, contextual documents and distinct statutory milestone triggers.

The existing Section 9–13, Central Rule 7 and applicable-procedure safeguards are retained. No first meeting is substituted for verified inquiry commencement; no download proves legal service or completes a legal milestone. This release changes no statutory period or database schema. It is not certification of case-specific legal compliance or a fresh substantive verification of every library proposition.

This remains fictional-data staging. The current service's optional enquiry/community/analytics/payment integrations are not activated by this release. Production database grants/RLS, live moderation, durable notification delivery, authenticated multi-user access and immutable shared audit records are not certified by these local/mocked checks. Browser state and exported audit files retain their existing boundaries.
