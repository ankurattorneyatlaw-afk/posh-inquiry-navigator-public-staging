'use strict';
const {Readable}=require('node:stream');
const assert=require('node:assert/strict');
const test=require('node:test');
const {createAssessmentHandler,scopeFrom,assessmentView}=require('./compliance-assessment.cjs');

const checks=[
  {id:1,title:'IC order',topic:'IC',question:'Is the order signed?',proof:'Order',action:'Issue the order',ic:true,priority:'Critical'},
  {id:8,title:'LC contacts',topic:'Reporting',question:'Are contacts current?',proof:'Notice',action:'Update the notice',priority:'High'},
  {id:16,title:'Case records',topic:'Cases',question:'Are records current?',proof:'Register',action:'Check the register',case:true},
  {id:57,title:'Company filings',topic:'Reporting',question:'Are filings current?',proof:'Receipt',action:'Review the filings'},
  {id:60,title:'Head Office approval',topic:'Portal',question:'Is it approved?',proof:'Receipt',action:'Follow up',office:'head'},
  {id:61,title:'Branch mapping',topic:'Portal',question:'Is it mapped?',proof:'Receipt',action:'Follow up',office:'branch'},
  {id:62,title:'IC update',topic:'Portal',question:'Is the IC current?',proof:'Receipt',action:'Update the IC',ic:true,conditional:true}
];
const input={workplace:'Gurugram office',district:'Gurugram',year:2026,workers:8,siteType:'standalone',complaints:false,employer:'other'};
test('scope uses establishment count, excludes irrelevant checks and blocks portal update until approval',()=>{
  const lc=assessmentView(scopeFrom(input),{},checks);
  assert.deepEqual(lc.applicable.map(q=>q.id),[8,60]);
  const ic=scopeFrom({...input,workers:10,siteType:'branch',siteWorkers:3});
  assert.equal(ic.route,'IC');
  assert.deepEqual(assessmentView(ic,{},checks).applicable.map(q=>q.id),[1,8,61,62]);
  assert.equal(assessmentView(ic,{},checks).applicable.at(-1).blocked,true);
  assert.equal(assessmentView(ic,{61:{value:'Yes'}},checks).applicable.at(-1).blocked,false);
  assert.throws(()=>scopeFrom({...input,siteType:'branch',siteWorkers:9}),/office headcount/);
});

test('captured order locks one scope, resumes, rejects conflicts and provides a repeatable final PDF',async ()=>{
  const order='order_assessment1';
  const origin='https://navigator.example';
  const stored={order,organisation:'Test organisation',scope:null,revision:null,answers:{},final:null,catalogue:checks};
  async function store(buyer,id,action,payload,revision) {
    if(buyer.id!=='owner'||id!==order)return null;
    if(action==='start'&&!stored.scope){stored.scope=payload;stored.revision=0;}
    if(['save','finish'].includes(action)){
      if(stored.final||revision!==stored.revision)return {conflict:true};
      if(action==='save')stored.answers[payload.id]=payload.answer;
      else stored.final=payload;
      stored.revision++;
    }
    return structuredClone(stored);
  }
  const handler=createAssessmentHandler({origin,identify:async req=>req.headers['x-test-account']?{id:req.headers['x-test-account']}:null,store,now:()=>Date.UTC(2026,10,9)});
  const request=async(body,account='owner',suffix='',id=order)=>{
    const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);
    req.method=body?'POST':'GET';
    req.headers={origin,'content-type':'application/json','x-test-account':account};
    let status,headers,content;
    await handler(req,{writeHead(s,h){status=s;headers=h;},end(value){content=value;}},
      new URL('/api/compliance-assessment'+suffix+'?order='+id,origin));
    return new Response(content,{status,headers});
  };
  assert.equal((await request(null,'')).status,401);
  assert.equal((await request(null,'other')).status,403);
  assert.equal((await request(null,'owner','','order_unpaid')).status,403);
  const start=await (await request({action:'start',scope:input})).json();
  assert.equal(start.review.remaining,2);
  const again=await (await request({action:'start',scope:{...input,workplace:'Another site'}})).json();
  assert.equal(again.scope.workplace,input.workplace);
  assert.equal((await request(null,'owner','/report')).status,409);
  assert.equal((await request({action:'finish',revision:0})).status,409);
  assert.equal((await request({action:'save',id:1,revision:0,answer:{value:'Yes',evidence:'P01'}})).status,400);
  assert.equal((await request({action:'save',id:8,revision:0,answer:{value:'Yes'}})).status,400);
  assert.equal((await request({action:'save',id:8,revision:0,answer:{value:'No',owner:'HR',due:'2026-12-01'}})).status,200);
  assert.equal((await request({action:'save',id:60,revision:0,answer:{value:'No'}})).status,409);
  const resumed=await (await request()).json();
  assert.equal(resumed.review.applicable[0].answer.owner,'HR');
  assert.equal((await request({action:'save',id:60,revision:1,answer:{value:'Partly',evidence:'Approval pending'}})).status,200);
  const done=await (await request({action:'finish',revision:2})).json();
  assert.equal(done.final,true);assert.equal(done.review.open,2);
  assert.equal((await request({action:'save',id:8,revision:3,answer:{value:'No'}})).status,409);
  const report=await request(null,'owner','/report');
  assert.equal(report.headers.get('content-type'),'application/pdf');
  const file=Buffer.from(await report.arrayBuffer());
  assert.equal(file.subarray(0,8).toString(),'%PDF-1.4');
  assert.match(file.toString('latin1'),/Approval pending/);
  assert.deepEqual(file,Buffer.from(await (await request(null,'owner','/report')).arrayBuffer()));
  assert.equal((await request(null,'other','/report')).status,403);
});
