# Simple sign-in and public access 5.10

The account page previously put lengthy account/privacy guidance ahead of sign-in and hid its free-resource section when paid access was active. It also omitted a direct FAQ link. The new always-visible Free resources navigation links to the existing free guidance, FAQ and inquiry-stage routes for signed-out users, paid members, account-service outages and unconfigured states.

The initial sign-in view has one email field and one Send email code action. Password/authenticator entry remains in a collapsed Other sign-in options section. Existing MFA/password security and account permissions are unchanged. Help and privacy copy is concise and collapsed; no account or legal record information is collected by the free links. The access-refresh action is shown for signed-in users and failures, rather than as a competing initial action. Existing sign-in error messages remain focused/announced.

Desktop and 320px tests verify one visible email input, visibility of all public links across access states, actual navigation/rendering of guidance, FAQ and stage pages without sign-in, and reflow. Existing OTP cooldown/error/change-email/owner checks, membership/renewal, paid lifecycle, keyboard retry and WCAG scans remain regression gates. No real OTP or account mutation is required for these tests.

Use a fresh account tab for this release. Existing inquiry tabs must be saved/verified before any refresh. No case storage, database schema, plan entitlements, billing or hosting cost changes are included.
