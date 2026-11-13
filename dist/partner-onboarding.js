(function(){'use strict';
 const names={agreement:'Partner agreement',identity_kyc:'Identity / KYC',tax_gst:'Tax / GST review',bank_ownership:'Bank ownership',invoice:'Invoice readiness',marketing_ethics:'Responsible marketing',conflicts:'Conflicts / procurement'};
 const summaries={agreement:'Signed agreement and lawful product scope',identity_kyc:'Independent identity checks outside this page',tax_gst:'Applicable tax registrations and withholding review',bank_ownership:'Bank beneficiary independently checked outside this page',invoice:'Legally compliant invoicing procedure',marketing_ethics:'No unlawful solicitation or false endorsements',conflicts:'No self-referrals, public procurement conflicts or statutory roles'};
 const statuses={pending:'Not yet reviewed',first_reviewed:'First review recorded',second_reviewed:'Two staging reviews recorded',rejected:'Requires correction'};
 const output=document.getElementById('partner-readiness-status'),panel=document.getElementById('partner-readiness-panel'),grid=document.getElementById('partner-readiness-gates');
 async function show(){
  try{
   const cfgResp=await fetch('/api/partners/onboarding/config',{credentials:'same-origin',cache:'no-store'});const cfg=await cfgResp.json();if(!cfg.enabled)throw Error('Partner readiness preview is not yet available.');
   const res=await fetch('/api/partners/onboarding/status',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(res.status===401){output.textContent='Sign in with your verified Navigator account to see your partner status.';return;}
   const data=await res.json();if(!res.ok)throw Error(data.error||'Status unavailable');
   if(!data.partnerFound){output.textContent='No pilot partner account is associated with your signed-in email. Apply first or contact the programme team.';return}
   document.getElementById('partner-account-state').textContent='Current partner account: '+(data.accountStatus||'under review')+' (not activated for payouts)';
   const gates=Array.isArray(data.gates)?data.gates:[];
   grid.replaceChildren();
   for(const item of gates){
    if(!Object.hasOwn(names,item.gate))continue;
    const card=document.createElement('article');card.className='gate';
    const label=document.createElement('span');label.className='gate-label';label.textContent='Review check';
    const title=document.createElement('h3');title.textContent=names[item.gate];
    const state=document.createElement('div');state.className='gate-status';state.textContent=statuses[item.state]||'Pending';
    const hint=document.createElement('p');hint.textContent=summaries[item.gate];
    card.append(label,title,state,hint);grid.append(card);
   }
   output.textContent='Seven-stage review available. Staging reviews do not activate real commissions or payments.';
   panel.hidden=false;
  }catch(e){output.textContent=e.message||'Partner readiness unavailable'}
 }
 show();
})();