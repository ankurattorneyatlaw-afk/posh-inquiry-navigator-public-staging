(function(){'use strict';
const $=id=>document.getElementById(id),status=$('review-admin-status'),container=$('review-partners'),refresh=$('review-refresh');
const gates=[['agreement','Partner agreement'],['identity_kyc','Identity / KYC'],['tax_gst','Tax / GST'],['bank_ownership','Bank ownership'],['invoice','Invoice readiness'],['marketing_ethics','Marketing ethics'],['conflicts','Conflicts / procurement']];
const states={pending:'Pending',first_reviewed:'First review',second_reviewed:'Two-stage review',rejected:'Needs correction'};
async function rpc(action,partnerId,gate){
 const body={action,...(partnerId?{partnerId,gate,acknowledged:true}:{})};
 const r=await fetch('/api/partners/onboarding/admin',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(13000)});
 let data={};try{data=await r.json()}catch{}if(!r.ok)throw Error(data.error||'Onboarding review is unavailable');return data;
}
function control(label,action,id,gate){
 const b=document.createElement('button');b.type='button';b.textContent=label;b.className='partner-button secondary';
 b.addEventListener('click',async()=>{
  const msg=action==='reject'?'Reject this staging check? This action cannot be undone here.':action==='second_review'?'Confirm a SECOND independent staging review? This does not authorise payment.':'Record your FIRST staging review of externally verified documents? This does not activate the partner.';
  if(!confirm(msg))return;
  b.disabled=true;try{await rpc(action,id,gate);status.textContent='Staging control review recorded. No partner activation, real commission or payment was created.';await load()}catch(e){status.textContent='Review not recorded: '+e.message;b.disabled=false;}
 });return b;
}
async function load(){
 refresh.disabled=true;
 try{
  const data=await rpc('list');
  const partners=Array.isArray(data.partners)?data.partners:[],reviews=Array.isArray(data.reviews)?data.reviews:[];
  const reviewMap=new Map(reviews.map(r=>[r.partner_id+':'+r.gate,r]));
  container.replaceChildren();
  if(!partners.length){const p=document.createElement('p');p.className='review-box';p.textContent='No pilot partner accounts are awaiting onboarding. Review partner applications first.';container.append(p);}
  for(const p of partners){
   const area=document.createElement('section');area.className='review-box';
   const heading=document.createElement('h2');heading.className='review-heading';heading.textContent=p.contact_name||'Partner account';
   const detail=document.createElement('p');detail.className='review-muted';detail.textContent=(p.organisation||'Independent')+' · '+(p.email||'')+' · '+(p.account_status||'review')+' · '+(p.code||'Pilot code not issued');
   const scroll=document.createElement('div');scroll.className='review-scroll';const table=document.createElement('table');table.className='review-table';
   const head=document.createElement('thead'),header=document.createElement('tr');
   for(const title of ['Requirement','Staging status','First reviewer','Second reviewer','Control actions']){const th=document.createElement('th');th.textContent=title;header.append(th)}
   head.append(header);table.append(head);const body=document.createElement('tbody');
   for(const [gate,label] of gates){
    const r=reviewMap.get(p.partner_id+':'+gate)||{state:'pending'};
    const tr=document.createElement('tr');
    for(const t of [label,states[r.state]||r.state,r.reviewer_one||'—',r.reviewer_two||'—']){const td=document.createElement('td');td.textContent=t;tr.append(td)}
    const actions=document.createElement('td');
    if(r.state==='pending')actions.append(control('First review','first_review',p.partner_id,gate),control('Reject','reject',p.partner_id,gate));
    else if(r.state==='first_reviewed')actions.append(control('Independent second review','second_review',p.partner_id,gate),control('Reject','reject',p.partner_id,gate));
    else actions.textContent=r.state==='second_reviewed'?'Review recorded; live activation prohibited':'Closed for correction';
    tr.append(actions);body.append(tr);
   }
   table.append(body);scroll.append(table);area.append(heading,detail,scroll);container.append(area);
  }
  status.textContent='Showing '+partners.length+' partner account(s). Staging review only · No KYC document storage, activation or payouts.';
 }catch(e){status.textContent=e.message||'Unable to access onboarding reviews';container.replaceChildren()}
 finally{refresh.disabled=false}
}
refresh.addEventListener('click',load);load();
})();