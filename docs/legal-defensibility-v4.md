# POSH Navigator v4.0 — IC/LC inquiry and paid-plan report architecture
11 November 2026 · Staging review · not a legal certification.

## What has changed
- The licensed IC/LC checklist retains its original **43 stored preparation ticks** and adds a **separate 84-point judicial-defensibility review** across eight domains.
- The v4 review is served only after active order verification. It includes eight release gates, coded source references, status classifications, seven legally distinct report types, legal-context selectors, and local export/import of coded JSON.
- Essential, Professional and Advanced plan tools all include the legal-audit baseline. Professional and Advanced retain their 44-section editable report draft, now with a report-type selector and release-gate table. Advanced adds eighteen adversarial case scenarios to the four existing ones.
- Guided Word inquiry report and findings drafts now distinguish preliminary, statutory, formal disciplinary, special-regime and referral cases, address contrary evidence and representations, and require reasoned gate review.
- Plan descriptions updated. No paid checkout, pricing, entitlement or identity-record storage mechanism changed.

## Confidentiality and current limitations
Staging users must enter only neutral reference codes. Do not enter real names, case narratives, testimony or exhibits. The new 84-item audit is held in **browser-tab memory only**; unlike the existing 43-tick progress, it is **not** synchronised to the buyer account. Export the coded JSON or Word review before closing. The paid organisational compliance assessment and its management PDF remain separate and are not a final Section 13 inquiry report.

Completing a form does not certify legal compliance or decide guilt. The Committee remains responsible for actual findings, reasons and authorised signatures. Eight release gates are enhanced professional controls rather than a prescribed statutory form.

## Legal regime controls
- Do not use a Section 13 merits report for a completed Section 10 settlement, a jurisdictional dismissal or a preliminary fact-finding stage.
- Apply POSH Rule 7 only where it is legally the governing inquiry procedure.
- Where both parties are employees, separately provide the statutory opportunity for representations against findings under the second proviso to Section 11(1).
- Confirm the actual current Section 18 appellate forum, including repeal, savings and transitional instruments.
- Identify UGC-related higher education and POCSO-related child-reporting obligations independently, when relevant.

## Release and test gates
1. Run node scripts/verify.cjs for signed asset hashes and existing staging invariants.
2. Run node --test scripts/defensibility-v4.test.cjs scripts/plan-tools.test.cjs scripts/online-checklist.test.cjs scripts/workflow-documents.test.cjs.
3. The complete npm run build must pass before deploying staging.
4. Use fictional accounts to walk through Essential, Professional, Advanced and checklist holder access; test expiry, imports, Word export, keyboard navigation and all 84 control statuses.
5. Commission legal-editorial review for pinpoint judicial citations, state-specific service rules, sector regulations and the operative appellate forum before describing those sources as independently verified.

## Remaining roadmap
- Cross-device persistence of the 84 responses requires a separate least-privilege, privacy-reviewed database migration; it is not silently mixed into the legacy 43-item SQL progress.
- The organisational compliance assessment PDF and the case-specific IC/LC audit remain distinct products to avoid misleading customers.
- Manual accessibility and browser workflow checks are required; static syntax checks alone are insufficient.
- A legal source register is a versioned reference index, not an automatic certification of paragraph-level judicial authority.

## Files
Source catalogue: scripts/defensibility-v4.cjs
Private in-browser legal audit: dist/legal-audit-v4.js
Plan integration: scripts/plan-tools.cjs and dist/plan-tools.js
Checklist order access: scripts/checklist-checkout.cjs and dist/inquiry-checklist.js
Guided Word drafts: dist/workflow-documents.js
Validation tests: scripts/defensibility-v4.test.cjs
