"use strict";
const {clientNetwork}=require('./request-guards.cjs');

const {randomUUID,randomBytes,createHmac}=require('node:crypto');
const roles=['IC / LC member','Presiding Officer / Chairperson','HR / employer representative','External Member / adviser','Other organisational role'];
const plans=['unsure','essential','professional','advanced','institutional','enterprise','knowledge'];
const needs=['Core inquiry workflow and record organisation','Evidence-linked questions and report drafting','Complex proceedings and adaptive tools','Organisation-specific configuration and onboarding','Readiness and professional knowledge resources'];
const users=['Not yet decided','Up to 2','Up to 5','Up to 8','Up to 15','Contractual team size'];
function field(value,max,label,optional=false){if(typeof value!=='string'){if(optional&&value==null)return '';throw Error('Enter '+label+'.')}const text=value.normalize('NFKC').trim();if((!optional&&!text)||text.length>max||/[<>\u0000-\u001f\u007f]/.test(text))throw Error('Check '+label+'.');return text;}
function validateEnquiry(data){if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Check your request.');const allowed=['contact_name','email','organisation','role','plan','need','users','consent','website'];if(Object.keys(data).some(k=>!allowed.includes(k)))throw Error('Unexpected request fields.');if(data.website)throw Error('Request could not be accepted.');if(data.consent!==true)throw Error('Please agree to contact about this request.');const email=field(data.email,254,'your email').toLowerCase();if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw Error('Enter a valid email address.');if(!roles.includes(data.role)||!plans.includes(data.plan)||!needs.includes(data.need)||!users.includes(data.users))throw Error('Choose valid request options.');return {contact_name:field(data.contact_name,80,'your name'),email,organisation:field(data.organisation,100,'your organisation'),role:data.role,plan:data.plan,need:data.need,users:data.users,consent:true};}
function createEnquiryHandler({
 origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',
 privateToken=origin===require('./plan-store.cjs').stagingOrigin?process.env.NAVIGATOR_CHECKLIST_STORE_TOKEN:null,
 url=(privateToken&&process.env.NAVIGATOR_AUTH_URL)||process.env.ENQUIRY_SUPABASE_URL||process.env.COMMUNITY_SUPABASE_URL,
 key=(privateToken&&process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY)||process.env.ENQUIRY_SUPABASE_KEY||process.env.COMMUNITY_SUPABASE_KEY,
 fetchImpl=fetch,now=Date.now,onSaved=async()=>{},notify=async()=>{}
}={}){
 const privateRPC=/^[a-f0-9]{64}$/.test(privateToken||'');
 const salt=randomBytes(32),limits=new Map();let resetAt=now()+3600000,total=0;
 function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 function allowed(req){const time=now();if(time>=resetAt){limits.clear();total=0;resetAt=time+3600000;}if(++total>100)return false;const network=clientNetwork(req),hash=createHmac('sha256',salt).update(network).digest('hex');const count=(limits.get(hash)||0)+1;limits.set(hash,count);return count<=5;}
 return async(req,res,parsed)=>{if(!parsed.pathname.startsWith('/api/enquiries'))return false;try{
 if(parsed.pathname==='/api/enquiries/config'&&req.method==='GET'){send(res,200,{enabled:!!(url&&key),private:true});return true;}
 if(parsed.pathname!=='/api/enquiries'){send(res,404,{error:'Not found.'});return true;}
 if(req.method!=='POST'){send(res,405,{error:'Method not allowed.'});return true;}
 if(!url||!key){send(res,503,{error:'Requests are temporarily unavailable. Please try again later.'});return true;}
 if(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){send(res,403,{error:'Request not permitted.'});return true;}
 if(!allowed(req)){res.setHeader('Retry-After','3600');send(res,429,{error:'Request limit reached. Please try again later.'});return true;}
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4096){send(res,413,{error:'Request is too long.'});return true;}chunks.push(chunk);}
 let raw;try{raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{send(res,400,{error:'Check your request.'});return true;}
 let data;try{data=validateEnquiry(raw);}catch(e){send(res,400,{error:e.message});return true;}
 const id=randomUUID(),enquiry={id,...data};
 const resource=privateRPC?'rpc/navigator_save_sales_enquiry':'navigator_sales_enquiries';
 const response=await fetchImpl(url+'/rest/v1/'+resource,{
   method:'POST',headers:{apikey:key,'Content-Type':'application/json',Prefer:'return=minimal'},
   body:JSON.stringify(privateRPC?{p_token:privateToken,p_enquiry:enquiry}:enquiry),signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw Error('store_failed');try{await onSaved(req,data.plan)}catch{}if(!(privateRPC&&data.email.endsWith('.invalid'))){try{await notify(enquiry)}catch{}}send(res,201,{status:'received',receipt:id,message:'Your request has been received for private review.'});return true;
 }catch{send(res,503,{error:'We could not confirm your request. Your details remain in the form so you can try again.'});return true;}};
}
module.exports={createEnquiryHandler,validateEnquiry,roles,plans,needs,users};
