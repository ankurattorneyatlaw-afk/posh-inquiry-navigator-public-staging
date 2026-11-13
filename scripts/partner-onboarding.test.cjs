'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream');
const {createPartnerOnboarding,validate,GATES}=require('./partner-onboarding.cjs');
const {stagingOrigin}=require('./plan-store.cjs');
const UID='11111111-2222-3333-4444-555555555555';
function req(method,data,origin=stagingOrigin){
 const r=Readable.from(data===null?[]:[Buffer.from(JSON.stringify(data))]);
 r.method=method;r.headers={origin,'content-type':'application/json'};r.socket={remoteAddress:'127.0.0.123'};return r;
}
function res(){return {status:0,body:null,writeHead(status){this.status=status},setHeader(){},end(data){this.body=data?JSON.parse(data):null}}}
function make({operator=true,identity=true,origin=stagingOrigin,enabled=true}={}){
 const calls=[],auth=[];
 const accounts={
  isOperator:async()=>{auth.push('operator');return operator},
  checkoutIdentity:async()=>{auth.push('identity');return identity?{id:UID,accessToken:'jwt-test-operator'}:null}
 };
 const tracker=createPartnerOnboarding({accounts,origin,enabled,url:'https://example.supabase.co',key:'publishable-key',
  fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({partnerFound:false,partners:[],gates:[]})}}});
 return {tracker,calls,auth};
}
test('seven separate control categories are defined, none can authorise payment',()=>{
 assert.deepEqual(GATES,['agreement','identity_kyc','tax_gst','bank_ownership','invoice','marketing_ethics','conflicts']);
});
test('only finite staging attestations can be submitted',()=>{
 assert.deepEqual(validate({action:'first_review',partnerId:UID,gate:'agreement',acknowledged:true}),
 {p_action:'first_review',p_partner_id:UID,p_gate:'agreement',p_acknowledged:true});
 assert.deepEqual(validate({action:'list'}),{p_action:'list',p_partner_id:null,p_gate:null,p_acknowledged:false});
 for(const bad of [
  {action:'activate',partnerId:UID,gate:'agreement',acknowledged:true},
  {action:'second_review',partnerId:UID,gate:'bank_number',acknowledged:true},
  {action:'first_review',partnerId:'123',gate:'agreement',acknowledged:true},
  {action:'first_review',partnerId:UID,gate:'agreement',acknowledged:false},
  {action:'first_review',partnerId:UID,gate:'agreement',acknowledged:true,pan:'ABCDE1234F'},
  {action:'list',bankAccount:'private'},
 ])assert.throws(()=>validate(bad));
});
test('public config never asserts KYC-upload, real activation or bank transfer',async()=>{
 const {tracker}=make();const response=res();
 await tracker.handle(req('GET',null),response,new URL(stagingOrigin+'/api/partners/onboarding/config'));
 assert.equal(response.status,200);
 for(const key of ['sensitiveDocumentUploadEnabled','realActivationEnabled','bankPayoutEnabled'])assert.equal(response.body[key],false);
});
test('unverified user never reads partner status',async()=>{
 const {tracker,calls}=make({identity:false});const response=res();
 await tracker.handle(req('GET',null),response,new URL(stagingOrigin+'/api/partners/onboarding/status'));
 assert.equal(response.status,401);assert.equal(calls.length,0);
});
test('nonoperator never reads administrator queue',async()=>{
 const {tracker,calls,auth}=make({operator:false});const response=res();
 await tracker.handle(req('POST',{action:'list'}),response,new URL(stagingOrigin+'/api/partners/onboarding/admin'));
 assert.equal(response.status,403);assert.deepEqual(auth,['operator']);assert.equal(calls.length,0);
});
test('cross-origin admin mutation is rejected before operator check',async()=>{
 const {tracker,calls,auth}=make();const response=res();
 await tracker.handle(req('POST',{action:'first_review',partnerId:UID,gate:'tax_gst',acknowledged:true},'https://malicious.invalid'),response,new URL(stagingOrigin+'/api/partners/onboarding/admin'));
 assert.equal(response.status,403);assert.deepEqual(auth,[]);assert.equal(calls.length,0);
});
test('verified operator review forwards JWT and only an allowlisted action',async()=>{
 const {tracker,calls,auth}=make();const response=res();
 await tracker.handle(req('POST',{action:'second_review',partnerId:UID,gate:'bank_ownership',acknowledged:true}),response,new URL(stagingOrigin+'/api/partners/onboarding/admin'));
 assert.equal(response.status,200);assert.deepEqual(auth,['operator','identity']);assert.equal(calls.length,1);
 assert.match(calls[0].url,/rpc\/navigator_partner_onboarding_admin$/);
 assert.equal(calls[0].options.headers.Authorization,'Bearer jwt-test-operator');
 assert.deepEqual(JSON.parse(calls[0].options.body),{
  p_action:'second_review',p_partner_id:UID,p_gate:'bank_ownership',p_acknowledged:true
 });
});
test('signed-in partner cannot select someone else to inspect',async()=>{
 const {tracker,calls}=make();const response=res();
 await tracker.handle(req('GET',null),response,new URL(stagingOrigin+'/api/partners/onboarding/status'));
 assert.equal(response.status,200);assert.equal(calls.length,1);
 assert.match(calls[0].url,/rpc\/navigator_partner_onboarding_my_status$/);
 assert.deepEqual(JSON.parse(calls[0].options.body),{});
});
test('unapproved payout, activate and KYC-upload endpoints do not exist',async()=>{
 const {tracker,calls}=make();const response=res();
 await tracker.handle(req('POST',{bankAccount:'test'}),response,new URL(stagingOrigin+'/api/partners/onboarding/pay'));
 assert.equal(response.status,404);assert.equal(calls.length,0);
});
test('onboarding module is disabled outside staging even if environment flag true',()=>{
 const {tracker}=make({origin:'https://production.example'});assert.equal(tracker.configured(),false);
});
