(function(){'use strict';const $=id=>document.getElementById(id);
const form=$('pilot-claim-form'),availability=$('pilot-service-status'),status=$('pilot-my-status'),sharing=$('pilot-sharing'),message=$('pilot-result'),button=$('pilot-claim-submit'),code=$('pilot-code');
const params=new URLSearchParams(location.search),candidate=(params.get('code')||'').trim().toUpperCase();
if(/^NAV[0-9A-F]{9}$/.test(candidate))code.value=candidate;
let enabled=false;
async function get(path,options={}){const r=await fetch('/api/partners/pilot/'+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000),...options});let data={};try{data=await r.json()}catch{}return {ok:r.ok,status:r.status,data}}
async function init(){try{const conf=await get('config');enabled=conf.ok&&conf.data.pilotEnabled===true;if(!enabled){availability.textContent='Referral pilot is not currently available. No real referral codes or payouts are active.';status.textContent='Pilot access is off.';return}
form.hidden=false;availability.textContent='Pilot enabled. Account sign-in is required to register a code. No live commissions or payouts.';
const r=await get('status');if(r.status===401){status.textContent='Sign in with your verified Navigator account to see partner status or register a test referral.';return}if(!r.ok){status.textContent='Could not verify partner status. Try again through your account.';return}
const p=r.data.my_partner,ref=r.data.my_referral;
if(p&&p.status==='pilot'&&p.code){status.textContent='Test referral code issued. Your account is in the staging pilot, not an active payable programme.';$('pilot-code-display').textContent=p.code;$('pilot-count').textContent=String(p.pilot_referrals||0);sharing.hidden=false}
else if(p&&p.status==='paused')status.textContent='Your pilot code is paused and cannot accept new test referrals.';
else if(p)status.textContent='Your partner application remains under review.';
else status.textContent='No issued pilot partner code is associated with this signed-in email.';
if(ref){message.textContent='Your account already has a '+ref.status+' test referral. Pilot records cannot be converted into payable commissions.';button.disabled=true}
}catch{availability.textContent='The referral pilot could not be reached. No changes have been made.';status.textContent='Status unavailable.'}}
form.addEventListener('submit',async e=>{e.preventDefault();if(!enabled||!form.reportValidity())return;button.disabled=true;message.textContent='Registering your explicit test referral choice…';
try{const r=await get('claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code.value.trim().toUpperCase(),confirmed:form.elements.confirmed.checked})});
if(!r.ok)throw Error(r.data.error||'Could not verify this code');
if(r.data.accepted===true){message.textContent='Pilot referral registered with your account. It expires in 90 days; no real commission is payable.';button.disabled=true;return}
const reason={invalid_or_unavailable:'This code is not available.',self_referral_not_permitted:'Self-referrals are prohibited.',a_referral_is_already_registered:'Your account already has a registered pilot referral.'};
message.textContent=reason[r.data.reason]||'This referral cannot be registered.';button.disabled=false;
}catch(e){message.textContent=e.message;button.disabled=false}});
$('pilot-copy').addEventListener('click',async()=>{const v=$('pilot-code-display').textContent;const link=location.origin+'/partner-referral?code='+encodeURIComponent(v);try{await navigator.clipboard.writeText(link);$('pilot-copy-status').textContent='Test referral link copied.'}catch{$('pilot-copy-status').textContent='Copy this link manually: '+link}});
init();
})();