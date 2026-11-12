(function(){'use strict';const $=id=>document.getElementById(id);
const form=$('pilot-claim-form'),availability=$('pilot-service-status'),status=$('pilot-my-status'),sharing=$('pilot-sharing'),message=$('pilot-result'),button=$('pilot-claim-submit'),code=$('pilot-code');
const params=new URLSearchParams(location.search),candidate=(params.get('code')||'').trim().toUpperCase();
if(/^NAV[0-9A-F]{9}$/.test(candidate))code.value=candidate;if(/^NAV[0-9A-F]{9}$/.test(candidate)){const signIn=document.querySelector('a[href^="/account?return=partner-referral"]');if(signIn)signIn.href='/account?return=partner-referral&code='+encodeURIComponent(candidate)}
let enabled=false;const orderForm=$('pilot-test-order-form'),orderStatus=$('pilot-test-order-status'),orderList=$('pilot-test-order-list'),orderItems=$('pilot-test-order-items'),orderSubmit=$('pilot-test-order-submit');
async function get(path,options={}){const r=await fetch('/api/partners/pilot/'+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000),...options});let data={};try{data=await r.json()}catch{}return {ok:r.ok,status:r.status,data}}
async function init(){try{const conf=await get('config');enabled=conf.ok&&conf.data.pilotEnabled===true;if(!enabled){availability.textContent='Referral pilot is not currently available. No real referral codes or payouts are active.';status.textContent='Pilot access is off.';return}
form.hidden=false;availability.textContent='Pilot enabled. Account sign-in is required to register a code. No live commissions or payouts.';
const r=await get('status');if(r.status===401){status.textContent='Sign in with your verified Navigator account to see partner status or register a test referral.';return}if(!r.ok){status.textContent='Could not verify partner status. Try again through your account.';return}
const p=r.data.my_partner,ref=r.data.my_referral;
if(p&&p.status==='pilot'&&p.code){status.textContent='Test referral code issued. Your account is in the staging pilot, not an active payable programme.';$('pilot-code-display').textContent=p.code;$('pilot-count').textContent=String(p.pilot_referrals||0);sharing.hidden=false;if($('pilot-verified-test-count'))$('pilot-verified-test-count').textContent=String(p.pilot_verified_test_orders||0)}
else if(p&&p.status==='paused')status.textContent='Your pilot code is paused and cannot accept new test referrals.';
else if(p)status.textContent='Your partner application remains under review.';
else status.textContent='No issued pilot partner code is associated with this signed-in email.';
if(ref){message.textContent='Your account already has a '+ref.status+' test referral. Pilot records cannot be converted into payable commissions.';button.disabled=true;orderForm.hidden=false;orderStatus.textContent='You can verify and link completed Razorpay test orders from the same account.';}
const verified=Array.isArray(r.data.my_test_orders)?r.data.my_test_orders:[];
orderItems.replaceChildren();
if(verified.length){orderList.hidden=false;for(const x of verified){const li=document.createElement('li');li.textContent=(x.source==='plan'?'Inquiry plan: ':'Checklist: ')+(x.product||'test product')+' · linked '+(x.recordedAt?new Date(x.recordedAt).toLocaleDateString('en-IN'):'in pilot')+' · no commission';orderItems.append(li)}}else orderList.hidden=true;
}catch{availability.textContent='The referral pilot could not be reached. No changes have been made.';status.textContent='Status unavailable.'}}
form.addEventListener('submit',async e=>{e.preventDefault();if(!enabled||!form.reportValidity())return;button.disabled=true;message.textContent='Registering your explicit test referral choice…';
try{const r=await get('claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code.value.trim().toUpperCase(),confirmed:form.elements.confirmed.checked})});
if(!r.ok)throw Error(r.data.error||'Could not verify this code');
if(r.data.accepted===true){message.textContent='Pilot referral registered with your account. It expires in 90 days; no real commission is payable.';button.disabled=true;orderForm.hidden=false;orderStatus.textContent='Complete a new eligible Razorpay test checkout before linking its order reference.';return}
const reason={invalid_or_unavailable:'This code is not available.',self_referral_not_permitted:'Self-referrals are prohibited.',a_referral_is_already_registered:'Your account already has a registered pilot referral.'};
message.textContent=reason[r.data.reason]||'This referral cannot be registered.';button.disabled=false;
}catch(e){message.textContent=e.message;button.disabled=false}});
orderForm.addEventListener('submit',async e=>{e.preventDefault();if(!enabled||!orderForm.reportValidity())return;
 if(!$('pilot-test-confirm').checked)return;orderSubmit.disabled=true;orderStatus.textContent='Checking the original test checkout against Navigator records…';
 const payload={source:$('pilot-test-source').value,orderId:$('pilot-test-order-id').value.trim()};
 try{const r=await get('link-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(!r.ok)throw Error(r.data.error||'The test order could not be verified');
 if(r.data.linked!==true){const reasons={pilot_referral_required:'Register a pilot referral first.',pilot_referral_expired:'Your 90-day pilot referral expired.',pilot_partner_unavailable:'The partner pilot code is unavailable.',eligible_test_order_not_found:'No eligible completed test order was found for this account after referral registration.',order_already_assigned:'This test order is already assigned.'};throw Error(reasons[r.data.reason]||'This test order cannot be linked')}
 orderStatus.textContent=r.data.alreadyLinked?'This test order was already verified. No commission was created.':'Test order verified and linked. No real commission or payout was created.';
 orderForm.reset();const status=await get('status');if(status.ok){const v=Array.isArray(status.data.my_test_orders)?status.data.my_test_orders:[];orderItems.replaceChildren();orderList.hidden=!v.length;for(const x of v){const item=document.createElement('li');item.textContent=(x.source==='plan'?'Inquiry plan: ':'Checklist: ')+(x.product||'test product')+' · verified TEST only';orderItems.append(item)}}
 }catch(err){orderStatus.textContent=err.message;}finally{orderSubmit.disabled=false}
});
$('pilot-copy').addEventListener('click',async()=>{const v=$('pilot-code-display').textContent;const link=location.origin+'/partner-referral?code='+encodeURIComponent(v);try{await navigator.clipboard.writeText(link);$('pilot-copy-status').textContent='Test referral link copied.'}catch{$('pilot-copy-status').textContent='Copy this link manually: '+link}});
init();
})();