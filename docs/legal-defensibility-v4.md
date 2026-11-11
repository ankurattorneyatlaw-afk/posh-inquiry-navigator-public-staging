# POSH Legal Navigator — Current IC/LC Checklist and Inquiry Report Architecture

**Release target:** v4.1, 11 November 2026. **Staging:** `inquiry-timeline-staging`. This documentation describes design and verification controls; it is not a certification of any case.

## Single current IC/LC checklist
- Exactly **84** legally classified checkpoints across **eight** judicial-defensibility domains, with **eight** independent finalisation gates and reasoned verification statuses.
- One licensed product with 120 days of access from verified test capture. No prior checkbox edition, saved tick counter, free sample or Word checkbox package is shown.
- The legal audit remains locally in the browser tab. Export its coded status-and-source record as JSON or editable Word; there is no shared case-data store and no cross-device automatic syncing of audit responses.
- Current route hints address IC/LC competence, governing service rules, UGC and POCSO circumstances, the Section 11(1) representation stage, evidentiary reliability and current-law appeal verification.
- Where applicable, the competent Committee records its determinations; selecting PASS does not independently establish legal compliance.

## Current report architecture in all plans
- Inquiry Essential supplies the **current case-adaptive report outline** and allegation-wise working matrix.
- Inquiry Professional and Advanced supply the current detailed report editor, with **thirteen substantive report chapters** and **seven distinct lawful report/document pathways**. Irrelevant chapters are excluded according to report type. A fourteen-field allegation analysis matrix and eight release gates are integrated.
- Guided IC/LC inquiry Word drafts use the same thirteen-chapter architecture for full statutory inquiry reporting, subject to the proper governing service rules and a different lawful document where the matter is a conciliation closure, jurisdictional determination or other exception.
- No software output adjudicates credibility, misconduct, liability, service or statutory completion. Committee findings, authenticated approval and institutional record custody remain authoritative.
- The distinct employer POSH Compliance Assessment is a management assessment, not an IC/LC merits inquiry report.

## User language
- Use '84-point IC/LC Legal Checklist', 'current legally adaptive inquiry report', 'Committee determination', 'authorised Committee verification' and 'Committee approval'.
- Do not use obsolete checklist counts or old fixed report-builder labels in public content or generated templates.
- Avoid generic language suggesting an unnamed external reviewer, while preserving real statutory responsibilities of the IC/LC and competent authorities.

## Source architecture
- `scripts/defensibility-v4.cjs` — 84 controls, eight gates, seven report routes and 18 challenge cases.
- `dist/legal-audit-v4.js` — restricted browser-tab review, status/source controls and local exports.
- `scripts/online-checklist.cjs` and `scripts/checklist-checkout.cjs` — verified current edition, without previous checkbox progress endpoints.
- `scripts/plan-tools.cjs` and `dist/plan-tools.js` — current report chapters, applicable report-type filtering and allegation matrix.
- `dist/workflow-documents.js` — current guided inquiry report working document.
- `dist/products.js`, `dist/shop.js`, homepage, institution page, FAQ, resources and purchase terms — current product descriptions.

## Release gates
The build must verify the release manifest, current catalogue, account/guest access boundaries, retrospective 120-day entitlement calculation, retired progress endpoint behaviour, report-type mapping, source-specific legal caution and regression tests. Run the full staging build before deployment, then inspect the deployed version and actual staging service status.

## Known limitations
Coded working records are local until exported; they are not silently synced. Case-specific service rules, legal-source pinpoints and current appellate forum remain subject to the Committee or qualified authority's verification. The report format supports stronger judicial defensibility but does not guarantee any judicial outcome. The staging checkout cannot charge real money.
