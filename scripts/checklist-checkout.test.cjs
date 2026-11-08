'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {Readable}=require('node:stream');
const {createHmac}=require('node:crypto');
const {createChecklistCheckout,razorpayTest,simulatedGateway}=require('./checklist-checkout.cjs');

const origin='https://test.navigator';
const template={
  'word/header2.xml':'[Organisation] [Reference]',
  'word/footer2.xml':'[Organisation] [Reference]',
  'customXml/item2.xml':'[Organisation] [Reference]',
  'word/settings.xml':'w:edit="forms"'
};
function fixture(gateway) {
  const records=new Map();
  let now=Date.parse('2026-11-08T00:00:00Z');
  const store=async (buyer,action,mode,data)=>{
    if(action==='create') {
      const row={id:data.p_id,organisation:data.p_organisation,owner:buyer.id,mode,captured:false};
      records.set(row.id,row);return row;
    }
    const owner=row=>row?.owner===buyer.id&&row.mode===mode;
    if(action==='latest')return [...records.values()].reverse().find(row=>owner(row)&&!row.cancelled);
    const row=records.get(data.p_id);
    if(!owner(row))return null;
    if(action==='cancel'&&!row.captured)row.cancelled=true;
    if(action==='capture') {
      if(row.cancelled)return null;
      if(row.paymentId&&row.paymentId!==data.p_payment)throw Error('duplicate');
      row.paymentId=data.p_payment;row.captured=true;
      row.downloadUntil??=new Date(now+90*86400000).toISOString();
    }
    row.downloadAvailable=row.captured&&now<Date.parse(row.downloadUntil);
    return row;
  };
  const create=()=>createChecklistCheckout({origin,gateway,store,readTemplate:()=>template,identify:async req=>req.account?{id:req.account}:null});
  let handler=create();
  const call=async (route,body,account='buyer-a',requestOrigin=origin)=>{
    const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
    req.account=account;req.method=body===undefined?'GET':'POST';req.headers={origin:requestOrigin,'content-type':'application/json'};
    const result={};
    const res={writeHead(status,headers){result.status=status;result.headers=headers;},end(value){result.body=Buffer.isBuffer(value)||value instanceof Uint8Array?Buffer.from(value):JSON.parse(value);}};
    await handler(req,res,new URL('/api/checklist/'+route,origin));return result;
  };
  return {call,restart(){handler=create();},advance(ms){now+=ms;},records};
}

test('simulated checkout stores captured order before delivery and survives handler restart',async()=>{
  const {call,restart,records}=fixture(simulatedGateway());
  assert.equal((await call('order',{organisation:'A',testConsent:true},'')).status,401);
  assert.equal((await call('order',{organisation:'A',testConsent:true},'buyer-a','https://other.example')).status,403);
  assert.equal((await call('order',{organisation:'A',testConsent:true,amount:1})).status,400);
  const created=await call('order',{organisation:'Example & Partners',testConsent:true});
  assert.equal(created.status,201);assert.equal(created.body.amount,99900);
  const {orderId}=created.body;
  const download='download?order='+orderId;
  assert.equal((await call(download)).status,403);
  assert.equal((await call('verify',{orderId},'buyer-b')).status,403);
  const verified=await call('verify',{orderId});
  assert.equal(verified.status,200);assert.equal(records.get(orderId).captured,true);
  restart();
  assert.equal((await call('session')).body.latest.orderId,orderId);
  const file=await call(download);
  assert.equal(file.status,200);assert.match(file.headers['Content-Type'],/wordprocessingml/);
  assert.ok(file.body.includes(Buffer.from('Example &amp; Partners')));
  assert.ok(file.body.includes(Buffer.from(orderId)));
  assert.equal((await call(download,undefined,'buyer-b')).status,403);
  assert.deepEqual((await call('verify',{orderId})).body,verified.body);
});

test('Razorpay test adapter requires a valid signature and captured matching INR payment',async()=>{
  const secret='test-fixture-secret';
  const orderId='order_test123',paymentId='pay_test123';
  let payment={id:paymentId,order_id:orderId,amount:99900,currency:'INR',status:'authorized'};
  let providerReads=0;
  const gateway=razorpayTest({keyId:'rzp_test_fixture',secret,fetchImpl:async (url,options)=>{
    if(url.endsWith('/orders')) {assert.equal(JSON.parse(options.body).amount,99900);return {ok:true,json:async()=>({id:orderId,amount:99900,currency:'INR'})};}
    providerReads++;return {ok:true,json:async()=>payment};
  }});
  const {call}=fixture(gateway);
  assert.equal(razorpayTest({keyId:'rzp_live_fixture',secret}),null);
  assert.equal((await call('order',{organisation:'Example',testConsent:true})).status,201);
  assert.equal((await call('verify',{orderId,paymentId,signature:'0'.repeat(64)})).status,400);
  assert.equal(providerReads,0);
  const signature=createHmac('sha256',secret).update(orderId+'|'+paymentId).digest('hex');
  assert.equal((await call('verify',{orderId,paymentId,signature})).status,409);
  payment={...payment,status:'captured',amount:1};
  assert.equal((await call('verify',{orderId,paymentId,signature})).status,400);
  payment={...payment,amount:99900,live_mode:true};
  assert.equal((await call('verify',{orderId,paymentId,signature})).status,400);
  payment={...payment,live_mode:false};
  assert.equal((await call('verify',{orderId,paymentId,signature})).status,200);
});

test('cancellation persists, is owner-only, and leaves the earlier captured order available',async()=>{
  const {call,restart,records}=fixture(simulatedGateway());
  const first=(await call('order',{organisation:'Original buyer',testConsent:true})).body.orderId;
  await call('verify',{orderId:first});
  const pending=(await call('order',{organisation:'Next order',testConsent:true})).body.orderId;
  assert.equal((await call('cancel',{orderId:pending},'buyer-b')).status,403);
  assert.equal((await call('cancel',{orderId:first})).status,409);
  assert.equal((await call('cancel',{orderId:pending})).body.latest.orderId,first);
  restart();
  assert.equal((await call('session')).body.latest.orderId,first);
  assert.equal((await call('cancel',{orderId:pending})).body.cancelled,true);
  assert.equal((await call('verify',{orderId:pending})).status,409);
  assert.equal((await call('download?order='+pending)).status,403);
  assert.equal(records.get(pending).captured,false);
  assert.equal((await call('download?order='+first)).status,200);
});

test('redownload ends exactly 90 days from capture, with no extension after re-verification',async()=>{
  const {call,advance,restart}=fixture(simulatedGateway());
  const orderId=(await call('order',{organisation:'Example',testConsent:true})).body.orderId;
  advance(86400000);
  const captured=(await call('verify',{orderId})).body;
  assert.equal(captured.downloadUntil,'2027-02-07T00:00:00.000Z');
  advance(90*86400000-1);
  assert.equal((await call('download?order='+orderId)).status,200);
  advance(1);
  restart();
  assert.equal((await call('download?order='+orderId)).status,410);
  assert.equal((await call('download?order='+orderId,undefined,'buyer-b')).status,403);
  const expired=(await call('verify',{orderId})).body;
  assert.equal(expired.downloadUntil,captured.downloadUntil);
  assert.equal(expired.delivery,null);
});
