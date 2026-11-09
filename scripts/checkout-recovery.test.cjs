
'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const http=require('node:http');
const {createRecovery,recoveryMessage}=require('./checkout-recovery.cjs');
const {stagingOrigin}=require('./plan-store.cjs');
const workerToken='b'.repeat(64);
const checkoutToken='a'.repeat(64);
const attempt='a1234567-b123-4123-8123-c123456789ab';
const stopToken='a2234567-b123-4123-8123-c123456789ab';
const buyer={accessToken:'verified-test-token'};
const inbox='navigator-reminders@example.invalid';
const state={email:inbox,product:'checklist',step:1,failed:true,unsubscribe:stopToken,orders:[]};

async function fixture(run,{jobs=[],payments=[],mode='preview'}={}){
  const calls=[],sent=[];
  let index=0,current;
  const recovery=createRecovery({
    origin:stagingOrigin,url:'https://synthetic.supabase.co',key:'fixture',storeToken:checkoutToken,workerToken,
    mode,allowEmail:inbox,keyId:'rzp_test_fixture',gatewaySecret:'fixture',
    identify:async req=>req.headers['x-test-signed-in']==='yes'?buyer:null,
    sendMail:async payload=>{sent.push(payload);return {state:'accepted'};},
    fetchImpl:async(url,options)=>{
      if(url.startsWith('https://api.razorpay.com'))return Response.json({items:payments});
      const body=JSON.parse(options.body);calls.push({body,headers:options.headers});
      if(body.p_action==='claim'){current=jobs[index++];return Response.json(current?{claim:attempt}:null);}
      if(body.p_action==='authorize')return Response.json(current??null);
      return Response.json({attempt});
    }
  });
  const server=http.createServer(async(req,res)=>{if(!await recovery(req,res,new URL(req.url,'http://localhost')))res.end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api/checkout-recovery/';
  async function request(action,data,{signed=true,origin=stagingOrigin,authorization}={}){
    const headers={Origin:origin,'Content-Type':'application/json',...(signed?{'x-test-signed-in':'yes'}:{}),...(authorization?{authorization}:{})};
    const r=await fetch(base+action,{method:'POST',headers,body:JSON.stringify(data)});
    return {status:r.status,body:await r.json()};
  }
  try{await run({request,calls,sent});}finally{await new Promise(resolve=>server.close(resolve));}
}

test('a verified buyer can save an attempt with or without optional email consent',()=>fixture(async({request,calls})=>{
  assert.equal((await request('begin',{product:'checklist',optIn:false},{signed:false})).status,401);
  assert.equal((await request('begin',{product:'checklist',optIn:false},{origin:'https://elsewhere.invalid'})).status,403);
  assert.equal((await request('begin',{product:'checklist',optIn:true,email:'other@example.invalid'})).status,400);
  assert.equal((await request('begin',{product:'checklist',optIn:false})).body.attempt,attempt);
  assert.equal(calls.at(-1).body.p_opt_in,false);
  assert.equal((await request('begin',{product:'compliance-checklist',optIn:true})).status,200);
  assert.equal(calls.at(-1).body.p_opt_in,true);
  assert.equal(calls.at(-1).headers.Authorization,'Bearer '+buyer.accessToken);
  await request('failed',{product:'compliance-checklist',attempt});
  assert.equal(calls.at(-1).body.p_attempt,attempt);
  assert.equal((await request('unsubscribe',{token:stopToken},{signed:false})).status,200);
  assert.equal(calls.at(-1).body.p_action,'unsubscribe');
}));

test('staging previews product-specific reminders, skips paid orders and withholds when payment is pending',()=>fixture(async({request,calls,sent})=>{
  assert.equal((await request('dispatch',{})).status,403);
  const result=await request('dispatch',{}, {authorization:'Bearer '+workerToken});
  assert.deepEqual(result.body.results,{preview:1,paid:1,uncertain:1});
  assert.equal(sent.length,0);
  assert.deepEqual(calls.filter(x=>x.body.p_action==='finish').map(x=>x.body.p_result),['preview','paid','uncertain']);
},{jobs:[state,{paid:true},{...state,orders:['order_Fixture']}],payments:[{status:'authorized'}]}));

test('mail transport can reach only the configured staging inbox',()=>fixture(async({request,sent})=>{
  const result=await request('dispatch',{}, {authorization:'Bearer '+workerToken});
  assert.deepEqual(result.body.results,{accepted:1,ineligible:1});
  assert.equal(sent.length,1);
  assert.match(sent[0].textContent,/43 checks/);
  assert.match(sent[0].textContent,/checkout-reminders\.html#/);
  const role=recoveryMessage({...state,product:'respondent',step:2},stagingOrigin);
  assert.doesNotMatch(role.subject,/respondent|POSH/i);
  assert.match(role.textContent,/90 days/);
},{mode:'test-inbox',jobs:[state,{...state,email:'other@example.invalid'}]}));

