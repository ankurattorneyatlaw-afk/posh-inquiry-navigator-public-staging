# Dedicated login and role workspaces 6.0

## User flow

Public header: Free guidance, FAQs and Plans, with one Sign in action. Other public content remains accessible through the existing page sections, footer and routes. Server-side injection of extra Guided/Account header tabs was removed.

/account is a dedicated email-code login screen with collapsed alternatives/help. After verified sign-in it redirects customers to /workspace and verified operators to /admin. A password session requiring MFA remains in verification before redirect. Customers with no active plan or knowledge-only access still receive an authenticated workspace with the relevant access/renewal options; they cannot open paid inquiry assets without entitlement. Account failures offer retry and public-site navigation.

/admin is server-protected and shows customer access-role assignment controls to the verified operator. Customer plan roles are separate from administrative authority. An administrator can use all implemented inquiry tools without purchasing a customer subscription; both the server and in-tab access guard recognise verified operator access. Customer requests for /admin redirect to their own workspace. No operator accounts, database roles or real customer entitlements were created or changed by this release.

## Test payment assignment

Real payments remain hard-disabled: only Razorpay test keys are accepted. A test order is bound to the authenticated account in a server-signed context; amount, currency and allowed plan come from the server catalogue. Verification checks the checkout signature and fetches the payment from the gateway. Only a captured test payment can assign the matching sandbox plan. Authorised-only, incorrect amount/order, live-mode, forged/cross-account and unknown-plan requests do not assign access. Caller-supplied account IDs, administrator plans and case fields are rejected. Duplicate confirmations are idempotent; concurrent updates are checked again immediately before assignment.

Sandbox assignments are stored in bounded process memory and reset on server restart. Each signed-in account can read only its own simulated assignments through /api/payments/sandbox-access. Sandbox roles are never consulted by the real paid-asset authorisation check, never grant administration and never create a real invoice, subscription or entitlement. The workspace clearly labels them under a collapsed test-purchase panel. No payment credentials or case information are stored.

The browser integration test uses the real local order/verification handler with simulated Razorpay gateway responses; the sandbox assignment is then read through the real local API in the customer workspace. No actual merchant transaction is attempted. Live /api/payments/config was checked before release: test mode, configured false, livePaymentsEnabled false. The deployed service therefore needs privately configured Razorpay TEST credentials before merchant-backed sandbox checkout can be exercised. Do not submit keys in chat.

## Validation and launch boundary

Tests cover dedicated login, automatic customer/admin routing, customer denial from administration, administrator full access without a plan including the in-tab guard, manual customer plan assignment, sign-out, canonical payment matching, pending/invalid/cross-account/live-mode rejection, duplicates, real-server sandbox assignment, account isolation and no real access grants. Existing paid lifecycle, renewal, recovery, document and timeline tests remain applicable. Accessibility scans include login, customer workspace and open administrator tools on desktop and 320px.

Before enabling real sales in a separate approved release: confirm commercial scope/tax/refund terms; add a durable account/purchase/entitlement ledger with idempotent transaction handling; validate signed captured-payment webhooks and retry/reconciliation; define refund/chargeback/revocation and renewal semantics; test account provisioning and recovery; privately configure live credentials and webhook secret; obtain explicit go-live approval. This test implementation deliberately does not enable real automatic access assignments.

The live 6.0 check found that signed-out sessions return only signedIn:false, without an access array. Patch 6.0.1 normalises missing access to an empty array before deriving UI rights. The browser regression now uses the minimal real signed-out shape and checks that login starts without an error.
