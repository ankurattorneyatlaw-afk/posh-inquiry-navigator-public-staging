# Plans, account journey and site-wide layout review — 6.4

The review covers buyer navigation, Plans, the dedicated sign-in page, the customer workspace and the website’s linked informational pages.

## Changes

- The public profile uses Ankur Aggarwal and factual founder/POSH training roles. Removed practising honorifics, the advocacy badge and practising-background wording from visible content, metadata and JSON-LD; recomputed structured-data CSP hashes. No licence claim was added. This content decision is not a legal compliance certification. Product enquiries remain about the software and educational support.
- Plans now begins at the page introduction, with less duplicate spacing, concise current/proposed scope and more compact cards. Current guide access remains distinct from proposed extended capabilities; proposed prices, real-payment settings and authorisation are unchanged.
- Login keeps the single email-code form, shorter purpose copy, consistent teal/navy styling and direct Plans, free FAQ and sign-in-help links. No account service or credential handling changed.
- The customer workspace places primary inquiry actions alongside access and renewal information on desktop, stacks on mobile and keeps secondary account references/onboarding collapsed. All existing control IDs and server permissions remain intact.
- Added shared compact branding/navigation and proportionate headings to preview, help, privacy, individual-support and test-checkout pages. The preview presents its five stages as responsive cards. Standardised paragraph wrapping and distinguished secondary action links.
- Fixed the privacy footer/consent destination and redirected the legacy privacy fragment. Expanded accessibility checks to the formerly untested standalone pages and corrected checkout contrast findings.

## Validation

77 unit/security/timeline/document checks passed. Five-width organisation journeys, desktop/mobile customer/admin routing, eight-size first-screen/login/workspace placement checks and paid lifecycle restore/expiry/renewal tests passed using synthetic accounts and records. The link/layout audit traverses 705 discovered internal destinations at each of 320, 768 and 1366 pixels, including FAQ/reference routes, checking response failures, page overflow and clipped headings/buttons. External sources, email and telephone actions are not transacted by this audit. Fifty-eight accessibility states are checked against automated WCAG A/AA tags; no independent accessibility certification is implied.

Standalone pages and customer screens were inspected visually. Public deployed assets, health/version and access denials are verified after deployment. Live authenticated owner access and merchant payments are not claimed as tested. Real payments remain disabled and the existing free separate Navigator service is retained. Case-information storage boundaries and procedural decision logic are unchanged.
