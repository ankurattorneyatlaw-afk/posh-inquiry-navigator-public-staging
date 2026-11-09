# Publish POSH Inquiry Navigator

The production candidate starts with public guidance and manually approved Committee accounts. Online checkout and automated checkout reminders are closed in production. Staging can still run sandbox checkout and reminder previews. Keep the current staging service and its database for testing.

## Hosting and accounts

1. Choose the public website address. Use a separate web service for the production candidate. Keep automatic deployments off and use the reviewed commit. Set its health check to `/health`. Leave public indexing disabled during acceptance testing.
2. Connect a separate Navigator Supabase project. Start from an empty account database. Apply these existing scripts in order, then run the transactional tests in `database/account-access-test.sql`.
   1. `database/account-access.sql`
   2. `database/account-administration.sql`
   3. `database/owner-bootstrap.sql`
   4. `database/account-hardening.sql`
   5. `database/account-grant-idempotency.sql`
   6. `database/email-otp-access.sql`
3. Configure the production address as the authentication site's URL. Keep public signup off and configure the existing Hostinger mailbox as the authentication sender through custom SMTP. Set the code template to use `{{ .Token }}` with six digits and a ten-minute expiry. Enter mailbox credentials only in the hosting provider's private settings. Add the approved owner privately before provisioning their confirmed account. Review any legitimate existing access separately before migrating it.
4. Set the following hosting variables. Keep credentials in private settings and use a fresh session key.

| Variable | Value |
| --- | --- |
| `NAVIGATOR_DEPLOYMENT_MODE` | `production` |
| `NAVIGATOR_PUBLIC_ORIGIN` | The canonical HTTPS address without a trailing slash |
| `NAVIGATOR_ACCOUNT_ACCESS_ENABLED` | `true` |
| `NAVIGATOR_AUTH_URL` | The separate production project's Supabase HTTPS URL |
| `NAVIGATOR_AUTH_PUBLISHABLE_KEY` | That project's publishable key |
| `NAVIGATOR_SESSION_KEY` | A new random 32-byte key encoded as 64 hexadecimal characters |
| `NAVIGATOR_PUBLIC_INDEXING` | Omit during acceptance testing. Set to `true` after launch approval. |

Production does not require Razorpay keys, sandbox access tokens or reminder worker secrets. The existing Windows walkthrough sender is configured for staging. Verify the production walkthrough form and both messages with a production-specific mail setup before advertising automated walkthrough follow-up. The contact page is available while the production form is being configured. Community submissions require a configured moderation workflow.

## Acceptance on the production address

- Verify `/health`, public pages, legal and FAQ links, and the free Inquiry Checklist PDF. Verify the canonical address and that search indexing stays disabled until approved.
- Use a fresh browser to request an actual Gmail sign-in code, sign in, access the owner controls and sign out. Use a synthetic customer to check grant, access, revoke, expired access and a direct protected link. Verify the customer cannot access the owner tools. Remove synthetic users and revoke their sessions after the test.
- Verify that both checklist pages stay separate and explain that checkout is closed. Verify the payment, checkout and reminder routes deny test and live purchase attempts and that staging still supports its sandbox workflows.
- Turn on public indexing only after these checks pass. Keep real payments off and keep staging reminders in preview.
