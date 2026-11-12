# POSH Legal Navigator — Referral Pilot / Staging v1
Date: 2026-11-11. Product parent brand: POSH Legal Navigator.
This is **not** a live partner programme. The only supported flow is test-only partner code issuance and test-only buyer registration.

## Staging routes
- `/become-a-partner`: Programme, tiers, manual review application.
- `/partner-operations`: Private operator applications, issuance/pause/resume of **pilot** codes (no KYC, payout or contractual activation implied).
- `/partner-referral` or `/partner-dashboard`: Public pilot form; verified account required for claim and partner information.
- `/api/partners/pilot/config`: Returns pilot and payouts disabled/enabled state, with real commissions/payments always false.
- `/api/partners/pilot/status`: Current authenticated buyer's pilot claim and (only for a matching application email) their partner pilot code/count; never customer identities.
- `/api/partners/pilot/claim`: Authenticated, same-origin, explicit buyer-entered code; never automatic from URL. Valid only for 90 days; no tax, order, amount or payment data accepted.
- `/api/partners/pilot/admin`: Operator-verified, same-origin action list. All actions double-enforced with `navigator_private.navigator_is_operator()`; audit row records the true authenticated actor, action and application ID.

## Security model
- Signed-in users must have a verified Supabase session and an unexpired `auth.sessions` record. Staging server requests also use a short-lived HttpOnly session, with the Supabase JWT forwarded only to the protected RPC endpoint.
- `public.navigator_partner_pilot_*` are INVOKER wrappers, EXECUTE restricted to authenticated; private implementations are SECURITY DEFINER and implement user/operator checks with `auth.uid()`, `navigator_private.verified_session()`, and `navigator_private.navigator_is_operator()`.
- Operator codes have prefix NAV and nine hexadecimal random characters (12 characters total). An operator can issue a **pilot-only** code, pause it, resume it or decline the application. A pilot code is not a signed legal or tax approval.
- Buyer must opt in by ticking a confirmation and submitting the exact code. Referral link query string only pre-fills the form; no automatic acceptance, persistent visitor identifier or tracking cookie.
- The account-email self-referral check is enforced in the database. Buyer also self-attests absence of procurement or related-party conflicts. **Pilot test only**, so self-attestation is insufficient for future real-money award.
- Pilot claims reside exclusively in `navigator_private.partner_pilot_claims`. They do **not** occupy `public.navigator_partner_referrals`, do not issue payment records, and cannot be treated as paid referrals in future.
- Private pilot claim rows contain account UUID, pilot partner UUID, acceptance time, 90-day expiry and 'test_only'. Only aggregate counts are shown to partners.
- Admin actions audit to `navigator_private.partner_pilot_audit`. Private tables are RLS-protected and have no public, anon, authenticated or service_role direct grants.
- Both client and server rate-limit; all public POST methods require same-origin JSON; request body size is small; no confidential complaint information is accepted.
- Production origin fails closed even if `PARTNER_REFERRAL_PILOT_ENABLED` is mistakenly set true.
- Existing checkout remains test-only; no real receipts, gateway payments or commissions arise.

## Test checkout linkage milestone (2026-11-12)

- Buyers may voluntarily link a completed Razorpay **test** order only after accepting an issued pilot code, using `POST /api/partners/pilot/link-order` with `{source:'plan'|'checklist',orderId}`.
- The browser submits only order source and reference. The Node server validates an account's verified sign-in and same-origin JSON POST. The database independently checks `auth.uid()`, accepted pilot claim, unexpired 90-day window, pilot partner status, ownership of the test order, recorded Razorpay **test** provider, and captured/fulfilled test state. A test order must have been created and completed after referral registration and within its validity window.
- Only eligible `plan_test_orders` and non-guest, signed-in `checklist_orders` with `gateway='razorpay-test'` qualify. Simulated payments, guest orders, older orders, unconfirmed orders, guide tests and real payments are rejected.
- Links are stored only in `navigator_private.partner_pilot_order_links`, distinct from any real referrals, `navigator_partner_commission_ledger`, and payout tables. They contain no money value or confidential case details.
- Unique `(source,order_id)` prevents duplicate credit. Existing valid links return idempotent success; another buyer cannot claim an already linked test order.
- The buyer can see their own linked test product categories. The partner sees only an aggregate count of verified test checkout links, never buyer identities or specific orders.
- No live payments, tax invoices, commissions, refund processing, or bank payouts are enabled by this milestone.

## Operator checklist
1. Review applicant independence, role, conflicts and marketing practices.
2. Issue **pilot code** only, without contractual or payout promises.
3. Ask applicant to sign in to their Navigator account using matching email if they wish to view their own code.
4. Ask test buyer to open `/partner-referral?code=NAV...`, sign in and explicitly confirm registration.
5. Review only aggregate pilot counts; do not share buyer identities.
6. Pause code if spam, misleading marketing or misconduct arises.
7. Do not initiate payout or convert any pilot record to a real sale.

## Deferred live release gates (must be separate audited PR)
- Named contracting entity and executed partner agreement, independent legal-ethics review of advocate restrictions.
- Secure KYC/PAN/GST/bank onboarding and verified ownership, dual-authorised finance approval.
- Buyer-confirmed **real** attribution in a production separate ledger, independently verified payment capture, settlement and fulfilment, webhook idempotency, 45-day maturity, refund and chargeback reversals.
- Proven commission policy, 20/25/30% financial-year retroactive adjustment (and year-end negative corrections), applicable tax deductions under law and invoices.
- Audit trail, statement export, secure beneficiary changes, segregation of duties, reconciliation and final disbursement controls.
- Product-margin review and written exclusion of legal services, IC/LC appointments, government procurement, conflicted sales.
- No public payment or code enrolment promises before all gates pass.
