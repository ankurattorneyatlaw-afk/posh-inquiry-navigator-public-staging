const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const release=JSON.parse(fs.readFileSync('dist/release.json'));assert.equal(release.environment,'staging');
assert.equal(fs.readdirSync('dist').length,7);
for(const [name,hash] of Object.entries(release.assets))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('dist/'+name)).digest('hex'),hash);
const main=fs.readFileSync('dist/main.js','utf8');assert(main.includes('₹1,49,999'));assert(!main.includes('data-download="report"'));assert(main.includes('Witness examination & evidence evaluation'));
console.log('Staging asset hashes and public boundaries verified.');
