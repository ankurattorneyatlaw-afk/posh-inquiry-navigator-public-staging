'use strict';
/* Verified-session staging referral pilot. No financial activation or payout endpoints. */
const {createHmac,randomBytes}=require('node:crypto');
const {clientNetwork}=require('./request-guards.cjs');
const {stagingOrigin}=require('./plan-store.cjs');

const ACTIONS=new Set(['list','mark_reviewing','pilot_issue','pilot_pause','pilot_resume','decline']);
const validUuid=x=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
function validateClaim(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(x=>!['code','confirmed'].includes(x)))
   throw Error('Invalid claim');
 const code=typeof raw.code==='string'?raw.code.trim().toUpperCase():'';
 if(!/^NAV[0-9A-F]{9}$/.test(code)||raw.confirmed!==true)throw Error('Enter a valid pilot code and confirm your choice.');
 return {p_code:code,p_confirmed:true};
}
function validateAdmin(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(x=>!['action','applicationId'].includes(x))||!ACTIONS.has(raw.action))
   throw Error('Invalid administrative action');
 if(raw.action!=='list'&&!validUuid(raw.applicationId))throw Error('Invalid application reference');
 return {p_action:raw.action,p_application_id:raw.action==='list'?null:raw.applicationId};
}
function createPartnerPilot({
 accounts,origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',
 enabled=process.env.PARTNER_REFERRAL_PILOT_ENABLED==='true',
 url=process.env.NAVIGATOR_AUTH_URL,key=process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,
 now=Date.now,fetchImpl=fetch}={}){
 if(!accounts||typeof accounts.checkoutIdentity!=='function'||typeof accounts.isOperator!=='function')throw Error('Authenticated account access required');
 const configured=()=>enabled&&origin===stagingOrigin&&/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')&&!!key;
 const salt=randomBytes(32),counts=new Map();let windowStart=now(),total=0;
 const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))};
 const throttled=req=>{if(now()-windowStart>=3600000){windowStart=now();counts.clear();total=0}if(++total>1000)return true;const network=createHmac('sha256',salt).update(clientNetwork(req)).digest('hex'),count=(counts.get(network)||0)+1;counts.set(network,count);return count>20};
 async function rpc(identity,name,body){
  const r=await fetchImpl(url+'/rest/v1/rpc/'+name,{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+identity.accessToken,'Content-Type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(7000)});
  if(!r.ok){if(r.status===403||r.status===401)throw Object.assign(Error('Not permitted'),{status:403});throw Error('Referral store unavailable')}
  return r.json();
 }
 return {configured,async handle(req,res,parsed){
  if(!parsed.pathname.startsWith('/api/partners/pilot/'))return false;
  const name=parsed.pathname.slice('/api/partners/pilot/'.length);
  if(name==='config'&&req.method==='GET'){json(res,200,{pilotEnabled:configured(),realCommissionsEnabled:false,bankPayoutsEnabled:false});return true}
  if(!configured()){json(res,503,{error:'Referral pilot unavailable'});return true}
  if(!['status','claim','admin'].includes(name)){json(res,404,{error:'Unknown referral action'});return true}
  if((name==='status'&&req.method!=='GET')||(name!=='status'&&req.method!=='POST')){json(res,405,{error:'Incorrect method'});return true}
  if(name!=='status'&&(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))){
   json(res,403,{error:'Not permitted'});return true;
  }
  if(throttled(req)){res.setHeader('Retry-After','3600');json(res,429,{error:'Referral request limit reached'});return true}
  let identity;try{identity=await accounts.checkoutIdentity(req,res)}catch{json(res,503,{error:'Account verification unavailable'});return true}
  if(!identity?.id||!identity.accessToken){json(res,401,{error:'Sign in with a verified account to continue'});return true}
  if(name==='admin'&&!await accounts.isOperator(req,res)){json(res,403,{error:'Operator access required'});return true}
  let payload={};
  if(name!=='status'){
   let n=0,chunks=[];
   for await(const b of req){n+=b.length;if(n>512){json(res,413,{error:'Request too long'});return true}chunks.push(b)}
   try{const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));payload=name==='claim'?validateClaim(raw):validateAdmin(raw)}
   catch(e){json(res,400,{error:e.message||'Invalid request'});return true}
  }
  try{
   const result=await rpc(identity,name==='status'?'navigator_partner_pilot_my_status':name==='claim'?'navigator_partner_pilot_claim':'navigator_partner_pilot_admin',payload);
   json(res,200,result);return true;
  }catch(e){json(res,e.status||503,{error:e.status===403?'Not permitted':'Pilot service temporarily unavailable'});return true}
 }};
}
module.exports={createPartnerPilot,validateClaim,validateAdmin};
