# First-screen buyer review and section layout — 6.3

## Observed problem

The live page at 1280 × 720 placed its main action row at approximately y=661–711 and extended the hero to y=971. The staging banner, navigation, separate reading toolbar and vertically centred two-column layout consumed most of the initial screen. A buyer could not see the opening fully without scrolling.

## Changes

- Compact navigation with native Text size disclosure instead of a permanent full-width reading bar. All reading controls remain available by keyboard and touch; Escape closes the panel. Mobile uses an accessible Aa label and a correctly sized wordmark.
- Align the pitch at the top, shorten the supporting panel and lead with practical step-by-step support, editable drafts and deadline checks. Put Advocate Ankur Aggarwal’s approved identity and role beside the first action, with a profile link.
- At 1280 × 720 in local Chromium, the action row now ends near y=476, the professional identity near y=542 and the opening section near y=647. This is a meaningful viewport improvement, rather than simply hiding overflow. Mobile sections remain scrollable and enlarged text is not clipped.
- The fair-opportunity screen tip explains natural justice, meaningful notice/response and impartial consideration, with applicable Central Rule 7(4) cited. The official Gazette rule was checked at https://spniwcd.wcd.gov.in/uploads/pdf/1719914401_2NUqe91gql.pdf . The Prepare notices tip contains an illustrative hearing notice with placeholders, labelled NOT FOR ISSUE. It does not invent service, dates, a reply clock or findings. Both reuse existing focus/hover/touch/Escape behaviour.
- Plain-language marketing addresses members unfamiliar with legal terms. The buyer FAQ expressly preserves orientation/capacity-building, eligibility, independent Committee judgment and case-specific advice where needed. The site does not encourage skipping training or promise an appeal-safe result.
- Reviewed all nine Home sections in desktop and mobile captures. Rebalanced the drafting-value panel into two columns and moved profile principles into a full-width row of cards, reducing uneven empty columns. Applied balanced headings and pretty paragraph wrapping without justification or text clipping.
- Resources now use the wider canvas, a split introduction/status panel, shorter meaningful titles, aligned cards and a two-column scope note. Removed repeated “planned” wording from body copy while retaining every Planned status and clear sale unavailability. Fixed an unstyled visible skip link; it appears on keyboard focus instead.

## Validation

77 unit/security/timeline/document checks passed. Eight viewport sizes (320×640, 390×844, 768×1024, 1024×768, 1280×720, 1366×768, 1536×792, 1920×990) checked action/trust placement, heading/card/button clipping, horizontal overflow, 120% reading settings, keyboard disclosure and educational tips. Laptop/desktop primary actions and identity fit the initial viewport. Dedicated login’s send-code action also fits the tested desktop viewports. Resources, Home sections, Plans, login and simulated customer workspace were inspected/tested. No real owner credential or OTP was used.

Organisation buyer journeys passed at five widths, retaining plan selection into enquiry, handling unavailable/uncertain submissions, simulated OTP login, customer workspace and no-plan next actions. Public role guidance retains its larger readable sidebar. Fifty automated accessibility states had no WCAG A/AA-tag findings, including open reading controls and both screen tips. Automated results are not an independent accessibility certification.

No payment mode, plan amount, account permission, statutory calculation, procedural document or case-data storage boundary changed. Real payments and planned material sales remain disabled. The release uses the existing separate free Navigator Render service.
