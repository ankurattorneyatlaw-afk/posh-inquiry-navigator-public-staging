'use strict';
// Account and licence data only. This module has no case-data endpoint.
const crypto=require('node:crypto'),{clientNetwork}=require('./request-guards.cjs');
const {tiers}=require('./plan-tools.cjs');
const {checkoutPlans}=require('../dist/plans.js');
const dateInIndia=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kolkata'});
const midnightIndia='T00:00:00+05:30';

function planExpiry(startDate,months){
 const date=new Date(startDate+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==startDate)return null;
 const day=date.getUTCDate();
 date.setUTCDate(1);
 date.setUTCMonth(date.getUTCMonth()+months);
 const lastDay=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
 date.setUTCDate(Math.min(day,lastDay));
 return date.toISOString().slice(0,10);
}
const PLANS=new Set(['essential','professional','advanced','institutional','enterprise','knowledge']);
const PROTECTED=new Set(['guided.html','workspace.html','admin.html','guided.js','guided-continuation.js','workflow-documents.js','timeline.js','timeline-ui.js','session-experience.js','session-review.js','evidence.js','evidence-ui.js']);
function seal(value,key){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(JSON.stringify(value)),cipher.final(),cipher.getAuthTag()]).toString('base64url');}
function unseal(value,key){try{const b=Buffer.from(value,'base64url');if(b.length<29||b.length>4096)return null;const cipher=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));cipher.setAuthTag(b.subarray(-16));return JSON.parse(Buffer.concat([cipher.update(b.subarray(12,-16)),cipher.final()]));}catch{return null}}
function createAccountAccess({url=process.env.NAVIGATOR_AUTH_URL,key=process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,cookieKey=process.env.NAVIGATOR_SESSION_KEY,enabled=process.env.NAVIGATOR_ACCOUNT_ACCESS_ENABLED==='true',origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',fetchImpl=fetch,now=Date.now}={}){
 const secret=typeof cookieKey==='string'&&/^[a-f0-9]{64}$/i.test(cookieKey)?Buffer.from(cookieKey,'hex'):null;
 const configured=!!(secret&&url&&/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)&&key),secure=origin.startsWith('https:'),name=secure?'__Host-navigator':'navigator-local';
 const otpLimits=new Map();
 const limits=new Map(),salt=crypto.randomBytes(32);let until=now()+900000,total=0;
 function limited(req,admin=false){if(now()>=until){until=now()+900000;total=0;limits.clear();otpLimits.clear()}if(++total>500)return true;const id=crypto.createHmac('sha256',salt).update((admin?'admin:':'auth:')+clientNetwork(req)).digest('hex'),n=(limits.get(id)||0)+1;limits.set(id,n);return n>(admin?100:15)}
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Cookie'});res.end(JSON.stringify(data))};
 function cookie(res,value,max=28800,cookieName=name){const line=`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${max}${secure?'; Secure':''}`;const existing=res.getHeader?.('Set-Cookie');res.setHeader('Set-Cookie',existing?[].concat(existing,line):line)}
 function readCookie(req,cookieName){const raw=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='));return raw&&secret?unseal(raw.slice(cookieName.length+1),secret):null}
 function emailValid(value){return typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}
 function otpLimit(email){const id=crypto.createHmac('sha256',salt).update(email).digest('hex');let entry=otpLimits.get(id);if(!entry||entry.until<=now()){entry={until:now()+900000,sent:0,attempts:0};otpLimits.set(id,entry)}return entry}
 async function remote(path,{token,method='GET',body}={}){const r=await fetchImpl(url+path,{method,headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});if(!r.ok){let problem={};try{problem=await r.json()}catch{}throw Object.assign(Error('Account service unavailable or credentials invalid'),{status:r.status,code:problem.code||problem.error_code})}return r.status===204?{}:r.json()}
 // UI challenge hint only: provider user validation and RPC guards remain authoritative.
 function verifiedSignInHint(s){try{const claims=JSON.parse(Buffer.from(s.access.split('.')[1]||'','base64url').toString('utf8'));return claims.aal==='aal2'||Array.isArray(claims.amr)&&claims.amr.some(x=>x?.method==='otp');}catch{return false}}
 function read(req){const raw=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));const s=raw&&secret?unseal(raw.slice(name.length+1),secret):null;return s&&typeof s.access==='string'&&typeof s.refresh==='string'&&Number.isFinite(s.started)&&Number.isFinite(s.seen)&&s.started<=now()&&s.seen<=now()&&now()-s.started<28800000&&now()-s.seen<1800000?s:null}
 function write(res,s){const value=seal({...s,seen:now()},secret);if(value.length>3800)throw Error('Session too large');cookie(res,value)}
 async function session(req,res){if(!enabled||!configured)return null;let s=read(req);if(!s)return null;try{if(s.expires<now()+60000){const r=await remote('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refresh}});s={...s,access:r.access_token,refresh:r.refresh_token,expires:now()+r.expires_in*1000}}const user=await remote('/auth/v1/user',{token:s.access});if(!user.id||user.is_anonymous||!user.email_confirmed_at)throw Error('Verified account required');write(res,s);return{s,user}}catch(error){if([401,403].includes(error.status)){cookie(res,'',0);return null}throw Object.assign(Error('Account provider temporarily unavailable'),{status:503})}}
 async function rights(s){const r=await remote('/rest/v1/rpc/navigator_my_access',{method:'POST',token:s.access,body:{}});if(!Array.isArray(r))throw Error('Invalid access response');return r.filter(x=>PLANS.has(x.plan)&&x.status==='active'&&Date.parse(x.starts_at)<=now()&&Date.parse(x.ends_at)>now()).map(x=>({plan:x.plan,starts_at:x.starts_at,ends_at:x.ends_at,guided:x.plan!=='knowledge'}))}
 async function body(req){let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>4096)throw Object.assign(Error('Request too large'),{status:413});chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw Object.assign(Error('Invalid account request'),{status:400})}}
 async function handle(req,res,parsed){if(!parsed.pathname.startsWith('/api/account/'))return false;try{
 if(parsed.pathname==='/api/account/config'&&req.method==='GET'){send(res,200,{enabled,configured,caseStorage:false,paymentsAutomated:false,emailOtp:true});return true}
 if(!enabled||!configured){send(res,503,{error:'Account access is not configured. Public guidance remains available.'});return true}
 if(req.method==='GET'&&parsed.pathname==='/api/account/session'){const current=await session(req,res);if(!current){send(res,200,{signedIn:false});return true}const [access,operator]=await Promise.all([rights(current.s),remote('/rest/v1/rpc/navigator_is_operator',{method:'POST',token:current.s.access,body:{}})]);send(res,200,{signedIn:true,operator:operator===true,accountId:current.user.id,email:current.user.email,access,mfaRequired:operator!==true&&!access.length&&!verifiedSignInHint(current.s)&&(current.user.factors||[]).some(f=>f.status==='verified'),factors:(current.user.factors||[]).filter(f=>f.factor_type==='totp'&&f.status==='verified').map(f=>({id:f.id})),caseStorage:false});return true}
 if(req.method!=='POST'){send(res,405,{error:'Method not allowed'});return true}
 if(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){send(res,403,{error:'Use the account page to continue.'});return true}
 if(limited(req,parsed.pathname.startsWith('/api/account/admin/'))){res.setHeader('Retry-After','900');send(res,429,{error:'Too many account requests. Please wait fifteen minutes.'});return true}
 const data=await body(req);if(!data||Array.isArray(data)||Object.keys(data).some(k=>!['email','password','factorId','code','accountId','plan','startsAt','endsAt','verificationReference','accessId'].includes(k))){send(res,400,{error:'Only account credentials are accepted. Never submit case information.'});return true}
 if(parsed.pathname==='/api/account/otp/request'){
 if(Object.keys(data).some(k=>k!=='email')||!emailValid(data.email)){send(res,400,{error:'Enter your account email.'});return true}
 const email=data.email.trim().toLowerCase(),limit=otpLimit(email);
 if(limit.attempts>=5||limit.sent&&now()-limit.sent<60000){res.setHeader('Retry-After',String(limit.attempts>=5?900:60));send(res,429,{error:'Please wait before requesting another code.'});return true}
 limit.sent=now();
 try{await remote('/auth/v1/otp',{method:'POST',body:{email,create_user:false}})}catch(error){if(!['user_not_found','signup_disabled'].includes(error.code)){send(res,error.status===429?429:503,{error:'Email delivery is temporarily unavailable or its sending limit was reached. Please try later or contact account support.'});return true}}
 cookie(res,seal({email,created:now(),id:crypto.randomUUID()},secret),600,name+'-otp');
 send(res,200,{pending:true,message:'If this email has an account, a sign-in code has been requested. Check your inbox and spam folder. Use the newest code within ten minutes.',retryAfter:60});return true}
 if(parsed.pathname==='/api/account/otp/verify'){
 if(Object.keys(data).some(k=>k!=='code')||typeof data.code!=='string'||!/^\d{6}$/.test(data.code)){send(res,400,{error:'Enter the six-digit code from your email.'});return true}
 const pending=readCookie(req,name+'-otp');
 if(!pending||!emailValid(pending.email)||!Number.isFinite(pending.created)||pending.created>now()||now()-pending.created>=600000){cookie(res,'',0,name+'-otp');send(res,401,{error:'Request a new email code in this browser.'});return true}
 const limit=otpLimit(pending.email);if(++limit.attempts>5){cookie(res,'',0,name+'-otp');send(res,429,{error:'Too many code attempts. Please wait fifteen minutes and request a new code.'});return true}
 let r;try{r=await remote('/auth/v1/verify',{method:'POST',body:{email:pending.email,token:data.code,type:'email'}})}catch(error){send(res,[400,401,403,422].includes(error.status)?401:503,{error:[400,401,403,422].includes(error.status)?'The email code is invalid, expired or already used. Try the newest code or request another.':'Email verification is temporarily unavailable. Please try again.'});return true}
 if(!r.user?.email_confirmed_at||r.user.is_anonymous||r.user.email?.toLowerCase()!==pending.email||!r.access_token||!r.refresh_token)throw Error('Verified account required');
 write(res,{access:r.access_token,refresh:r.refresh_token,expires:now()+r.expires_in*1000,started:now(),seen:now()});cookie(res,'',0,name+'-otp');send(res,200,{signedIn:true});return true}
 if(parsed.pathname==='/api/account/login'){if(typeof data.email!=='string'||data.email.length>254||!/^\S+@\S+\.\S+$/.test(data.email)||typeof data.password!=='string'||data.password.length>256){send(res,400,{error:'Enter your account email and password.'});return true}let r;try{r=await remote('/auth/v1/token?grant_type=password',{method:'POST',body:{email:data.email.trim(),password:data.password}})}catch{send(res,401,{error:'Sign-in could not be completed. Check your credentials or request account support.'});return true}if(!r.user?.email_confirmed_at||r.user.is_anonymous)throw Error('Verified account required');write(res,{access:r.access_token,refresh:r.refresh_token,expires:now()+r.expires_in*1000,started:now(),seen:now()});send(res,200,{signedIn:true});return true}
 if(parsed.pathname==='/api/account/logout'){const local=read(req);cookie(res,'',0);cookie(res,'',0,name+'-otp');if(local){try{await remote('/auth/v1/logout?scope=local',{method:'POST',token:local.access})}catch{send(res,503,{error:'Browser signed out; server revocation could not be confirmed. Use account support to revoke all sessions.'});return true}}send(res,200,{signedIn:false});return true}
 const current=await session(req,res);if(!current){send(res,401,{error:'Sign in again. Session inputs have not been uploaded.'});return true}
 if(parsed.pathname.startsWith('/api/account/admin/')){const uid=v=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v||'');if(!await remote('/rest/v1/rpc/navigator_is_operator',{method:'POST',token:current.s.access,body:{}})){send(res,403,{error:'Plan administrator access is required.'});return true}let result;
 if(parsed.pathname==='/api/account/admin/lookup'){
  const email=typeof data.email==='string'?data.email.trim():'';
  if(!emailValid(email)){send(res,400,{error:'Enter the customer’s account email.'});return true;}
  result=await remote('/rest/v1/rpc/navigator_admin_account',{method:'POST',token:current.s.access,body:{p_email:email}});
  const startsOn=dateInIndia.format(new Date(now()));
  const planDates=Object.fromEntries(Object.entries(checkoutPlans).map(([plan,{months}])=>[plan,{startsOn,endsOn:planExpiry(startsOn,months),months}]));
  send(res,200,{result,planDates});return true;
 }
 else if(parsed.pathname==='/api/account/admin/access'){if(!uid(data.accountId))throw Error('Invalid account');result=await remote('/rest/v1/rpc/navigator_admin_access',{method:'POST',token:current.s.access,body:{p_user:data.accountId}})}
 else if(parsed.pathname==='/api/account/admin/grant'){
  if(!uid(data.accountId)||!uid(data.verificationReference)||!PLANS.has(data.plan)){
   send(res,400,{error:'Find a confirmed account and select a valid plan.'});return true;
  }
  const standard=Object.hasOwn(checkoutPlans,data.plan)?checkoutPlans[data.plan]:null;
  let endsAt=data.endsAt;
  if(standard){
   const startDate=typeof data.startsAt==='string'&&data.startsAt.endsWith(midnightIndia)?data.startsAt.slice(0,10):'';
   const endsOn=data.startsAt===startDate+midnightIndia&&planExpiry(startDate,standard.months);
   endsAt=endsOn?endsOn+midnightIndia:null;
  }
  if(!Number.isFinite(Date.parse(data.startsAt))||!Number.isFinite(Date.parse(endsAt))||Date.parse(endsAt)<=Date.parse(data.startsAt)){
   send(res,400,{error:'Check the plan dates. Access must end after it starts.'});return true;
  }
  result=await remote('/rest/v1/rpc/navigator_admin_grant',{method:'POST',token:current.s.access,body:{p_user:data.accountId,p_plan:data.plan,p_starts:data.startsAt,p_ends:endsAt,p_reference:data.verificationReference}});
 }
 else if(parsed.pathname==='/api/account/admin/revoke'){if(!uid(data.accessId))throw Error('Invalid access');result=await remote('/rest/v1/rpc/navigator_admin_revoke',{method:'POST',token:current.s.access,body:{p_access:data.accessId}})}else{send(res,404,{error:'Unknown administration action'});return true}send(res,200,{result});return true}

 if(parsed.pathname==='/api/account/mfa/enrol'){const r=await remote('/auth/v1/factors',{method:'POST',token:current.s.access,body:{factor_type:'totp',friendly_name:'Navigator authenticator'}});send(res,200,{factorId:r.id,secret:r.totp?.secret,uri:r.totp?.uri});return true}
 if(parsed.pathname==='/api/account/mfa/verify'){if(!/^[a-f0-9-]{36}$/i.test(data.factorId||'')||!/^\d{6}$/.test(data.code||'')){send(res,400,{error:'Enter the six-digit authenticator code.'});return true}const challenge=await remote('/auth/v1/factors/'+data.factorId+'/challenge',{method:'POST',token:current.s.access,body:{}}),r=await remote('/auth/v1/factors/'+data.factorId+'/verify',{method:'POST',token:current.s.access,body:{challenge_id:challenge.id,code:data.code}});write(res,{...current.s,access:r.access_token,refresh:r.refresh_token,expires:now()+r.expires_in*1000});send(res,200,{verified:true});return true}
 send(res,404,{error:'Account action unavailable.'});return true;
 }catch(error){send(res,[400,413].includes(error.status)?error.status:503,{error:error.status===413?'Account request is too large.':error.status===400?'Invalid account request.':'The account service could not complete this action. No case information is accepted here.'});return true}}
 async function activeToolsPlan(req,res,requestedPlan){
   const current=await session(req,res);
   if(!current)return null;
   const operator=await remote('/rest/v1/rpc/navigator_is_operator',{method:'POST',token:current.s.access,body:{}});
   if(operator===true&&requestedPlan==null)return 'advanced';
   const plans=(await rights(current.s)).filter(row=>Object.hasOwn(tiers,row.plan));
   if(requestedPlan!=null)return plans.find(row=>row.plan===requestedPlan)?.plan||null;
   return plans.sort((a,b)=>tiers[b.plan]-tiers[a.plan])[0]?.plan||null;
 }
 async function purchaseIdentity(req,res){const current=await session(req,res);return current?{id:current.user.id}:null;}
 async function checkoutIdentity(req,res){const current=await session(req,res);return current?{id:current.user.id,accessToken:current.s.access}:null;}
 async function protect(req,res,asset){if(!enabled||!PROTECTED.has(asset))return false;if(!configured){send(res,503,{error:'Licensed access is temporarily unavailable.'});return true}const page=['guided.html','workspace.html','admin.html'].includes(asset),redirect=where=>{res.writeHead(303,{Location:where,'Cache-Control':'no-store'});res.end();};try{const current=await session(req,res);if(!current){if(page)redirect('/account');else send(res,401,{error:'Sign in required'});return true}if(asset==='workspace.html')return false;const operator=await remote('/rest/v1/rpc/navigator_is_operator',{method:'POST',token:current.s.access,body:{}});if(asset==='admin.html'){if(operator===true)return false;redirect('/workspace');return true;}if(operator===true)return false;const access=await rights(current.s);if(!access.some(x=>x.guided)){if(page)redirect('/workspace');else send(res,403,{error:'An active inquiry plan and verified sign-in are required'});return true}return false}catch{if(page){res.writeHead(503,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access check unavailable | Navigator</title><main><h1>Access check temporarily unavailable</h1><p>Your access could not be verified. Keep any existing inquiry tab open and save its recovery file before refreshing.</p><p><a href="/account">Try sign-in again</a> · <a href="/">Public website and free guidance</a></p></main></html>');}else send(res,503,{error:'Plan access could not be verified. Please try again later.'});return true}}

 async function isOperator(req,res){if(!enabled||!configured)return false;try{const current=await session(req,res);if(!current)return false;return await remote('/rest/v1/rpc/navigator_is_operator',{method:'POST',token:current.s.access,body:{}})===true}catch{return false}}
 return{handle,protect,isOperator,purchaseIdentity,checkoutIdentity,activeToolsPlan,enabled,configured};
}
module.exports={createAccountAccess,seal,unseal,PROTECTED};
