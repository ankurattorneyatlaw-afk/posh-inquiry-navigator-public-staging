'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Script}=require('node:vm');
const fs=require('node:fs');
const v4=require('./defensibility-v4.cjs');
const {getPlanTools}=require('./plan-tools.cjs');
const {createChecklistCheckout}=require('./checklist-checkout.cjs');
const {Readable}=require('node:stream');

test('v4 legal design contains exactly 84 distinct controls across eight domains',()=>{
 assert.equal(v4.checks.length,84);
 assert.deepEqual(v4.sections.map(x=>x.count),[10,9,20,12,13,4,8,8]);
 assert.equal(new Set(v4.checks.map(x=>x.id)).size,84);
 assert.ok(v4.checks.every(x=>['M','J','E'].includes(x.classification)&&['R','F','R+F'].includes(x.location)));
 assert.equal(v4.gates.length,8);assert.equal(v4.reports.length,7);assert.equal(v4.challenges.length,18);
});
test('Rule 7 and Section 11(1) findings representations remain conditional on applicable law',()=>{
 const rule=v4.checks.find(x=>x.number===23),representation=v4.checks.find(x=>x.number===65);
 assert.equal(v4.applicability(rule,{procedure:'prescribed'}).applies,true);
 assert.equal(v4.applicability(rule,{procedure:'unknown'}).applies,null);
 assert.equal(v4.applicability(representation,{bothEmployees:'yes'}).applies,true);
 assert.equal(v4.applicability(representation,{bothEmployees:'no'}).applies,false);
 assert.equal(v4.applicability(representation,{bothEmployees:'unknown'}).applies,null);
});
test('special routes do not force an invalid inquiry or presume a disciplinary conclusion',()=>{
 assert.equal(v4.route({conciliation:'completed',report:'statutory'}).report,'conciliation');
 assert.match(v4.route({forum:'unknown'}).flags.join(' '),/forum unresolved/);
 assert.match(v4.route({workers:35,icValid:false}).flags.join(' '),/no automatic LC substitution/);
 assert.match(v4.route({procedure:'ccs',report:'statutory'}).flags.join(' '),/preliminary and disciplinary/);
 assert.match(v4.route({minor:true,hei:true}).flags.join(' '),/POCSO/);
 assert.match(v4.route({appealForum:'unknown'}).flags.join(' '),/Section 18/);
});
test('every plan exposes current report structure and current 84-point audit; advanced sections remain tier-gated',()=>{
 for(const plan of ['essential','professional','advanced']){
  const tools=getPlanTools(plan);
  assert.equal(tools.legalAudit.checks.length,84);
  assert.equal(tools.reportOutline.length,13);
  assert.equal(tools.allegationMatrixFields.length,14);
  assert.equal(Object.keys(tools.reportTypeChapters).length,7);
  assert.ok(Object.values(tools.reportTypeChapters).every(indices=>indices.length>0&&indices.every(i=>i>=0&&i<13)));
  assert.equal(tools.reportSections?.length,plan==='essential'?undefined:13);
 }
 assert.ok(getPlanTools('advanced').advanced.scenarios.length>=18);
 assert.equal(getPlanTools('unknown'),null);
});
test('current client components and Committee document templates parse, with no obsolete product copy',()=>{
 for(const path of ['dist/legal-audit-v4.js','dist/inquiry-checklist.js','dist/plan-tools.js','dist/workflow-documents.js','dist/main.js'])
  new Script(fs.readFileSync(path,'utf8'),{filename:path});
 assert.match(fs.readFileSync('dist/legal-audit-v4.js','utf8'),/Your 84-point coded audit is kept in this browser tab/);
 const report=fs.readFileSync('dist/workflow-documents.js','utf8');
 assert.match(report,/Eight independent release gates/);
 assert.match(report,/Legal report type and exclusions/);
});
test('licensed 84-point content is accessible only to the verified active purchaser',async()=>{
 const fake={access:async(buyer,id)=>buyer.id==='holder'?{id:'order_Test',organisation:'Test',active:true,accessUntil:'2027-03-01T00:00:00Z'}:null,read:()=>({legalAudit:v4.publicData()})};
 const handler=createChecklistCheckout({origin:'https://navigator.invalid',identify:async req=>req.user?{id:req.user}:null,online:fake});
 async function request(user){
  const req=Readable.from([]);req.method='GET';req.headers={};req.user=user;
  let status,body;const res={writeHead(s){status=s;},end(s){body=JSON.parse(s);}};
  await handler(req,res,new URL('/api/checklist/content?order=order_Test','https://navigator.invalid'));
  return {status,body};
 }
 const denied=await request('other');assert.equal(denied.status,403);assert.equal(denied.body.legalAudit,undefined);
 const allowed=await request('holder');assert.equal(allowed.status,200);
 assert.equal(allowed.body.legalAudit.checks.length,84);assert.equal(allowed.body.edition,'4.0');
 assert.equal(allowed.body.checked,undefined);assert.equal(allowed.body.stages,undefined);
});
test('only the v4 checklist is rendered and it explicitly offers eight report gates',()=>{
 const html=fs.readFileSync('dist/inquiry-checklist.html','utf8');
 assert.match(html,/84-Point IC\/LC Legal Checklist/);
 assert.match(html,/id="v4-inquiry-audit"/);
 assert.match(html,/href="#v4-84-checks"/);
 assert.match(html,/href="#v4-release-gates"/);
 assert.doesNotMatch(html,/legacy-checklist|checklist-stages|checklist-progress|checklist-sample/);
 const client=fs.readFileSync('dist/inquiry-checklist.js','utf8');
 assert.match(client,/NavigatorDefensibilityV4\.mount/);
 assert.match(client,/84-point legal checklist ready/);
 assert.doesNotMatch(client,/legacy|43-point|43 checked|importBrowserTicks/);
 const widget=fs.readFileSync('dist/legal-audit-v4.js','utf8');
 assert.match(widget,/controls\.id='v4-84-checks';controls\.open=true/);
 assert.match(widget,/gatePanel\.id='v4-release-gates'/);
 const css=fs.readFileSync('dist/digital.css','utf8');
 assert.match(css,/\.checklist-primary-intro/);
});
