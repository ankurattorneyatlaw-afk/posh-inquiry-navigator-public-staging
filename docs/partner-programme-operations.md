# POSH Legal Navigator Partner Programme — Release and Finance Controls
**Policy edition:** 2026-11-11 v1.0 | **Launch status:** Staging applications and isolated pilot-only codes/claims; real sales and payouts disabled

## Programme decisions
- Brand: **Become a Partner** under POSH Legal Navigator.
- No joining, renewal or payout-release fee.
- Eligible products are a **maintained, explicit allowlist**: `checklist`, `compliance-checklist`, `aggrieved`, `respondent`, `essential`, `professional`, `advanced`. Any later products must pass contribution-margin and regulatory review before enabling.
- Do **not** pay commissions for advocate legal services, representation, case-specific legal advice, IC/LC appointments, public procurement, statutory duties, third-party government orders, training, audits or bespoke professional services without prior separate written lawful review.
- **Annual eligible net revenue:** only gateway-confirmed, fully settled INR amounts excluding GST, promotional discounts, refunds, chargebacks and credits. Not lead value, catalogue price or gross including GST. Fees charged by payment gateway are borne by platform and not a deduction from customer tax-exclusive invoice value.
- **Annual qualifying period:** 1 April–31 March (Asia/Kolkata). Year resets April 1; no multi-year carryover.
- **Retroactive annual rate:** < ₹500,000 = 20%; ₹500,000 to < ₹1,000,000 = 25%; ≥ ₹1,000,000 = 30%, on *all* current-year qualified revenue. Each cleared milestone triggers a review-cycle reconciliation, and the final year-end review calculates `round_to_paise(net_annual * rate) - total_previously_credited`, including a negative recovery if refunds reduce the tier.
- **Credit hold:** at least 45 days after payment capture, settlement, fulfilment, and verification. Disputes extend hold. No unverified purchases.
- **Payout run:** nominal 20th monthly, for approved, matured, unheld balances ≥ ₹2,000. Smaller balances carry forward. Annual true-up within 90 days after March 31 if books and refund windows have cleared. Delayed bank days may change actual settlement dates.
- **Attribution:** approved partner code, registered prior to purchase; first approved qualifying referral per buyer, 90-day expiry; customer-entered code or buyer-confirmed lead registration; first purchase plus qualified upgrades/renewals within the initial 12 months only. No lifetime programme, cookie-fingerprinting, self-referrals or covert buyer tracking. A conflicting referral requires manual decision and audit record.
- **Tax:** paid only to verified Indian resident partners in the pilot; KYC, PAN, GST where applicable, invoice controls, tax deduction, bank-beneficiary check, independently verified tax rates. Under the 2025 Income-tax Act for 2026-27, section 393(1) residents table 1(ii) lists 2% with ₹20,000 threshold; finance must independently confirm any exceptions, PAN issues, gross-up/GST treatment and withholding at earlier of credit/payment.
- **Payments:** no automated bank API or wallet. The partner application form must not request PAN, bank, Aadhaar or other identity documents. Encrypted dedicated verified onboarding will be required before releasing any payout. Two distinct authorised finance approvers must approve all releases. The preparer cannot be the sole approver; beneficiary changes trigger a hold and re-verification.
- **Integrity:** credit only from verified gateway webhook/settlement and licence fulfilment with idempotent transaction keys. Never credit client-supplied amounts, fabricated receipts, test gateways, partner clicks, raw search terms, or email lead submissions. Persist append-only sale, tier adjustment and refund reversal events. Statement shows amount excluding GST, tier, hold, tax, net payment and adjustment reasons. Reversals offset future balances or trigger documented lawful recovery.
- **Fraud:** submission honeypot, ephemeral nonce with time floor, per-network and global limits, exact referer-origin policy, duplicate-email guard, private database grants and manual review. Review campaign abuse and suspicious conversion ratios before activation. Partners may not use fake endorsements, software certification or statutory claims, automated cold outreach, compensation to government procurement officers or conflict-driven sales.
- **Privacy:** only business contact data collected at application, with affirmative review/contact agreement. No personal case data. Public website analytics remains aggregate-only and is separate from applicant personal data. Retention schedule to be confirmed in signed privacy programme.
- **Customer-facing brand:** The Cosmic Energizers, POSH Legal Navigator. Partner arrangement is a product marketing arrangement, never an advocate fee-share or legal services solicitation.

## Database staging structure
`navigator_partner_applications` is the only partner table with a current server-validated write endpoint. `navigator_partner_accounts`, `navigator_partner_referrals`, `navigator_partner_commission_ledger`, and `navigator_partner_payouts` are locked down with RLS and no anon/authenticated/service_role grants. No live payment, real partner activation, payable referral, commission credit or settlement API is deployed. Applications are reviewed via authenticated Supabase administration until a dedicated secure operator dashboard is built.

## Mandatory release gates before financial activation
1. Signed legal terms reviewed against BCI Rules, contract entity, consumer protection and current taxes.
2. Partner approval, signed agreement, independent KYC, PAN/GST, verified beneficiary secure onboarding.
3. Secure role-based admin UI with first and second payout approval, no approval bypass, immutable audit trail and segregation of duties.
4. Buyer-confirmed attribution at signup/checkout; 90-day expiry; unique order/referral indexes and anti-reassignment rules.
5. Verified gateway webhook signatures, settlement matching, licence fulfilment and idempotency.
6. Refund/chargeback and tier-cliff handling, including year-end negative ledger adjustments and recovery.
7. Tax invoice generation/acceptance, accountant-led TDS/GST validation, reconciliation and Form/certificate obligations.
8. Exportable statement, payout batch record, bank-reference reconciliation, cancellation and corrections.
9. Privacy/retention review, abuse monitoring, suspicious link and spam defences, conflict-of-interest escalation.
10. Tests: self-referral, duplicate event, chargeback after payout, FY boundary, threshold crossing with refund, KYC fail, single-approver attempt, bank change, payment spoofing, race condition and absent durable store.

## Test acceptance criteria
- `npm run build` includes `scripts/partner-programme.test.cjs`.
- `/become-a-partner` and `/partner-terms.html` render without login.
- `/api/partners/config` returns only enabled and nonce; it leaks no credentials.
- `/api/partners/apply` requires exact origin, JSON, valid fresh nonce, explicit declarations, valid structured fields, non-honeypot, and rate limit; otherwise no database insert.
- Applications are stored privately only when enabled and configured. Repeats never create multiple records for the same email.
- No bank, PAN, KYC, payout API, active partner-code or commission credit is available publicly.
- Live payment enablement is a separate release, not an effect of promoting the programme page.


## 2026-11-13: protected onboarding readiness checks
- Seven staging gates: agreement, identity/KYC, tax/GST, bank ownership, invoice readiness, marketing ethics and conflict screening. This is a status-only control review, not a KYC document portal.
- Private records: `navigator_private.partner_onboarding_gate_reviews` and append-only `partner_onboarding_audit`. Only reviewer UUIDs and review status; never PAN, bank accounts, scans, signed agreements or personal customer data.
- Each check requires reviews by two different verified operator accounts. Reviewers cannot be the applicant account. A rejected check cannot be reopened through the staging UI. All actions are audited.
- `public.navigator_partner_onboarding_admin` and `public.navigator_partner_onboarding_my_status` are invoker wrappers. The internal functions validate verified sessions and operator status. Public and direct table grants are revoked.
- Partners can see only their own review status. The administrator screen is protected at the server and database layers.
- Even if all seven review statuses are complete, no account activates for real money, no commission is credited and no payout is made.
- Live onboarding still requires protected document exchange, contracting-entity approval, legal ethics clearance, tax adviser review, real gateway settlement, refund reconciliation and bank ownership checks outside this demonstration.
