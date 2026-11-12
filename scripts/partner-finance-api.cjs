'use strict';
const {createHmac,randomBytes}=require('node:crypto');
const {clientNetwork}=require('./request-guards.cjs');
const {stagingOrigin}=require('./plan-store.cjs');
const F=require('./partner-finance.cjs');
const isUuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
function validateReview(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['action','draftId','scenario'].includes(k)))throw Error('Invalid review');
 if(raw.action==='prepare'){
  if(!Object.hasOwn(F.scenarios,raw.scenario)||raw.draftId!==undefined)throw Error('Invalid finance scenario');
  return {p_action:'prepare',p_draft:null,p_scenario:raw.scenario};
 }
 if(!['approve_first','approve_second','reject'].includes(raw.action)||!isUuid(raw.draftId)||raw.scenario!==undefined)throw Error('Invalid review');
 return {p_action:raw.action,p_draft:raw.draftId,p_scenario:null};
}
function createPartnerFinanceLab({accounts,origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',
 enabled=process.env.PARTNER_FINANCE_SANDBOX_ENABLED==='true',url=process.env.NAVIGATOR_AUTH_URL,key=process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,
 fetchImpl=fetch,now=Date.now}={}){
 if(!accounts||typeof accounts.isOperator!=='function'||typeof accounts.checkoutIdentity!=='function')throw Error('Account access must be connected');
 const configured=()=>enabled&&origin===stagingOrigin&&/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')&&!!key;
 const secret=randomBytes(32),hits=new Map();let until=now()+3600000,total=0;
 function limit(req){if(now()>=until){hits.clear();total=0;until=now()+3600000}if(++total>500)return true;const hash=createHmac('sha256',secret).update(clientNetwork(req)).digest('hex');const n=(hits.get(hash)||0)+1;hits.set(hash,n);return n>25}
 const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 async function rpc(identity,args){const r=await fetchImpl(url+'/rest/v1/rpc/navigator_partner_finance_review',{
  method:'POST',headers:{apikey:key,Authorization:'Bearer '+identity.accessToken,'Content-Type':'application/json'},
  body:JSON.stringify(args),signal:AbortSignal.timeout(7000)});
  if(!r.ok)throw Object.assign(Error('Finance review database unavailable'),{status:[401,403].includes(r.status)?403:503});
  return await r.json();
 }
 return {configured,async handle(req,res,parsed){
  if(!parsed.pathname.startsWith('/api/partners/finance/'))return false;
  const action=parsed.pathname.slice('/api/partners/finance/'.length);
  if(action==='config'&&req.method==='GET'){
   reply(res,200,{enabled:configured(),simulationOnly:true,realCommissionPostingEnabled:false,bankPayoutsEnabled:false,liveGatewayWebhookEnabled:false});return true;
  }
  if(!['status','simulate','review'].includes(action)){reply(res,404,{error:'Unknown finance control'});return true;}
  if(!configured()){reply(res,503,{error:'Finance controls are not enabled on this staging service'});return true;}
  if((action==='status'&&req.method!=='GET')||(action!=='status'&&req.method!=='POST')){reply(res,405,{error:'Incorrect method'});return true;}
  if(action!=='status'&&(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))){
   reply(res,403,{error:'Request not permitted'});return true;
  }
  if(limit(req)){res.setHeader('Retry-After','3600');reply(res,429,{error:'Too many finance review requests'});return true;}
  let operator,identity;try{[operator,identity]=await Promise.all([accounts.isOperator(req,res),accounts.checkoutIdentity(req,res)])}
  catch{reply(res,503,{error:'Operator identity could not be verified'});return true}
  if(!identity?.accessToken||!identity.id||!operator){reply(res,403,{error:'Verified administrator session required'});return true;}
  let payload={};if(action!=='status'){
   let size=0,chunks=[];
   for await(const buf of req){size+=buf.length;if(size>512){reply(res,413,{error:'Request too large'});return true}chunks.push(buf)}
   try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{reply(res,400,{error:'Invalid request body'});return true}
  }
  if(action==='simulate'){
   if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length!==1||!Object.hasOwn(F.scenarios,payload.scenario)){
    reply(res,400,{error:'Only enumerated synthetic scenarios may be submitted'});return true;}
   reply(res,200,F.demo(payload.scenario));return true;
  }
  try{
   const args=action==='status'?{p_action:'list',p_draft:null,p_scenario:null}:validateReview(payload);
   const saved=await rpc(identity,args);
   reply(res,200,saved);return true;
  }catch(error){reply(res,error.status||400,{error:error.message||'Unable to review simulation'});return true}
 }};
}
module.exports={createPartnerFinanceLab,validateReview};
