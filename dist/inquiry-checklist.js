(function(){
'use strict';
const $=id=>document.getElementById(id);
const status=$('checklist-status'),content=$('checklist-content'),actions=$('checklist-actions');
const requested=new URLSearchParams(location.search).get('order');
const endpoint='/api/checklist/content'+(requested===null?'':'?order='+encodeURIComponent(requested));
const displayDate=new Intl.DateTimeFormat('en-IN',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Kolkata'});
let activeOrder='',expiresAt=0,pending=false,expiryTimer=null;
function lock(message){
 clearTimeout(expiryTimer);
 $('v4-inquiry-audit').replaceChildren();
 $('checklist-legal-status').textContent='';
 activeOrder='';
 content.hidden=true;actions.hidden=false;
 status.textContent=message;
}
function mount(data){
 const audit=data.legalAudit;
 const note=$('checklist-legal-status');
 if(!audit||audit.version!=='4.0'||audit.checks?.length!==84||audit.gates?.length!==8){
  throw Error('The current 84-point legal checklist could not be verified. Please reload from the purchased link.');
 }
 if(!window.NavigatorDefensibilityV4?.mount)throw Error('The current checklist interface could not load. Refresh the page.');
 const target=$('v4-inquiry-audit');
 const handle=window.NavigatorDefensibilityV4.mount(target,audit,{id:'v4-inquiry-review'});
 if(!handle)throw Error('The 84-point review did not initialise.');
 activeOrder=data.orderId;
 note.textContent='84-point legal checklist ready: eight domains and eight independent finalisation gates.';
 note.className='checklist-audit-success';
 $('checklist-holder').textContent='Licensed organisation: '+data.organisation;
}
async function check(){
 if(pending)return;
 pending=true;
 try{
  const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
  const data=await response.json();
  if(!response.ok){
   if([401,403,410].includes(response.status)){lock(data.error||'Checklist access is unavailable.');return;}
   status.textContent='Checklist access could not be reverified. Your current coded review remains in this tab. Try Check access again.';
   return;
  }
  expiresAt=Date.parse(data.accessUntil);
  if(!Number.isFinite(expiresAt)||Date.now()>=expiresAt){lock('The 120-day checklist access period has ended.');return;}
  if(!data.orderId||!data.legalAudit||data.legalAudit.version!=='4.0'){
   lock('The current checklist did not return the 84-point edition. Please check access again.');return;
  }
  if(activeOrder!==data.orderId)mount(data);
  $('checklist-expiry').textContent='Online access until '+displayDate.format(expiresAt)+' IST.';
  clearTimeout(expiryTimer);
  if(expiresAt-Date.now()<2147483647)expiryTimer=setTimeout(()=>lock('The 120-day checklist access period has ended.'),Math.max(0,expiresAt-Date.now()));
  content.hidden=false;actions.hidden=true;status.textContent='';
 }catch(error){
  if(!activeOrder)lock(error.message||'Checklist access could not be verified. Please try again.');
  else status.textContent='Connection temporarily unavailable. Export your coded review before leaving this tab. You can retry access without clearing the review.';
 }finally{pending=false;}
}
$('checklist-retry').addEventListener('click',check);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
setInterval(()=>{if(!document.hidden&&!content.hidden)void check();},60000);
void check();
})();
