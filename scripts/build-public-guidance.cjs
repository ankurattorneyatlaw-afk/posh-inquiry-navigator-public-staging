'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public-guidance-build');
const origin = 'https://navigator.thecosmicenergizers.com';
const files = ['styles.css', 'library.js', 'faq.js', 'cases.js', 'legal.js', 'finder.js', 'checklist-sample.pdf'];
const { records } = require('../dist/finder.js');
assert.equal(records.length, 444);
assert.equal(fs.readFileSync(path.join(root, 'dist/checklist-sample.pdf')).subarray(0, 4).toString(), '%PDF');

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output);
for (const name of files) fs.copyFileSync(path.join(root, 'dist', name), path.join(output, name));
const finder = path.join(output, 'finder.js');
fs.writeFileSync(finder, fs.readFileSync(finder, 'utf8').replaceAll(
  '#community/suggest-faq', 'mailto:training@thecosmicenergizers.com?subject=Suggest%20a%20POSH%20FAQ'
));
for (const name of ['index.html', 'public-guidance.css', 'public-guidance.js']) {
  fs.copyFileSync(path.join(root, 'public-guidance', name), path.join(output, name));
}
fs.writeFileSync(path.join(output, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: ' + origin + '/sitemap.xml\n');
fs.writeFileSync(path.join(output, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + origin + '/</loc></url></urlset>\n');
