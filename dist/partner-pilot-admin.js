(function(){'use strict';const status=document.getElementById('pilot-operator-status'),body=document.getElementById('pilot-operator-rows'),refresh=document.getElementById('pilot-operator-refresh');
const actions={mark_reviewing:'Mark reviewing',pilot_issue:'Issue test code',pilot_pause:'Pause test code',pilot_resume:'Resume test code',decline:'Decline application'};
async function api(action,applicationId){const r=await fetch('/api/partners/pilot/admin',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...(applicationId?{applicationId}:{})}),signal:AbortSignal.timeout(12000)});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Operator access failed');return d}
function button(label,action,id){const b=document.createElement('button');b.type='button';b.className='partner-button secondary';b.style.margin='3px';b.style.padding='8px 10px';b.style.minHeight='36px';b.textContent=label;b.addEventListener('click',async()=>{const warning=action==='pilot_issue'?'Issue a TEST-ONLY code? This does not approve legal, KYC, tax or financial compliance.':action==='decline'?'Decline this application and terminate any test code?':'Apply this operator change?';if(!confirm(warning))return;b.disabled=true;try{await api(action,id);status.textContent='Pilot action recorded; no monetary credit or payout has been created.';await load()}catch(e){status.textContent='Action could not be recorded: '+e.message; b.disabled=false}});return b}
async function load(){refresh.disabled=true;try{const config=await fetch('/api/partners/pilot/config',{cache:'no-store',credentials:'same-origin'}).then(x=>x.json());if(!config.pilotEnabled){status.textContent='Pilot codes disabled. Applications are still reviewable above.';body.replaceChildren();return}
const list=await api('list');const rows=Array.isArray(list)?list:[];body.replaceChildren();
if(!rows.length){const row=body.insertRow(),cell=row.insertCell();cell.colSpan=5;cell.textContent='No applications for pilot code review.'}
for(const p of rows){
 const row=body.insertRow();[p.contact_name+' · '+p.email,p.application_status||'pending',p.account_status||'not issued',p.code||'—'].forEach(x=>{const td=row.insertCell();td.textContent=x||'—'});
 const a=row.insertCell(),id=p.id;
 if(['pending','reviewing'].includes(p.application_status)&&!p.account_status){a.append(button(actions.mark_reviewing,'mark_reviewing',id),button(actions.pilot_issue,'pilot_issue',id),button(actions.decline,'decline',id))}
 else if(p.account_status==='pilot'){a.append(button(actions.pilot_pause,'pilot_pause',id))}
 else if(p.account_status==='paused'){a.append(button(actions.pilot_resume,'pilot_resume',id))}
 else a.textContent='No pilot action';
}
status.textContent=rows.length+' application(s) in review. Only test referral codes can be issued.'}catch(e){status.textContent='Pilot control unavailable: '+e.message;body.replaceChildren()}finally{refresh.disabled=false}}
refresh.addEventListener('click',load);load();
})();