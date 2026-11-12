'use strict';
// Current IC/LC checklist is the single v4 legal audit. The old Word checkbox edition
// is not read or shipped by this endpoint. Entitlement is verified independently.
const v4=require('./defensibility-v4.cjs');
const accessDays=120,millisecondsPerDay=86400000;
function read(edition='4.0'){
 if(edition!=='4.0')throw Error('Checklist edition unavailable');
 const legalAudit=v4.publicData();
 if(legalAudit.version!=='4.0'||legalAudit.checks.length!==84||legalAudit.gates.length!==8)throw Error('Current legal checklist is incomplete');
 return {legalAudit};
}
function onlineFromEnvironment({
 url=process.env.NAVIGATOR_AUTH_URL,
 key=process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,
 token=process.env.NAVIGATOR_CHECKLIST_STORE_TOKEN,
 fetchImpl=fetch
}={}){
 async function access(buyer,id){
  if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')||!key||!/^[a-f0-9]{64}$/.test(token||'')||!buyer?.accessToken)throw Error('Online access is not configured');
  const response=await fetchImpl(url+'/rest/v1/rpc/navigator_online_checklist',{
   method:'POST',
   headers:{apikey:key,Authorization:'Bearer '+buyer.accessToken,'Content-Type':'application/json'},
   body:JSON.stringify({p_token:token,p_id:id}),
   signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw Error('Online checklist access could not be verified');
  return response.json();
 }
 return {access,read};
}
function accessUntil(order){
 if(!order.captured||!order.downloadUntil)return null;
 const deadline=Date.parse(order.downloadUntil);
 return Number.isFinite(deadline)?new Date(deadline+(accessDays-90)*millisecondsPerDay).toISOString():null;
}
module.exports={onlineFromEnvironment,read,accessUntil};
