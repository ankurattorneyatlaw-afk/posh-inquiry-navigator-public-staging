'use strict';
/* Staging-only intake. Partner accounts, links, commission credits and payouts stay disabled until independently verified. */
const {randomUUID,randomBytes,createHmac}=require('node:crypto');
const {clientNetwork}=require('./request-guards.cjs');
const {stagingOrigin}=require('./plan-store.cjs');
const roles=['HR / compliance consultant','Corporate trainer / educator','Software and technology partner','Content creator / publisher','Business development professional','Other'];
const channels=['Professional network','Website or newsletter','Workshops or events','Business introductions','Other'];
const experiences=['Exploring','1–5 referrals / quarter','6–20 referrals / quarter','20+ referrals / quarter'];
function field(v,min,max,label,required=true){
 if(typeof v!=='string')throw Error('Check '+label+'.');
 const s=v.normalize('NFKC').trim();
 if(s.length<min||s.length>max||/[<>\u0000-\u001f\u007f]/.test(s)||(!required&&s&&s.length<min))throw Error('Check '+label+'.');
 return s;
}
function validate(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Check your application.');
 const keys=['contact_name','email','organisation','role','region','channel','experience','consent','independence_confirmed','website','challenge'];
 if(Object.keys(raw).some(x=>!keys.includes(x))||raw.website)throw Error('Application could not be accepted.');
 if(raw.consent!==true||raw.independence_confirmed!==true)throw Error('Please confirm the declarations.');
 if(!roles.includes(raw.role)||!channels.includes(raw.channel)||!experiences.includes(raw.experience))throw Error('Choose valid options.');
 const email=field(raw.email,5,254,'email').toLowerCase();
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw Error('Enter a valid email address.');
 return {contact_name:field(raw.contact_name,2,100,'name'),email,organisation:field(raw.organisation||'',0,120,'organisation',false),
 role:raw.role,region:field(raw.region,2,100,'city/state'),channel:raw.channel,experience:raw.experience,consent:true,independence_confirmed:true};
}
function createPartnerHandler({origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',
  enabled=process.env.PARTNER_APPLICATIONS_ENABLED==='true',
  token=process.env.NAVIGATOR_CHECKLIST_STORE_TOKEN,url=process.env.NAVIGATOR_AUTH_URL,
  key=process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,now=Date.now,fetchImpl=fetch}={}){
 const configured=()=>enabled&&origin===stagingOrigin&&/^[a-f0-9]{64}$/.test(token||'')&&/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')&&!!key;
 const secret=randomBytes(32),challenges=new Map(),counts=new Map();
 let global=0,resetAt=now()+3600000;
 const fingerprint=req=>createHmac('sha256',secret).update(clientNetwork(req)).digest('hex');
 const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 function limit(fingerprint){
  if(now()>=resetAt){resetAt=now()+3600000;global=0;counts.clear();challenges.clear()}
  if(++global>100)return true;
  const n=(counts.get(fingerprint)||0)+1;counts.set(fingerprint,n);
  return n>3;
 }
 return {configured,async handle(req,res,parsed){
  if(!parsed.pathname.startsWith('/api/partners/'))return false;
  if(parsed.pathname==='/api/partners/config'&&req.method==='GET'){
   if(!configured()){reply(res,200,{enabled:false});return true}
   const challenge=randomBytes(18).toString('hex');
   const f=fingerprint(req);challenges.set(challenge,{at:now(),network:f});
   if(challenges.size>2000)for(const [n,v] of challenges){if(now()-v.at>1200000)challenges.delete(n)}
   reply(res,200,{enabled:true,challenge});return true;
  }
  if(parsed.pathname!=='/api/partners/apply'){reply(res,404,{error:'Not found'});return true}
  if(req.method!=='POST'){reply(res,405,{error:'Method not allowed'});return true}
  if(!configured()){reply(res,503,{error:'Applications are not currently open. Please contact the team.'});return true}
  if(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){
   reply(res,403,{error:'Request not permitted'});return true
  }
  let len=0,chunks=[];for await(const chunk of req){len+=chunk.length;if(len>2500){reply(res,413,{error:'Request too long'});return true}chunks.push(chunk)}
  let raw,data;try{raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));data=validate(raw)}catch(e){reply(res,400,{error:e.message||'Check your application'});return true}
  const f=fingerprint(req),chall=challenges.get(raw.challenge);
  if(!chall||chall.network!==f||now()-chall.at<2500||now()-chall.at>1200000){reply(res,400,{error:'Your form has expired or was submitted too quickly. Refresh and try again.'});return true}
  if(limit(f)){res.setHeader('Retry-After','3600');reply(res,429,{error:'Too many applications from this connection. Try again later.'});return true}
  challenges.delete(raw.challenge);
  const id=randomUUID();
  try{
   const response=await fetchImpl(url+'/rest/v1/rpc/navigator_save_partner_application',{
    method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
    body:JSON.stringify({p_token:token,p_application:{id,...data}}),signal:AbortSignal.timeout(7000)
   });
   if(!response.ok)throw Error('Storage unavailable');
   reply(res,201,{status:'submitted',reference:id,message:'Your expression of interest has been received for manual review. No referral code or commission entitlement is active yet.'});
  }catch{reply(res,503,{error:'We could not confirm receipt. Please try later or contact the team.'})}
  return true;
 }};
}
module.exports={createPartnerHandler,validate,roles,channels,experiences};
