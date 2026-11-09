'use strict';
const {Readable}=require('node:stream');
const assert=require('node:assert/strict');
const test=require('node:test');
const {createAssessmentHandler,scopeFrom,assessmentView,pdf}=require('./compliance-assessment.cjs');

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
test('the inquiry report check distinguishes IC dispatch and authorised LC confirmation',()=>{
  const report={id:22,title:'Inquiry report',case:true,question:'Original IC question',proof:'Original IC proof'};
  const [lc]=assessmentView(scopeFrom({...input,complaints:true}),{},[report]).applicable;
  assert.match(lc.question,/Local Committee.*District Officer within 10 days/);
  assert.match(lc.referenceNote,/choose Not sure/);
  assert.match(lc.referenceExamples.Yes,/LC confirmation LC-22/);
  const [ic]=assessmentView(scopeFrom({...input,workers:10,complaints:true}),{},[report]).applicable;
  assert.match(ic.question,/Internal Committee.*within 10 days/);
  assert.match(ic.referenceExamples.Yes,/completion on 2 Nov, delivery to the employer on 5 Nov/);
  assert.equal(ic.referenceNote,undefined);
});

test('IC examples show the reporting routes and select annual report details based on complaint setup',()=>{
  const ids=[8,11,28,32,44];
  const catalogue=ids.map(id=>({id,title:'Check '+id,question:'Question',proof:'Proof'}));
  const scope=scopeFrom({...input,workers:10});
  const byId=complaints=>Object.fromEntries(assessmentView({...scope,complaints},{},catalogue).applicable.map(q=>[q.id,q]));
  const no=byId(false), yes=byId(true);
  assert.match(no[28].question,/five required details/);
  assert.match(no[28].referenceExamples.Yes,/zero complaints.*two awareness programmes.*no case action/);
  assert.match(yes[28].referenceExamples.Yes,/one complaint.*summary of action/);
  assert.match(no[8].referenceExamples.Yes,/complaint against the employer/);
  assert.match(no[11].referenceExamples.Yes,/relevant shifts and locations/);
  assert.match(no[32].referenceExamples.Yes,/contact details of every member/);
  assert.match(no[44].referenceExamples.Yes,/current IC contacts.*district LC.*against the employer/);
});

test('compact finding gaps leave room for short exclusions in an LC Branch PDF',()=>{
  const applicable=Array.from({length:12},(_,i)=>({
    title:'Finding '+i,priority:'High',authority:'Basis '+i,answer:{value:'Yes',evidence:'Record '+i}
  }));
  const excluded=[{title:'Excluded 1',reason:'Company-only.'},{title:'Excluded 2',reason:'IC-only.'}];
  const report=pdf({scope:scopeFrom({...input,siteType:'branch',siteWorkers:3}),review:{applicable,excluded,open:0},
    organisation:'Test employer',order:'order_short_tail',finalisedAt:'2026-11-09T00:00:00Z'}).toString('latin1');
  assert.match(report,/\/Type \/Pages \/Count 1\b/);
  assert.match(report,/Excluded 2 \| IC-only/);
});

test('PDF pagination keeps wrapped findings and excluded checks with their text',()=>{
  const applicable=Array.from({length:25},(_,i)=>({
    title:'Finding '+i,priority:'High',authority:'Basis '+i,next:'Action '+i,
    answer:{value:'Partly',evidence:('A long record reference '.repeat(8))+'end marker '+i,owner:'Owner '+i}
  }));
  const excluded=Array.from({length:22},(_,i)=>({
    title:'Excluded '+i,reason:'The condition did not apply in the review year. '.repeat(3)+'end exclusion '+i
  }));
  const report=pdf({scope:scopeFrom(input),review:{applicable,excluded,open:25},
    organisation:'Test employer',order:'order_pagination',finalisedAt:'2026-11-09T00:00:00Z'}).toString('latin1');
  const pages=[...report.matchAll(/stream\nBT (.*?) ET\nendstream/gs)].map(match=>match[1].replace(/\) Tj T\*\n\(/g,' '));
  assert(pages.length>2);
  for(let i=0;i<applicable.length;i++){
    const finding=pages.find(p=>p.includes('Finding '+i+' | High'));
    assert(finding?.includes('end marker '+i+' Action: Action '+i+' Owner: Owner '+i+' |'));
  }
  const exclusionPage=pages.find(p=>p.includes('CHECKS EXCLUDED BY SETUP'));
  assert(exclusionPage?.includes('Excluded 0 |'));
  for(let i=0;i<excluded.length;i++){
    const page=pages.find(p=>p.includes('Excluded '+i+' |'));
    assert(page?.match(new RegExp('end exclusion '+i+'\\b')));
  }
});

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

test('saved answers choose the next question and changed parent answers invalidate stale follow-ups',()=>{
  const scope=scopeFrom(input);
  const answers={8:{value:'No',sequence:1},1016:{value:'Yes',branchKey:'1',evidence:'Assigned action'}};
  let review=assessmentView(scope,answers,checks);
  assert.deepEqual(review.applicable.map(q=>q.id),[8,1016,60]);
  assert.equal(review.applicable[1].answer.value,'Yes');
  answers[8]={value:'Not sure',sequence:3};
  review=assessmentView(scope,answers,checks);
  assert.deepEqual(review.applicable.map(q=>q.id),[8,1017,60]);
  assert.match(review.applicable[1].question,/verify the facts/);
  answers[8]={value:'No',sequence:4};
  assert.equal(assessmentView(scope,answers,checks).applicable[1].answer,null);
  answers[8]={value:'Yes',sequence:5,evidence:'Current display record'};
  assert.deepEqual(assessmentView(scope,answers,checks).applicable.map(q=>q.id),[8,60]);
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
  assert.equal(resumed.review.applicable[1].id,1016);
  assert.equal((await request({action:'save',id:1017,revision:1,answer:{value:'No'}})).status,400);
  assert.equal((await request({action:'save',id:1016,revision:1,answer:{value:'Yes',evidence:'Action reference'}})).status,200);
  assert.equal((await request({action:'save',id:60,revision:2,answer:{value:'Partly',evidence:'Approval pending'}})).status,200);
  assert.equal((await request({action:'finish',revision:3})).status,409);
  assert.equal((await request({action:'save',id:1120,revision:3,answer:{value:'Yes',evidence:'Follow-up assigned'}})).status,200);
  const done=await (await request({action:'finish',revision:4})).json();
  assert.equal(done.final,true);assert.equal(done.review.open,2);
  assert.equal((await request({action:'save',id:8,revision:5,answer:{value:'No'}})).status,409);
  const report=await request(null,'owner','/report');
  assert.equal(report.headers.get('content-type'),'application/pdf');
  const file=Buffer.from(await report.arrayBuffer());
  assert.equal(file.subarray(0,8).toString(),'%PDF-1.4');
  assert.match(file.toString('latin1'),/Approval pending/);
  assert.match(file.toString('latin1'),/MANAGEMENT AND EMPLOYER REVIEW/);
  assert.match(file.toString('latin1'),/Head Office approval \| Corrective action follow-up/);
  assert.doesNotMatch(file.toString('latin1'), /\bP(?:08|60)\b/);
  assert.deepEqual(file,Buffer.from(await (await request(null,'owner','/report')).arrayBuffer()));
  assert.equal((await request(null,'other','/report')).status,403);
});
test('review year is bounded by the current year in India',()=>{
  const base={workplace:'Synthetic Workplace',district:'Synthetic District',workers:10,siteWorkers:null,siteType:'standalone',
    complaints:false,employer:'other',listed:false,mca:false,sebi:false};
  const before=Date.parse('2026-12-31T18:29:59Z'),after=Date.parse('2026-12-31T18:30:00Z');
  assert.throws(()=>scopeFrom({...base,year:2027},before),/2013 to 2026/);
  assert.equal(scopeFrom({...base,year:2027},after).year,2027);
  assert.throws(()=>scopeFrom({...base,year:2028},after),/2013 to 2027/);
});
