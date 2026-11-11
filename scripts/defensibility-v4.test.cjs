'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Script}=require('node:vm');
const fs=require('node:fs');
const v4=require('./defensibility-v4.cjs');
const {getPlanTools}=require('./plan-tools.cjs');
const {createChecklistCheckout}=require('./checklist-checkout.cjs');
const {Readable}=require('node:stream');
test('v4 source inventory has 84 distinct source-classified controls across eight domains',()=>{
 assert.equal(v4.checks.length,84);
 assert.deepEqual(v4.sections.map(x=>x.count),[10,9,20,12,13,4,8,8]);
 assert.equal(new Set(v4.checks.map(x=>x.id)).size,84);
 assert.ok(v4.checks.every(x=>['M','J','E'].includes(x.classification)&&['R','F','R+F'].includes(x.location)));
 assert.equal(v4.gates.length,8);
 assert.equal(v4.challenges.length,18);
 assert.equal(v4.reports.length,7);
 assert.equal(v4.statuses.length,6);
});
test('v4 profile does not silently exclude mandatory representation or Rule 7',()=>{
 const rule=v4.checks.find(x=>x.number===23);
 const representation=v4.checks.find(x=>x.number===65);
 assert.equal(v4.applicability(rule,{procedure:'prescribed'}).applies,true);
 assert.equal(v4.applicability(rule,{procedure:'unknown'}).applies,null);
 assert.equal(v4.applicability(representation,{bothEmployees:'yes'}).applies,true);
 assert.equal(v4.applicability(representation,{bothEmployees:'no'}).applies,false);
 assert.equal(v4.applicability(representation,{bothEmployees:'unknown'}).applies,null);
});
test('v4 lawful dispositions and specialist branches flag competence before merits',()=>{
 assert.equal(v4.route({conciliation:'completed',report:'statutory'}).report,'conciliation');
 assert.match(v4.route({forum:'unknown'}).flags.join(' '),/forum unresolved/);
 assert.match(v4.route({workers:35,icValid:false}).flags.join(' '),/no automatic LC substitution/);
 assert.match(v4.route({procedure:'ccs',report:'statutory'}).flags.join(' '),/preliminary and disciplinary/);
 assert.match(v4.route({minor:true,hei:true}).flags.join(' '),/POCSO/);
 assert.match(v4.route({appealForum:'unknown'}).flags.join(' '),/Section 18/);
});
test('each plan exposes baseline v4 review but professional report editor remains tier gated',()=>{
 for(const plan of ['essential','professional','advanced']){
  const t=getPlanTools(plan);
  assert.equal(t.legalAudit.checks.length,84);
  assert.equal(t.legalAudit.gates.length,8);
  assert.equal(t.legalAudit.challenges.length,18);
  assert.equal(t.reportSections?.length,plan==='essential'?undefined:44);
 }
 assert.ok(getPlanTools('advanced').advanced.scenarios.length>=18);
 assert.equal(getPlanTools('unknown'),null);
});
test('legal audit client script and changed report editor parse and retain human-only decisions',()=>{
 for(const path of ['dist/legal-audit-v4.js','dist/inquiry-checklist.js','dist/plan-tools.js','dist/workflow-documents.js'])
  new Script(fs.readFileSync(path,'utf8'),{filename:path});
 const widget=fs.readFileSync('dist/legal-audit-v4.js','utf8');
 assert.match(widget,/This review is held in this browser tab only/);
 assert.match(widget,/Committee route/);
 const report=fs.readFileSync('dist/workflow-documents.js','utf8');
 assert.match(report,/Eight independent release gates/);
 assert.match(report,/Legal report type and exclusions/);
});
test('licensed checklist content includes v4 only for verified holder',async()=>{
 const fake={access:async(buyer,id)=>buyer.id==='holder'?{id:'order_Test',organisation:'Test',edition:'2.0',active:true,accessUntil:'2027-03-01T00:00:00Z',checked:[]}:null,read:()=>({stages:[{title:'A',items:[]}],sources:[]})};
 const handler=createChecklistCheckout({origin:'https://navigator.invalid',identify:async req=>req.user?{id:req.user}:null,online:fake});
 async function request(user){
  const req=Readable.from([]);req.method='GET';req.headers={};req.user=user;
  let status,body;const res={writeHead(s){status=s;},end(s){body=JSON.parse(s);}};
  await handler(req,res,new URL('/api/checklist/content?order=order_Test','https://navigator.invalid'));
  return {status,body};
 }
 const denied=await request('other');assert.equal(denied.status,403);assert.equal(denied.body.legalAudit,undefined);
 const allowed=await request('holder');assert.equal(allowed.status,200);assert.equal(allowed.body.legalAudit.checks.length,84);
});
