(function(){'use strict';const $=id=>document.getElementById(id);const status=$('finance-status');const area=$('finance-workspace');
const money=paise=>{try{return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(BigInt(paise))/100)}catch{return '—'}};
const fmtDate=s=>{try{return new Date(s).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'})}catch{return '—'}};
async function api(action,payload){const opts={credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)};
if(payload){opts.method='POST';opts.headers={'Content-Type':'application/json'};opts.body=JSON.stringify(payload)}
const r=await fetch('/api/partners/finance/'+action,opts);let data={};try{data=await r.json()}catch{}if(!r.ok)throw Error(data.error||'Finance service unavailable');return data}
function renderScenario(d){
$('finance-net').textContent=money(d.annualEligibleNetPaise);$('finance-tier').textContent=d.tierPercent+'%';$('finance-target').textContent=money(d.targetCommissionPaise);
$('finance-adjustment').textContent=(BigInt(d.trueUpPaise)<0n?'−':'')+money(BigInt(d.trueUpPaise)<0n?(-BigInt(d.trueUpPaise)).toString():d.trueUpPaise);
$('finance-held').textContent=money(d.heldNetPaise);$('finance-refunds').textContent=money(d.verifiedRefundNetPaise);
$('finance-example-description').textContent='Indian FY starting '+d.financialYear+' · '+d.eligibleOrderCount+' matured order(s) · '+d.heldOrderCount+' held · '+d.blockedOrderCount+' excluded. Negative adjustments carry forward. These are fictional numbers, never payable.';
}
async function preview(){try{const data=await api('simulate',{scenario:$('finance-scenario').value});renderScenario(data);status.textContent='Scenario validated. No ledger or payout record was created.'}catch(e){status.textContent=e.message}}
const actions={prepared:[['Approve first','approve_first'],['Reject','reject']],approved_first:[['Approve second','approve_second'],['Reject','reject']],approved_second:[],rejected:[]};
function makeAction(id,action,label){const b=document.createElement('button');b.className='partner-button secondary';b.type='button';b.textContent=label;
b.addEventListener('click',async()=>{if(!confirm('Record this TEST-ONLY finance review action? No payout can result.'))return;b.disabled=true;try{await api('review',{action,draftId:id});status.textContent='Simulation review action recorded. No real funds were affected.';await load()}catch(e){status.textContent=e.message;b.disabled=false}});return b}
async function load(){try{const d=await api('status');area.hidden=false;const fin=d.financials||{},rows=Array.isArray(d.drafts)?d.drafts:[];
$('real-commission-count').textContent=String(fin.real_commission_events??'—');$('real-payout-count').textContent=String(fin.real_payout_records??'—');
const body=$('finance-rows');body.replaceChildren();
if(!rows.length){const r=body.insertRow();const td=r.insertCell();td.colSpan=7;td.textContent='No finance training drafts. Choose a scenario and create one.'}
for(const x of rows){const tr=body.insertRow();
for(const value of [fmtDate(x.created_at),x.scenario,x.state,x.prepared_by,x.first_approved_by||'—',x.second_approved_by||'—']){
const td=tr.insertCell();td.textContent=value||'—'}
const buttons=tr.insertCell();for(const [label,act] of actions[x.state]||[])buttons.append(makeAction(x.id,act,label));if(!(actions[x.state]||[]).length)buttons.textContent='No further action';}
status.textContent=rows.length+' synthetic finance review draft(s). Live commissions and bank payouts are disabled.';
}catch(e){status.textContent=e.message+'. Operator sign-in may be required.';area.hidden=true}}
$('finance-run').addEventListener('click',preview);
$('finance-prepare').addEventListener('click',async()=>{if(!confirm('Prepare this scenario for nonfinancial dual-review rehearsal?'))return;
try{await api('review',{action:'prepare',scenario:$('finance-scenario').value});status.textContent='Training draft prepared; two other authorised staff must approve independently.';await load()}catch(e){status.textContent=e.message}});
$('finance-refresh').addEventListener('click',load);load();})();