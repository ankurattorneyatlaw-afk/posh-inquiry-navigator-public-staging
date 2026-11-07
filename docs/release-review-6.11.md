# Release review: 6.11

## Changes

- Multiple completed complaint-forwarding, prescribed-document receipt or reply records now require an explicit controlling-record selection. Entry order never determines the statutory trigger. All original records remain visible; selecting a record does not restart or extend a deadline.
- Correcting verified commencement or relevant service records requires renewed confirmation. Unrelated planned follow-ups do not invalidate a completed review.
- Recovery schema 4 preserves the controlling records and unsaved selections. Versions 1–3 remain supported. Legacy audit entries replay unchanged; a historical verification followed by a source correction is visibly outstanding until reviewed again.
- Invalid recovery records are rejected before replacing current work. No case storage or new server transmissions were introduced.

## Verification

- 104 automated assertions passed across timeline, workflow documents, account permissions, payments, evidence, recovery and individual documents.
- Complete IC and LC inquiry paths passed through notices, hearings, evidence, witnesses, report, implementation and fresh-tab restoration at desktop and mobile sizes.
- All 51 stages and 165 answer branches passed at 320, 768 and 1440 pixels without horizontal overflow. Automated accessibility checks found no violations in the tested public, account, admin and inquiry states at desktop and mobile sizes.
- Synthetic account lifecycle tests passed login routing, customer/admin separation, completed-inquiry recovery, expired-access export and renewal without changing case progress.
- Service-source browser checks passed ambiguity gates, preserved pending choices, actual recovery download/readback, fresh-tab restore, legacy recovery and atomic tamper rejection at 1440 and 320 pixels.
- Oral assistance through written receipt and contextual acknowledgement passed. Digital-product tests passed 65 states and 39 downloads, including role-specific guides and drafts, with no browser errors or automated accessibility violations.

## Legal basis and limits

Central Rule 7(2) uses complaint receipt for forwarding within seven working days; Rule 7(3) uses actual receipt of the prescribed documents for a reply within a period not exceeding ten working days. Sources: https://spniwcd.wcd.gov.in/uploads/pdf/1719914401_2NUqe91gql.pdf . Section 11(4)'s 90-day inquiry period does not expressly define a commencement event. Verified initiation remains separate from the first meeting. Section 13 report and implementation triggers are unchanged.

The owner’s signed-in live administrator page was observed. Native browser automation then reported conflicting tab focus, so no customer permissions or unrelated tabs were changed. Broad paid journeys use isolated synthetic accounts and records, not real case data. This review is not independent legal certification, a penetration test, or a guarantee against appeal. Real payments remain disabled. Save and verify a local recovery file before refreshing an existing inquiry.
