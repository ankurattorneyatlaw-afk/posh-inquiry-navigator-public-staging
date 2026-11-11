'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {read,accessUntil,onlineFromEnvironment}=require('./online-checklist.cjs');
const {createChecklistCheckout,simulatedGateway}=require('./checklist-checkout.cjs');
const origin='https://navigator.example';
const orderId='order_testOnline';
const expiry='2027-03-09T12:00:00.000Z';

test('current online IC/LC checklist is exactly the v4 legal audit, not the retired Word checkbox edition',()=>{
 const x=read('4.0');
 assert.equal(Object.keys(x).join(','),'legalAudit');
 assert.equal(x.legalAudit.checks.length,84);
 assert.equal(x.legalAudit.sections.length,8);
 assert.equal(x.legalAudit.gates.length,8);
 assert.equal(x.legalAudit.reports.length,7);
 assert.throws(()=>read('2.0'),/edition unavailable/);
});

test('120-day online access is counted from verified capture, not from a later page visit',()=>{
 assert.equal(accessUntil({captured:true,downloadUntil:'2027-02-07T12:00:00.000Z'}),expiry);
 assert.equal(accessUntil({captured:false,downloadUntil:'2027-02-07T12:00:00.000Z'}),null);
});

test('account entitlement reads the read-only verified access RPC, with no older progress write',async()=>{
 const key='a'.repeat(64);
 const handler=onlineFromEnvironment({
  url:'https://synthetic.supabase.co',key:'publishable-fixture',token:key,
  fetchImpl:async(url,req)=>{
   assert(url.endsWith('/rpc/navigator_online_checklist'));
   assert.equal(req.headers.Authorization,'Bearer buyer-token');
   assert.deepEqual(JSON.parse(req.body),{p_token:key,p_id:null});
   return Response.json({active:true,edition:'2.0',id:orderId});
  }
 });
 assert.deepEqual(await handler.access({accessToken:'buyer-token'},null),{active:true,edition:'2.0',id:orderId});
 assert.equal(handler.read('4.0').legalAudit.checks.length,84);
 assert.throws(()=>handler.read('3.0'),/edition unavailable/);
});

test('only a verified active checklist holder can load the current 84-point legal audit',async()=>{
 let expired=false,reads=0;
 const order={id:orderId,organisation:'Synthetic Committee',edition:'2.0',accessUntil:expiry};
 const online={access:async(buyer,id)=>buyer.id==='buyer-a'&&(id===null||id===orderId)?{...order,active:!expired}:null,
  read:()=>{reads++;return read('4.0');}};
 const handler=createChecklistCheckout({origin,online,identify:async req=>req.account?{id:req.account}:null});
 async function call(route,account){
  const req=Readable.from([]);req.account=account;req.method='GET';req.headers={};
  const result={};const res={writeHead(status,headers){Object.assign(result,{status,headers});},end(body){result.body=JSON.parse(body);}};
  await handler(req,res,new URL('/api/checklist/'+route,origin));return result;
 }
 assert.equal((await call('content')).status,401);
 assert.equal((await call('content?order='+orderId,'buyer-b')).status,403);
 assert.equal((await call('content?order=invalid','buyer-a')).status,400);
 assert.equal((await call('download?order='+orderId,'buyer-a')).status,410);
 assert.equal(reads,0);
 const good=await call('content','buyer-a');
 assert.equal(good.status,200);
 assert.equal(good.body.edition,'4.0');
 assert.equal(good.body.legalAudit.checks.length,84);
 assert.equal(good.body.stages,undefined);
 assert.equal(good.body.checked,undefined);
 assert.equal(good.headers['Cache-Control'],'private, no-store');
 expired=true;
 const denied=await call('content?order='+orderId,'buyer-a');
 assert.equal(denied.status,410);
 assert.equal(denied.body.legalAudit,undefined);
 assert.equal(reads,1);
});

test('test purchase opens only current v4 checklist and retains its existing price and access period',async()=>{
 const gateway=simulatedGateway();
 const now=Date.parse('2026-11-09T12:00:00Z');
 let order;
 const handler=createChecklistCheckout({origin,gateway,now:()=>now,online:{read,access:async()=>null},
  identify:async()=>({id:'buyer-a'}),
  store:async(buyer,action,mode,data)=>{
   if(action==='create')order={id:data.p_id,organisation:data.p_organisation,captured:false};
   if(action==='capture')order={...order,captured:true,paymentId:data.p_payment,downloadUntil:new Date(now+90*86400000).toISOString()};
   return order;
  }});
 async function post(action,data){
  const req=Readable.from([Buffer.from(JSON.stringify(data))]);req.method='POST';req.headers={origin,'content-type':'application/json'};
  const result={};const res={writeHead(status){result.status=status;},end(body){result.body=JSON.parse(body);}};
  await handler(req,res,new URL('/api/checklist/'+action,origin));return result;
 }
 const created=await post('order',{organisation:'Example',testConsent:true});
 assert.equal(created.status,201);assert.equal(created.body.amount,99900);
 const verified=await post('verify',{orderId:created.body.orderId});
 assert.equal(verified.status,200);
 assert.equal(verified.body.accessUntil,expiry);
 assert.equal(verified.body.delivery,'/inquiry-checklist.html?order='+created.body.orderId);
});

test('retired checkbox progress endpoint rejects every write without calling a database store',async()=>{
 let writes=0;
 const online={read,access:async()=>{writes++;return null;}};
 const handler=createChecklistCheckout({origin,online,identify:async()=>({id:'buyer-a'})});
 const req=Readable.from([Buffer.from(JSON.stringify({number:1,checked:true}))]);
 req.method='POST';req.headers={origin,'content-type':'application/json'};
 const result={};const res={writeHead(status){result.status=status;},end(body){result.body=JSON.parse(body);}};
 await handler(req,res,new URL('/api/checklist/progress?order='+orderId,origin));
 assert.equal(result.status,410);
 assert.match(result.body.error,/retired/);
 assert.equal(writes,0);
});
