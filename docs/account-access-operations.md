# Navigator account access and private-session operation

This release implements the owner's chosen model: accounts and plan entitlements are stored; case information is not. The existing app and Render service are retained. No paid infrastructure is created.

## Account and plan operation

1. The designated owner is approved privately in the account project. The approval email is not published in this repository. A confirmed, non-anonymous account matching that address receives the owner role. Email confirmation and verified email-code sign-in (or password plus authenticator) are required; the first registrant is never automatically administrator.
2. Create confirmed customer accounts through the authentication provider's administrative dashboard after verifying customer identity and purchase. Password creation/reset must be completed privately. Public self-registration and automatic billing activation are not implemented. Do not disable email verification to solve delivery problems.
3. Sign in at `/account` by requesting and entering an email code. Password plus authenticator remains an alternative. Owner controls appear only after server/database verification.
4. Find the customer's confirmed account by email. Verify the purchase externally, select the plan and dates, and retain the generated administrative UUID with your purchase-verification record. It must not be a case reference. Access-end dates are exclusive at midnight India time in the owner form.
5. Revoke a plan from the owner screen when appropriate. Each protected server request rechecks the current entitlement and live authentication session. An open guide checks again every five minutes and when its tab becomes visible. Already downloaded files and previously delivered public source cannot be remotely recalled.
6. The knowledge plan does not unlock the IC/LC guide. Other recognised inquiry plans unlock the common current guide. Planned advanced product features are not implemented merely by assigning a higher plan. Proceeding and seat restrictions must be managed contractually without recording case identities in Navigator.

The database stores user ID, plan, start/end, status and an opaque verification reference. An administrative trigger records entitlement changes. It stores no case timeline, witness register, evidence file or complaint identifier. Existing unrelated community/marketing tables are unchanged and their application integrations remain disabled.

## Security boundaries

- Only a publishable provider key is used. No service-role key is required by the app.
- Provider access/refresh tokens are encrypted with AES-256-GCM in an HttpOnly, Secure (HTTPS), SameSite=Strict cookie. No provider token is written to browser local/session storage or returned in normal account JSON. Sessions have a 30-minute idle limit and eight-hour absolute limit. Provider-token refresh is checked server-side.
- Database access checks confirmed, non-anonymous users, either the provider-signed `otp` authentication method or MFA assurance `aal2`, the current `auth.sessions` row, current plan dates and revocation. User-editable metadata is never an authority source.
- Privileged implementations are in a private schema, with fixed search paths, explicit execution grants and operator checks. Public entry points use invoker privileges. Customers have no entitlement INSERT/UPDATE/DELETE grants.
- Paid guide HTML and workflow assets require server-verified access, including direct asset URLs. Temporary provider failures deny access but preserve the encrypted session for recovery. New credentials, MFA codes and administrative requests use origin checks, bounded bodies and rate limits. Do not add request-body logging or error responses containing provider payloads.
- This is normal application access control, not DRM. The repository is public. Do not describe published procedural source as secret intellectual property protected by the login gate.

## No case-storage model

The guide's selections and procedural dates remain in page memory. Reload/close clears them. Word drafts and audit/timeline exports are user-initiated local downloads, not authoritative institutional records. Institutions retain originals, signed documents, service proof and their official audit trail in their own controlled system.

File fingerprints are computed locally. No evidence upload, antivirus scanning service, hosted evidence custody or shared case database is provided. Fingerprints assist byte comparison only. Generic calendar exports contain due dates and no case IDs; calendar delivery is controlled by the user's calendar service. Navigator runs no background case-reminder job.

## Hosting and recovery

Render remains on its existing free service and Supabase uses the existing dedicated Navigator project. No availability SLA, always-on hosting, paid backups or continuous monitoring is implied. Free-host cold starts and provider outages remain possible. `/health` reports app/version availability, not provider readiness. Account status fails closed when the provider is unavailable. Keep the institutional procedure usable independently of Navigator.

Keep an owner-controlled export of account entitlement configuration and purchase-verification references, and protect it as account data. Verify recovery procedures with the provider before large-scale rollout. Email codes use the existing Hostinger mailbox through custom SMTP configured privately in Supabase. No new paid resource is required. Public signup remains disabled, and the app sends `create_user: false`; customers must still be provisioned manually after purchase verification. SMTP limits and mailbox subscription limits apply. Invitations/password recovery are not implemented as self-service app routes.

Deployment configuration (merge changes; never replace unrelated settings): `NAVIGATOR_ACCOUNT_ACCESS_ENABLED=true`, `NAVIGATOR_AUTH_URL`, `NAVIGATOR_AUTH_PUBLISHABLE_KEY`, and a cryptographically random 32-byte hex `NAVIGATOR_SESSION_KEY`. Store the key only in hosting secrets. Rotation invalidates app cookies and requires sign-in again. Production traffic must use HTTPS.

## Verification

Build verification runs the software and account-boundary suites. Timeline/document tests are separate deployment checks. Transactional SQL tests verify own-account isolation, expiry, anonymous refusal, customer write refusal, unverified passwords, email-OTP acceptance, recovery-session refusal, revoked sessions, and owner grant/revoke. Their synthetic fixtures are rolled back. Real-provider browser tests use an explicitly named temporary synthetic account only; never use customer credentials in a test fixture. Remove synthetic accounts, sessions, factors and associated test entitlements after verification.

Browser checks cover public routes, owner screen interactions with mocked account actions, real-provider password/MFA access, session loss, local file hashing and calendar export, and existing guided-document paths. Local load testing is not a hosted load test or a capacity guarantee. This release is a procedural guide with account access, not certification of case-specific compliance, shared case management or a completed independent penetration/accessibility audit.

Current references consulted: [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp), [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), and [Render environment configuration](https://render.com/docs/configure-environment-variables).

Security-advisor residual: the provider reports leaked-password protection disabled. Its current documentation makes that protection a Pro-plan feature. The owner requested free hosting, so no paid upgrade is purchased or claimed. Password sign-in still requires a strong unique password and authenticator verification; email-code sign-in requires control of the approved mailbox. this does not replace a full breached-password screening service. See https://supabase.com/docs/guides/auth/password-security .

## Email code operation

The default sign-in sends a six-digit, single-use code valid for ten minutes. The pending request is encrypted in a same-browser HttpOnly cookie; no OTP or provider token enters browser storage or application logs. Same-origin JSON, request-size limits, client and global throttles, a 60-second account resend interval, and five verification attempts per account per fifteen-minute app window apply. The authentication provider also enforces its rate limits and replay protection. App counters are process-local on free hosting and reset on restart; they supplement provider controls rather than replace them.

Email OTP is single-factor mailbox-possession authentication, not MFA or AAL2. The owner explicitly chose it to avoid a separate authenticator. Provider-signed `amr` is checked in the database; user-editable metadata, a confirmed email alone, password-only, invite and recovery sessions do not grant plan or owner access. Existing role/plan checks and live-session checks remain. Phone login is disabled. Never enable it without revisiting the accepted OTP method.

Provider configuration: email OTP length 6; expiration 600 seconds; custom SMTP sender configured privately; OTP email template contains `{{ .Token }}` rather than a sign-in link. No mailbox password is stored in source or Render. For rollback, retain password/authenticator sign-in and restore the previous `verified_session` function only after communicating the login change.

References: [Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [JWT methods](https://supabase.com/docs/guides/auth/jwt-fields), [Hostinger SMTP settings](https://www.hostinger.com/support/1575756-how-to-get-email-account-configuration-details-for-hostinger-email/).
