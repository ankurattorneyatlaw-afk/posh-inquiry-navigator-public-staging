const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const release=JSON.parse(fs.readFileSync('dist/release.json'));assert.equal(release.environment,'staging');
assert.equal(fs.readdirSync('dist').length,33);assert.equal(release.search.indexable,false);assert.match(fs.readFileSync('dist/robots.txt','utf8'),/Disallow: \//);const institution=fs.readFileSync('dist/institutions.html','utf8');assert(institution.includes('Run a fair POSH inquiry.'));assert(institution.includes('Multiple POSH certifications from government institutions'));assert(institution.includes('application/ld+json'));assert(institution.includes('/institutions'));assert(fs.existsSync('scripts/analytics-api.cjs'));
for(const [name,hash] of Object.entries(release.assets))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('dist/'+name)).digest('hex'),hash);
const main=fs.readFileSync('dist/main.js','utf8');assert.equal(require('../dist/plans.js').catalogue.find(p=>p.id==='institutional').displayPrice,'₹1,49,999');assert(!main.includes('data-download="report"'));assert(main.includes('Witness examination & appreciation of evidence'));
assert(main.includes('Findings, representations and inquiry report'));assert(main.includes('Where both parties are employees'));assert(main.includes('Section 11(1) sets no fixed representation period'));
assert(main.includes('Section 11(1) — procedure; Section 11(4) — time limit'));assert(fs.readFileSync('dist/index.html','utf8').includes('community.js'));
assert(fs.readFileSync('dist/checkout.js','utf8').includes('/api/payments/'));assert(fs.readFileSync('dist/checkout.html','utf8').includes('STAGING · RAZORPAY TEST MODE'));
assert(fs.readFileSync('dist/community.js','utf8').includes('Load more answers'));assert(fs.readFileSync('dist/index.html','utf8').includes('Mobile navigation'));
assert(main.includes('an NDA is not a statutory condition for filing a complaint'));assert(main.includes('Committee constitution, potential conflicts and complaint requirements'));
const faq=require('../dist/faq.js');assert.equal(faq.items.length,110);assert.equal(faq.topics.length,13);assert(fs.readFileSync('dist/index.html','utf8').includes('faq.js'));
console.log('Staging asset hashes and public boundaries verified.');
const guidedHtml=fs.readFileSync('dist/guided.html','utf8'),guidedCode=fs.readFileSync('dist/guided.js','utf8');
assert(guidedCode.includes('Has this issue been resolved now?'));
new (require('node:vm').Script)(guidedCode,{filename:'dist/guided.js'});
const continuationCode=fs.readFileSync('dist/guided-continuation.js','utf8');
new (require('node:vm').Script)(continuationCode,{filename:'dist/guided-continuation.js'});
assert(guidedHtml.includes('guided-continuation.js'));
assert(!guidedHtml.includes('P01–P17 · Demonstration only'));
assert(continuationCode.includes('Conciliation closure and implementation record'));
assert(continuationCode.includes('Inquiry report and administrative closure'));

assert(guidedHtml.includes('No real cases or identities'));
for(const stage of ['P01','P05','P11','P14','P15','P16','P17'])assert(guidedCode.includes(stage));
for(const review of ['SERVICE_PROOF_REVIEW','REPLY_OPPORTUNITY_REVIEW','COMMITTEE_CORRECTION_REVIEW','HUMAN_LIMITATION_REVIEW','FACT_UNCERTAINTY_REVIEW'])assert(guidedCode.includes(review));
assert(guidedCode.includes('checked.size!==r.r.checks.length'));
assert(!guidedCode.includes('localStorage')&&!guidedCode.includes('fetch('));
const serverSource=fs.readFileSync('scripts/serve.cjs','utf8');
assert(serverSource.includes("'/guided':'guided.html'"));
assert(serverSource.includes('<a href="/guided">Guided IC/LC Inquiry</a>'));
console.log('Integrated guided inquiry staging safeguards verified.');
require('./test-guided.cjs');


const library=require('../dist/library.js');assert.equal(library.entries.length,400);assert.equal(library.categories.length,25);assert.equal(library.cases.length,19);assert(fs.readFileSync('dist/index.html','utf8').includes('library.js'));
assert.deepEqual(require('./payment-api.cjs').plans,require('../dist/plans.js').checkoutPlans);

const finder=require('../dist/finder.js');assert.equal(finder.audit.referenceQuestions,400);assert.equal(finder.audit.practicalQuestions,110);assert.equal(finder.records.length,439);

for(const c of library.cases){assert.equal(c.verificationLevel,"primary-verified");assert.match(c.sourceSha256,/^[a-f0-9]{64}$/);for(const k of ["identity","primaryText","proposition","pinpoint","disposition"])assert.equal(c.verification[k],true);}
assert(!library.cases.some(c=>["C09","C29","C37","C38","C50"].includes(c.id)));
