'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createCipheriv, randomBytes} = require('node:crypto');

const assetName = 'buyer-checklist-template.json';
const source = process.argv[2];
const key = process.env.NAVIGATOR_CHECKLIST_ASSET_KEY;
if (!source || !/^[a-f0-9]{64}$/.test(key || '')) {
  throw new Error('Set NAVIGATOR_CHECKLIST_ASSET_KEY privately and pass the private template JSON path.');
}
const input = fs.readFileSync(source);
require('./buyer-checklist.cjs').generate(JSON.parse(input), 'Template validation', 'PREVIEW-001');
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
cipher.setAAD(Buffer.from(assetName));
const payload = Buffer.concat([cipher.update(input), cipher.final()]);
const target = path.join(__dirname, '..', 'products', `${assetName}.enc`);
fs.writeFileSync(target, Buffer.concat([Buffer.from('NVP1'), iv, cipher.getAuthTag(), payload]), {flag:'wx'});
console.log('Encrypted template added to the private products directory.');
