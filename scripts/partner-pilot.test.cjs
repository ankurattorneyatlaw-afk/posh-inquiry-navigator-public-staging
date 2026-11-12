'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {createPartnerPilot,validateClaim,validateAdmin,validateOrderLink}=require('./partner-pilot.cjs');
const {stagingOrigin}=require('./plan-store.cjs');
const USER_ID='11111111-2222-3333-4444-555555555555';
function res(){return{status:0,body:null,headers:{},writeHead(code,headers){this.status=code;Object.assign(this.headers,headers||{})},setHeader(name,value){this.headers[name]=value},end(data){this.body=data?JSON.parse(data):null}}}
function req(method,body,origin=stagingOrigin){
 const stream=Readable.from(body===null?[]:[Buffer.from(JSON.stringify(body))]);
 stream.method=method;stream.headers={'origin':origin,'content-type':'application/json'};stream.socket={remoteAddress:'127.0.0.123'};
 return stream;
}
function make(options={}){const calls=[];
 const accounts={checkoutIdentity:async()=>({id:USER_ID,accessToken:'test-buyer-jwt'}),isOperator:async()=>false,...options.accounts};
 const pilot=createPartnerPilot({accounts,enabled:true,origin:stagingOrigin,url:'https://sample.supabase.co',key:'test-publishable',fetchImpl:async(path,opts)=>{
  calls.push({path,opts});return{ok:true,json:async()=>options.response||{accepted:true,pilot:true,real_commissions_enabled:false}};
 }});
 return {pilot,calls};
}
test('claim payload accepts only a deliberate code, never identity or amount',()=>{
 assert.deepEqual(validateClaim({code:'nav123abc456',confirmed:true}),{p_code:'NAV123ABC456',p_confirmed:true});
 for(const p of [{code:'NAV123ABC456',confirmed:false},{code:'NAVABC',confirmed:true},{code:'NAV123ABC456',confirmed:true,customerId:USER_ID},{code:'NAV123ABC456',confirmed:true,amount:100000}])
 assert.throws(()=>validateClaim(p));
});
test('operator actions cannot contain arbitrary fields or identifiers',()=>{
 assert.deepEqual(validateAdmin({action:'list'}),{p_action:'list',p_application_id:null});
 assert.deepEqual(validateAdmin({action:'pilot_pause',applicationId:USER_ID}),{p_action:'pilot_pause',p_application_id:USER_ID});
 for(const p of [{action:'activate_live',applicationId:USER_ID},{action:'pilot_issue',applicationId:'not-a-uuid'},{action:'list',bankDetails:'abc'}])assert.throws(()=>validateAdmin(p));
});
test('cross-origin referral POST fails before contacting identity service',async()=>{
 let identityCalls=0;const {pilot,calls}=make({accounts:{checkoutIdentity:async()=>{identityCalls++;return{id:USER_ID,accessToken:'x'}}}});
 const out=res();await pilot.handle(req('POST',{code:'NAV123ABC456',confirmed:true},'https://untrusted.example'),out,new URL(stagingOrigin+'/api/partners/pilot/claim'));
 assert.equal(out.status,403);assert.equal(identityCalls,0);assert.equal(calls.length,0);
});
test('unauthenticated buyer cannot register a code',async()=>{
 const {pilot,calls}=make({accounts:{checkoutIdentity:async()=>null}});
 const out=res();await pilot.handle(req('POST',{code:'NAV123ABC456',confirmed:true}),out,new URL(stagingOrigin+'/api/partners/pilot/claim'));
 assert.equal(out.status,401);assert.equal(calls.length,0);
});
test('non-operators cannot issue even pilot codes',async()=>{
 const {pilot,calls}=make();
 const out=res();await pilot.handle(req('POST',{action:'pilot_issue',applicationId:USER_ID}),out,new URL(stagingOrigin+'/api/partners/pilot/admin'));
 assert.equal(out.status,403);assert.equal(calls.length,0);
});
test('pilot claim uses verified JWT and server-owned RPC arguments only',async()=>{
 const {pilot,calls}=make();
 const out=res();await pilot.handle(req('POST',{code:'NAV123ABC456',confirmed:true}),out,new URL(stagingOrigin+'/api/partners/pilot/claim'));
 assert.equal(out.status,200);assert.equal(out.body.accepted,true);assert.equal(calls.length,1);
 assert.match(calls[0].path,/rpc\/navigator_partner_pilot_claim$/);
 const payload=JSON.parse(calls[0].opts.body);assert.deepEqual(payload,{p_code:'NAV123ABC456',p_confirmed:true});
 assert.equal(calls[0].opts.headers.Authorization,'Bearer test-buyer-jwt');
});
test('operator pilot list still needs operator verification, even with a signed-in buyer',async()=>{
 const {pilot,calls}=make({accounts:{isOperator:async()=>true},response:[]});
 const out=res();await pilot.handle(req('POST',{action:'list'}),out,new URL(stagingOrigin+'/api/partners/pilot/admin'));
 assert.equal(out.status,200);assert.equal(calls.length,1);assert.match(calls[0].path,/rpc\/navigator_partner_pilot_admin$/);
});
test('pilot disabled on non-staging origin and never enables bank payouts',async()=>{
 const {pilot}=make();const out=res();
 await pilot.handle(req('GET',null),out,new URL(stagingOrigin+'/api/partners/pilot/config'));
 assert.equal(out.status,200);assert.equal(out.body.realCommissionsEnabled,false);assert.equal(out.body.bankPayoutsEnabled,false);
 const separate=createPartnerPilot({accounts:{checkoutIdentity:async()=>null,isOperator:async()=>false},enabled:true,origin:'https://production.example',url:'https://sample.supabase.co',key:'test'});
 assert.equal(separate.configured(),false);
});

test('completed test order link accepts only allowed sources and order reference',()=>{
 assert.deepEqual(validateOrderLink({source:'plan',orderId:'order_TEST123456'}),{p_source:'plan',p_order_id:'order_TEST123456'});
 assert.deepEqual(validateOrderLink({source:'checklist',orderId:'order_ABC987654'}),{p_source:'checklist',p_order_id:'order_ABC987654'});
 for(const bad of [
  {source:'live',orderId:'order_TEST123456'},
  {source:'plan',orderId:'pay_TEST123456'},
  {source:'plan',orderId:'order_ABC123',customerId:USER_ID},
  {source:'plan',orderId:'order_TEST123456',paymentStatus:'captured',netRevenue:99900},
  {source:'guide',orderId:'order_TEST123456'}
 ])assert.throws(()=>validateOrderLink(bad));
});
test('buyer-owned test order is linked only through private verifying RPC',async()=>{
 const {pilot,calls}=make({response:{linked:true,testOnly:true,commissionCreated:false}});
 const out=res();await pilot.handle(req('POST',{source:'checklist',orderId:'order_TEST123456'}),out,new URL(stagingOrigin+'/api/partners/pilot/link-order'));
 assert.equal(out.status,200);assert.equal(out.body.linked,true);
 assert.equal(out.body.commissionCreated,false);assert.equal(calls.length,1);
 assert.match(calls[0].path,/rpc\/navigator_partner_pilot_link_order$/);
 assert.deepEqual(JSON.parse(calls[0].opts.body),{p_source:'checklist',p_order_id:'order_TEST123456'});
 assert.equal(calls[0].opts.headers.Authorization,'Bearer test-buyer-jwt');
});
test('no unauthenticated or cross-origin test order linking',async()=>{
 const noBuyer=make({accounts:{checkoutIdentity:async()=>null}}),out=res();
 await noBuyer.pilot.handle(req('POST',{source:'plan',orderId:'order_TEST123456'}),out,new URL(stagingOrigin+'/api/partners/pilot/link-order'));
 assert.equal(out.status,401);assert.equal(noBuyer.calls.length,0);
 const cross=make(),blocked=res();
 await cross.pilot.handle(req('POST',{source:'plan',orderId:'order_TEST123456'},'https://attacker.invalid'),blocked,new URL(stagingOrigin+'/api/partners/pilot/link-order'));
 assert.equal(blocked.status,403);assert.equal(cross.calls.length,0);
});
