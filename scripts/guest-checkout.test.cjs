'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const {Readable}=require('node:stream');
const {guestCheckout}=require('./guest-checkout.cjs');
const {stagingOrigin}=require('./plan-store.cjs');

const testEmail='ankur.attorneyatlaw+navigator-hosted-customer@gmail.com';
const guestId='b16ec65c-ec0e-4d2e-92ba-c14842569159';
const config={origin:stagingOrigin,url:'https://example.supabase.co',key:'test-publishable',token:'a'.repeat(64),mode:'simulated'};

async function post(guest,action,body,origin=stagingOrigin){
  const url='/api/guest-checkout/'+action;
  const req=Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]),{
    method:'POST',url,headers:{origin,'content-type':'application/json'},
  });
  const headers=new Map();
  const res={setHeader:(name,value)=>headers.set(name,value),getHeader:name=>headers.get(name),
    writeHead(code){this.status=code;},end(json){this.body=JSON.parse(json);}};
  assert.equal(await guest.handle(req,res,new URL(url,stagingOrigin)),true);
  const cookie=headers.get('Set-Cookie')?.split(';',1)[0];
  return {status:res.status,body:res.body,cookie,header:headers.get('Set-Cookie')};
}
const neverAccount=async()=>null;

test('guest start is staging-only, same-origin and limited to test recipients',async()=>{
  assert.equal((await post(guestCheckout({...config,origin:'https://navigator.example'}),'start',{email:testEmail,product:'checklist'})).status,404);
  const guest=guestCheckout(config);
  assert.equal((await post(guest,'start',{email:testEmail,product:'checklist'},'https://outside.example')).status,403);
  assert.equal((await post(guest,'start',{email:'outside@example.invalid',product:'checklist'})).status,403);
  const started=await post(guest,'start',{email:testEmail,product:'checklist'});
  assert.equal(started.status,200);
  assert.match(started.header,/^__Host-navigator-guest-checklist=.*HttpOnly; Secure; SameSite=Strict/);
  assert(!started.header.includes(testEmail));
  const req={url:'/api/checklist/session',headers:{cookie:started.cookie}};
  assert.equal((await guest.identify(neverAccount,'checklist')(req,{})).guest,true);
  assert.equal(await guest.identify(neverAccount,'compliance-checklist')(req,{}),null);
  req.headers.cookie=started.cookie.replace(/=(.)/,(_all,character)=>'='+(character==='a'?'b':'a'));
  assert.equal(await guest.identify(neverAccount,'checklist')(req,{}),null);
});

test('a receipt link exchanges for a cookie scoped to its captured order and product',async()=>{
  const guest=guestCheckout({...config,fetchImpl:async (_url,options)=>{
    const args=JSON.parse(options.body);
    assert.equal(args.p_action,'resume');
    assert.equal(args.p_token,config.token);
    return Response.json(args.p_data.resume==='b'.repeat(64)?{id:'order_test123',guest:guestId,product:'compliance-checklist'}:null);
  }});
  assert.equal((await post(guest,'resume',{token:'c'.repeat(64)})).status,403);
  const resumed=await post(guest,'resume',{token:'b'.repeat(64)});
  assert.equal(resumed.status,200);
  assert.equal(resumed.body.delivery,'/compliance-assessment.html?order=order_test123');
  assert(!JSON.stringify(resumed.body).includes('b'.repeat(64)));
  const req={url:'/api/compliance-assessment?order=order_test123',headers:{cookie:resumed.cookie}};
  const identify=guest.identify(neverAccount,'compliance-checklist');
  assert.equal((await identify(req,{})).id,guestId);
  req.url='/api/compliance-assessment?order=order_other';
  assert.equal(await identify(req,{}),null);
});
