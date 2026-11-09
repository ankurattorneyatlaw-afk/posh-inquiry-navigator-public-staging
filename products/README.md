# Protected digital editions

Only encrypted product packages are committed to this public repository. Public samples and catalogue descriptions are in `dist`. Plaintext paid editions, authoring sources and the encryption key must stay outside the repository.

Runtime delivery uses `NAVIGATOR_PRODUCT_ASSET_KEY`, a 32-byte key encoded as 64 lowercase hexadecimal characters, configured privately on the Navigator service. The package layout is `NVP1`, 12-byte IV, 16-byte authentication tag, then AES-256-GCM ciphertext. The exact original asset filename is authenticated as additional data. Wrong keys, altered content and missing configuration fail closed.

Keep an independently protected backup of the authoring sources and key. Rotating the key requires re-encrypting both packages and updating the service configuration in the same release. Never print the key in logs, checks or receipts.

This release creates only temporary, account-bound test product access. It never grants Committee roles. Production purchases, durable entitlements, invoicing and refund handling are not enabled.

## Compliance Checklist delivery

The separate Compliance Checklist uses the `compliance-checklist` product ID and
a personalised Word test file on staging while the final document is pending.

For the final file, prepare a protected Word parts package compatible with
`scripts/buyer-checklist.cjs` and encrypt it as
`products/compliance-checklist-template.json.enc` with the checklist asset key.
Use `compliance-checklist-template.json` as the package's authenticated filename
and register its SHA-256 in `dist/release.json`. Update the product's edition and
description in `dist/products.js` for the final file. Staging uses the separate
package when present. The original checklist uses its own package and orders.
