'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream');
const {createPartnerFinanceLab,validateReview}=require('./partner-finance-api.cjs');
const {stagingOrigin}=require('./plan-store.cjs');
const UID='11111111-2222-3333-4444-555555555555';
function req(method,payload,origin=stagingOrigin){
 const input=Readable.from(payload==null?[]:[Buffer.from(JSON.stringify(payload))]);
 input.method=method;input.headers={'origin':origin,'content-type':'application/json'};input.socket={remoteAddress:'127.0.0.123'};return input;
}
function res(){return{status:0,body:null,writeHead(code,h){this.status=code},setHeader(){},end(data){this.body=data?JSON.parse(data):null}}}
function lab({operator=true,identity=true,origin=stagingOrigin}={}){
 const calls=[],auth=[];
 const accounts={isOperator:async()=>{auth.push('operator');return operator},
  checkoutIdentity:async()=>{auth.push('identity');return identity?{id:UID,accessToken:'test-token'}:null}};
 const handler=createPartnerFinanceLab({accounts,origin,enabled:true,
  url:'https://example.supabase.co',key:'test',
  fetchImpl:async(path,opts)=>{calls.push({path,opts});return{ok:true,json:async()=>({drafts:[],financials:{real_commission_events:0,real_payout_records:0}})}}});
 return{handler,calls,auth};
}
test('only named synthetic scenarios and valid draft UUIDs may be submitted',()=>{
 assert.deepEqual(validateReview({action:'prepare',scenario:'growth'}),{p_action:'prepare',p_draft:null,p_scenario:'growth'});
 assert.deepEqual(validateReview({action:'approve_first',draftId:UID}),{p_action:'approve_first',p_draft:UID,p_scenario:null});
 for(const invalid of [{action:'payout',draftId:UID},{action:'prepare',scenario:'fabricated'},{action:'prepare',scenario:'elite',amount:500000},{action:'approve_second',draftId:'bad'}])
 assert.throws(()=>validateReview(invalid));
});
test('configuration always reports live payment switches disabled',async()=>{
 const {handler}=lab(),out=res();
 await handler.handle(req('GET',null),out,new URL(stagingOrigin+'/api/partners/finance/config'));
 assert.equal(out.status,200);assert.equal(out.body.enabled,true);
 for(const key of ['realCommissionPostingEnabled','bankPayoutsEnabled','liveGatewayWebhookEnabled'])assert.equal(out.body[key],false);
});
test('no non-operator can simulate or reach a finance review',async()=>{
 const {handler,auth,calls}=lab({operator:false}),out=res();
 await handler.handle(req('POST',{scenario:'starter'}),out,new URL(stagingOrigin+'/api/partners/finance/simulate'));
 assert.equal(out.status,403);assert.equal(calls.length,0);assert.deepEqual(auth,['operator']);
});
test('cross-origin mutation is rejected before authentication',async()=>{
 const {handler,auth,calls}=lab(),out=res();
 await handler.handle(req('POST',{scenario:'starter'},'https://example.invalid'),out,new URL(stagingOrigin+'/api/partners/finance/simulate'));
 assert.equal(out.status,403);assert.equal(calls.length,0);assert.deepEqual(auth,[]);
});
test('simulation produces no payout and makes no remote finance write',async()=>{
 const {handler,calls}=lab(),out=res();
 await handler.handle(req('POST',{scenario:'elite'}),out,new URL(stagingOrigin+'/api/partners/finance/simulate'));
 assert.equal(out.status,200);assert.equal(out.body.tierPercent,30);assert.equal(out.body.mayPay,false);
 assert.equal(out.body.simulationOnly,true);assert.equal(calls.length,0);
});
test('no arbitrary amount, bank details, payment or illegal payout operation accepted',async()=>{
 const {handler,calls}=lab();
 for(const [action,payload] of [
  ['simulate',{scenario:'starter',amount:12345}],['simulate',{scenario:'growth',bank:'fake'}],
  ['review',{action:'payout',draftId:UID}] ]){const out=res();
    await handler.handle(req('POST',payload),out,new URL(stagingOrigin+'/api/partners/finance/'+action));
    assert.equal(out.status,400);
  }
 const out=res();await handler.handle(req('POST',{amount:10000}),out,new URL(stagingOrigin+'/api/partners/finance/payout'));
 assert.equal(out.status,404);assert.equal(calls.length,0);
});
test('read-only status forwards verified JWT to scoped operator RPC',async()=>{
 const {handler,calls,auth}=lab(),out=res();
 await handler.handle(req('GET',null),out,new URL(stagingOrigin+'/api/partners/finance/status'));
 assert.equal(out.status,200);assert.deepEqual(auth,['operator','identity']);assert.equal(calls.length,1);
 assert.match(calls[0].path,/rpc\/navigator_partner_finance_review$/);
 assert.equal(calls[0].opts.headers.Authorization,'Bearer test-token');
});
test('lab is fail-closed outside staging, even if environment switch enabled',async()=>{
 const {handler}=lab({origin:'https://production.example'});
 assert.equal(handler.configured(),false);
 const out=res();await handler.handle(req('GET',null),out,new URL(stagingOrigin+'/api/partners/finance/config'));
 assert.equal(out.status,200);assert.equal(out.body.enabled,false);
});
