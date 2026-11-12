# POSH Legal Navigator — Partner Finance Reconciliation Lab

**Release:** 2026-11-12, staging only; no actual payment, commission credit, or bank transfer.

## Scope
The Finance Lab at `/partner-finance` is a private administrative rehearsal for the Business Partner Programme. It uses predefined fictional transactions rather than buyer payments, complaints, or actual partner records.

The approval record is stored in `navigator_private.partner_finance_review_drafts` and `navigator_private.partner_finance_review_audit`. No banking data, PAN, customer identity, purchase amount or real order identifiers are written to those training tables.

## Simulation rules
- Products restricted to approved digital product allowlist. Advocate legal fees, representation, statutory IC/LC roles and appointments, conflicted and government procurement cannot earn commissions.
- Commission base is captured, settled and delivered eligible revenue excluding GST and valid discounts, less verified refunds and credits. Integer paise are used.
- 20% on less than ₹5,00,000; 25% from ₹5,00,000; 30% from ₹10,00,000. Rate applies retroactively to qualifying revenue for each Indian fiscal year (April 1–March 31 IST).
- Actual entitlement requires an approved agreement, genuine attributed buyer, anti-self-referral measures, independently verified payment capture and settlement, proof of delivery, no conflict, and eligibility within the approved first-12-month referral window.
- Hold at least 45 days after the later of settlement or delivery. Chargebacks or refunds may create a negative annual adjustment and a carry-forward correction.
- The sample evaluator does not transact money or call a gateway. Synthetic inputs contain no personal data.
- `verifyWebhook` checks HMAC SHA-256 over raw event bytes, uses constant-time comparison, and enforces supported event types. This helper is not exposed as a live webhook endpoint. A valid signature is insufficient for payable credit without separately verified settlement, refund, attribution and delivery.

## Security and approval segregation
- Feature flag `PARTNER_FINANCE_SANDBOX_ENABLED` is effective **only** when the configured origin equals the staging origin; default is disabled.
- Both the static `/partner-finance` page and its JS, and all `/api/partners/finance/*` routes beyond public config, require verified operator access.
- Status and mutation RPCs use only the verified operator JWT. The DB verifies session validity and operator membership again.
- A synthetic draft's preparer cannot approve it; the first and second reviewers must also be distinct. Every action stores the authenticated operator UUID in a private audit table. There is no `paid` state.
- The public site, guest checkouts and non-operator accounts cannot use the Finance Lab.
- There is **no** production webhook ingestion, payout API, commission event POST, banking field, payout execution endpoint or automated commission activation.

## Test scenarios
- Starter: ₹3 lakh eligible sales at 20%.
- Growth: ₹5 lakh eligible sales, retroactive tier to 25%.
- Elite: ₹10 lakh eligible sales, retroactive tier to 30%.
- Refund downgrade: sale reversals reduce annual sales and generate negative reconciliation.
- Held order: delivery or settlement within the 45-day maturation window.
- Ineligible/conflicted order.
- IST financial-year boundary.
- Finance release gate simulations require three distinct operator identities, KYC, beneficiary, tax, invoice, settlement and no unresolved disputes.

## Pending real-money launch gates
1. Confirm legal contracting entity, signed partner agreement, approved commissionable digital products and ethical marketing/legal-profession boundaries.
2. Independently verify buyer-confirmed attribution, unique gateway event IDs, paid capture, settlement, fulfilment, refunds, chargebacks and conflicts.
3. Implement a separate **production** ledger with append-only corrective events, account role separation, and rigorous idempotent reconciliation.
4. Complete secure KYC/PAN, GST/TDS review, lawful invoicing and actual-beneficiary verification using protected onboarding, not the public expression-of-interest form.
5. Implement dual-finance approval with independent identities, beneficiary-change holds, proof of bank processing, audit export and manual payout reconciliation.
6. Conduct operational trials on the actual payment processor in test environment and finance signoff before enabling any live settlement flow.

No tests in this laboratory are evidence that the real-money release gates are satisfied.
