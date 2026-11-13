'use strict';
/* Staging-only onboarding readiness attestations. Never accepts KYC files, identifiers, bank details or money. */
const {randomBytes,createHmac}=require('node:crypto');
const {clientNetwork}=require('./request-guards.cjs');
const {stagingOrigin}=require('./plan-store.cjs');
const GATES=Object.freeze(['agreement','identity_kyc','tax_gst','bank_ownership','invoice','marketing_ethics','conflicts']);
const OPS=Object.freeze(['list','first_review','second_review','reject']);
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function validate(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(x=>!['action','partnerId','gate','acknowledged'].includes(x)))throw Error('Invalid onboarding action');
 if(!OPS.includes(raw.action))throw Error('Unsupported onboarding action');
 if(raw.action==='list'){
  if(Object.keys(raw).length!==1)throw Error('Only listing requested');
  return {p_action:'list',p_partner_id:null,p_gate:null,p_acknowledged:false};
 }
 if(Object.keys(raw).length!==4||!UUID.test(raw.partnerId||'')||!GATES.includes(raw.gate)||raw.acknowledged!==true)
  throw Error('Choose a valid partner, check and acknowledgment');
 return {p_action:raw.action,p_partner_id:raw.partnerId,p_gate:raw.gate,p_acknowledged:true};
}
function createPartnerOnboarding({
 accounts,origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',
 enabled=process.env.PARTNER_ONBOARDING_STAGING_ENABLED==='true',
 url=process.env.NAVIGATOR_AUTH_URL,key=process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,
 fetchImpl=fetch,now=Date.now
}={}){
 if(!accounts||typeof accounts.checkoutIdentity!=='function'||typeof accounts.isOperator!=='function')throw Error('Account verification required');
 const configured=()=>enabled&&origin===stagingOrigin&&/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')&&!!key;
 const secret=randomBytes(32),counts=new Map();let until=now()+3600000,total=0;
 const reply=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
 const limited=req=>{
  if(now()>=until){until=now()+3600000;counts.clear();total=0}
  if(++total>600)return true;
  const n=createHmac('sha256',secret).update(clientNetwork(req)).digest('hex');
  const i=(counts.get(n)||0)+1;counts.set(n,i);return i>25;
 };
 async function rpc(identity,name,body){
  const resp=await fetchImpl(url+'/rest/v1/rpc/'+name,{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+identity.accessToken,'Content-Type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(7000)
  });
  if(!resp.ok)throw Object.assign(Error('Onboarding review not available'),{status:[401,403].includes(resp.status)?403:503});
  return resp.json();
 }
 return {configured,async handle(req,res,parsed){
  if(!parsed.pathname.startsWith('/api/partners/onboarding/'))return false;
  const route=parsed.pathname.slice('/api/partners/onboarding/'.length);
  if(route==='config'&&req.method==='GET'){
   reply(res,200,{enabled:configured(),stagingOnly:true,sensitiveDocumentUploadEnabled:false,realActivationEnabled:false,bankPayoutEnabled:false});return true;
  }
  if(!['status','admin'].includes(route)){reply(res,404,{error:'Onboarding route unavailable'});return true}
  if(!configured()){reply(res,503,{error:'Onboarding readiness is not enabled'});return true}
  if((route==='status'&&req.method!=='GET')||(route==='admin'&&req.method!=='POST')){
   reply(res,405,{error:'Method not allowed'});return true;
  }
  if(route==='admin'&&(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))){
   reply(res,403,{error:'Not permitted'});return true;
  }
  if(limited(req)){res.setHeader('Retry-After','3600');reply(res,429,{error:'Review request rate limit'});return true}
  let identity,operator=false;
  try{
   if(route==='admin'){operator=await accounts.isOperator(req,res);if(!operator){reply(res,403,{error:'Operator access required'});return true}}
   identity=await accounts.checkoutIdentity(req,res);
  }catch{reply(res,503,{error:'Verified sign-in unavailable'});return true}
  if(!identity?.id||!identity.accessToken){reply(res,route==='admin'?403:401,{error:'Verified account sign-in required'});return true}
  let body={};
  if(route==='admin'){
   let size=0,chunks=[];
   for await(const part of req){
    size+=part.length;if(size>512){reply(res,413,{error:'Request too large'});return true}chunks.push(part)
   }
   try{body=validate(JSON.parse(Buffer.concat(chunks).toString('utf8')))}
   catch(e){reply(res,400,{error:e.message});return true}
  }
  try{
   const result=await rpc(identity,route==='admin'?'navigator_partner_onboarding_admin':'navigator_partner_onboarding_my_status',body);
   reply(res,200,result);return true;
  }catch(e){reply(res,e.status||503,{error:e.status===403?'Not permitted':'Review database unavailable'});return true}
 }};
}
module.exports={createPartnerOnboarding,validate,GATES};
