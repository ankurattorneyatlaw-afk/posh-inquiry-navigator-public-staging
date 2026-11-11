const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const release=JSON.parse(fs.readFileSync('dist/release.json'));assert.equal(release.environment,'staging');
assert.deepEqual(fs.readdirSync('dist').filter(n=>n!=='release.json').sort(),Object.keys(release.assets).sort());for(const [name,hash] of Object.entries(release.products||{}))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('products/'+name)).digest('hex'),hash);assert.equal(release.search.indexable,false);assert.match(fs.readFileSync('dist/robots.txt','utf8'),/Disallow: \//);const institution=fs.readFileSync('dist/institutions.html','utf8');assert(institution.includes('Run a fair POSH inquiry.'));assert(/multiple POSH certifications from government institutions/i.test(institution));assert(institution.includes('application/ld+json'));assert(institution.includes('/institutions'));assert(fs.existsSync('scripts/analytics-api.cjs'));
for(const [name,hash] of Object.entries(release.assets))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('dist/'+name)).digest('hex'),hash);
const main=fs.readFileSync('dist/main.js','utf8');assert.equal(require('../dist/plans.js').catalogue.find(p=>p.id==='institutional').displayPrice,'₹1,49,999');assert(!main.includes('data-download="report"'));assert(main.includes('Witness examination & appreciation of evidence'));
assert(main.includes('Findings, representations and inquiry report'));assert(main.includes('Where both parties are employees'));assert(main.includes('Section 11(1) sets no fixed representation period'));
assert(main.includes('Section 11(1) — procedure; Section 11(4) — time limit'));assert(fs.readFileSync('dist/index.html','utf8').includes('community.js'));
assert(fs.readFileSync('dist/checkout.js','utf8').includes('/api/payments/'));assert(fs.readFileSync('dist/checkout.html','utf8').includes('STAGING · RAZORPAY TEST MODE'));
assert(fs.readFileSync('dist/community.js','utf8').includes('Load more answers'));assert(fs.readFileSync('dist/index.html','utf8').includes('Mobile navigation'));
assert(main.includes('an NDA is not a statutory condition for filing a complaint'));assert(main.includes('Committee constitution, potential conflicts and complaint requirements'));
const faq=require('../dist/faq.js');assert.equal(faq.items.length,115);assert.equal(faq.topics.length,13);assert(fs.readFileSync('dist/index.html','utf8').includes('faq.js'));
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


const library=require('../dist/library.js');assert.equal(library.entries.length,400);assert.equal(library.categories.length,25);assert.equal(library.cases.length,37);assert(fs.readFileSync('dist/index.html','utf8').includes('library.js'));
assert.deepEqual(require('./payment-api.cjs').plans,require('../dist/plans.js').checkoutPlans);

const finder=require('../dist/finder.js');assert.equal(finder.audit.referenceQuestions,400);assert.equal(finder.audit.practicalQuestions,115);assert(finder.records.length>=444,'Finder must not lose previously published answers');
assert.deepEqual(finder.search().map(x=>Number(x.number)),Array.from({length:finder.records.length},(_,i)=>i+1));
for(const [number,id] of [[364,"who-is-protected"],[440,"online-inquiry-checklist-access"],[441,"choose-compliance-checklist"],[442,"walkthrough-request-next-step"],[443,"outside-presiding-officer-all-men-workforce"],[444,"preliminary-notes-and-inquiry-report"]])assert.equal(finder.search("FAQ "+number)[0].id,id);

for (const [source,target] of [[69,404],[404,69],[211,214],[214,438],[438,211],[292,444],[444,292]]){
  const record=finder.search('FAQ '+source)[0];
  assert(finder.relatedTo(record).some(faq=>Number(faq.number)===target));
}
const caseDirectory=require('../dist/cases.js');
assert.equal(caseDirectory.data.length,37);
assert.equal(new Set(caseDirectory.data.map(c=>c.id)).size,37);
assert.equal(new Set(caseDirectory.data.map(c=>c.directoryNumber)).size,37);
assert.equal(caseDirectory.data.filter(caseDirectory.checked).length,36);
assert.deepEqual(caseDirectory.data.filter(c=>!caseDirectory.checked(c)).map(c=>c.id),['SC026']);
assert.deepEqual(caseDirectory.data.filter(c=>c.sourceHost==='publisher').map(c=>c.id),['C20','C21']);
assert(caseDirectory.filter('Judgment 011')[0].linkedOrders.some(o=>o.date==='2025-09-15'&&o.url));
assert(caseDirectory.filter('2025 INSC 1106')[0].linkedOrders.some(o=>o.date==='2025-11-17'&&o.url));
assert.equal(caseDirectory.filter('Judgment 007')[0].id,'C08');
assert.equal(caseDirectory.filter('Ajit Seth')[0].id,'SC056');
assert.equal(caseDirectory.filter('Air France')[0].id,'SC027');
assert(caseDirectory.filter('Lucy Sequeira').some(c=>c.id==='SC078'&&caseDirectory.checked(c)));
assert(caseDirectory.filter('2026:GAU-AS:3698-DB').some(c=>c.id==='HC077'&&c.linkedOrders.length===2));
assert.equal(caseDirectory.filter('Judgment 029')[0].id,'SC029');
assert.equal(caseDirectory.tier(caseDirectory.filter('Judgment 029')[0]),'Supporting authority');
assert(finder.search('FAQ 423')[0].cases.includes('SC029'));
assert.equal(caseDirectory.filter('Judgment 064').length,0);
assert.equal(caseDirectory.filter('Judgment 075').length,0);
assert.equal(caseDirectory.filter('Judgment 076').length,0);
const publishedCaseIds=new Set(library.cases.map(c=>c.id));
for(const faq of finder.records){
  assert(faq.members.every(m=>(m.cases||[]).every(id=>publishedCaseIds.has(id))),faq.id);
  for(const link of faq.links||[]){
    const caseId=link.url.match(/^\/?#faq\/case-([a-z0-9]+)/i)?.[1];
    if(caseId)assert(publishedCaseIds.has(caseId.toUpperCase()),faq.id);
  }
}
for(const number of [69,211,214,248,292,404,438,444]){
  const record=finder.search('FAQ '+number)[0];
  assert(record.cases.length);
  assert(record.cases.every(id=>caseDirectory.data.some(c=>c.id===id&&caseDirectory.checked(c))));
}
assert(!library.cases.some(c=>["C09","C29","C37","C38","C50"].includes(c.id)));
