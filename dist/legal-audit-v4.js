(function(root){
'use strict';
// Client-only, coded review: no case information, conclusions, or audit answers sent to the server.
const STATUS=[['unverified','Unverified'],['pass','Verified against record'],['not-applicable','Not applicable — legal basis'],['remediation','Remediation required'],['legal-determination','Legal determination required'],['fundamental-defect','Fundamental defect']];
const $=(tag,parent,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.append(e);return e;};
const text=(parent,value)=>$('p',parent,value);
function mount(host,data,options={}){
 if(!host||!data||!Array.isArray(data.checks)||data.checks.length!==84||!Array.isArray(data.gates)||data.gates.length!==8)return null;
 host.replaceChildren();
 const wrap=$('section',host);wrap.className='panel v4-audit';wrap.id=options.id||'v4-audit';
 $('h2',wrap,'Judicial-defensibility review · v4.0');
 text(wrap,'84 source-linked checks, eight release gates and conditional IC/LC routes. This is a working legal-audit aid, not a completed inquiry, legal certification, or automated finding. Keep identities, allegations and originals in the institution’s restricted records.');
 const notice=$('p',wrap,'This review is held in this browser tab only. Save your coded review file before closing. Existing 43-check tick progress remains saved to the licensed account separately.');
 notice.className='small';
 const contextPanel=$('fieldset',wrap);contextPanel.className='scope-group';$('legend',contextPanel,'Applicable legal pathway');
 const contexts=[
 ['forum','Committee route',[['unknown','Forum to verify'],['IC','Internal Committee'],['LC','Local Committee']]],
 ['procedure','Applicable procedure',[['unknown','Verify service rules'],['prescribed','Prescribed POSH Rules'],['service','Other applicable service rules'],['ccs','CCS (CCA) / Central Government'],['ugc','UGC or special sector rules']]],
 ['bothEmployees','Both parties employees?', [['unknown','Not confirmed'],['yes','Yes'],['no','No']]],
 ['report','Intended report',[...data.reports.map(r=>[r.id,r.label])]],
 ['conciliation','Section 10 outcome',[['none','No completed settlement'],['completed','Completed settlement']]],
 ['appealForum','Appeal authority',[['unknown','Not yet legally verified'],['verified','Verified against current law']]]
 ];
 const fields={},results={};
 for(const [key,label,values] of contexts){
   const control=$('label',contextPanel,label);control.className='v4-field';
   const select=$('select',control);select.setAttribute('aria-label',label);
   for(const [value,title] of values){const option=$('option',select,title);option.value=value;}
   fields[key]=select;
 }
 const alerts=$('div',wrap);alerts.setAttribute('role','status');
 const overview=$('p',wrap);overview.className='small';
 const gatePanel=$('details',wrap);gatePanel.open=true;
 $('summary',gatePanel,'Eight independent release gates');
 text(gatePanel,'A gate is not passed merely because an item is ticked. Evidence code and competent reviewer confirmation are required; unresolved fundamental defects block release.');
 const gateRows=new Map();
 const checks=new Map();
 const field=(parent,label,placeholder='Record code only')=>{
   const holder=$('label',parent,label);holder.className='v4-field';
   const value=$('input',holder);value.placeholder=placeholder;value.maxLength=56;
   value.pattern='[A-Za-z0-9][A-Za-z0-9_.\\/-]{0,55}';value.autocomplete='off';
   value.setAttribute('aria-label',label);return value;
 };
 const statusSelect=(parent,label)=>{
   const sel=$('select',parent);sel.setAttribute('aria-label',label);
   for(const [value,title] of STATUS){const option=$('option',sel,title);option.value=value;}
   return sel;
 };
 for(const gate of data.gates){
   const row=$('div',gatePanel);row.className='v4-item';
   $('strong',row,gate.id+' · '+gate.title);
   const select=statusSelect(row,'Status for '+gate.id),reference=field(row,'Source or reviewer reference for '+gate.id);
   gateRows.set(gate.id,{select,reference});
   select.onchange=()=>update();
   reference.oninput=()=>update();
 }
 const controls=$('details',wrap);
 $('summary',controls,'84 detailed IC/LC legal checks');
 text(controls,'Assess legal applicability to the actual case. M = statute/rule when applicable; J = judicial safeguard; E = enhanced design. R = report; F = confidential inquiry file. No check is automatically certified.');
 for(const group of data.sections){
   const section=$('details',controls);section.className='v4-domain';
   $('summary',section,group.code+' · '+group.title+' ('+group.count+')');
   for(const check of data.checks.filter(item=>item.domain===group.code)){
     const row=$('div',section);row.className='v4-item';
     $('strong',row,String(check.number).padStart(2,'0')+'. '+check.title);
     const meta=$('p',row,check.classification+' · '+check.location+(check.condition==='general'?'':' · conditional: '+check.condition));meta.className='small';
     const select=statusSelect(row,'Status for check '+check.number);
     const reference=field(row,'Evidence or legal basis code for check '+check.number);
     checks.set(check.id,{select,reference});
     select.onchange=()=>update();reference.oninput=()=>update();
   }
 }
 const outcome=$('p',wrap);outcome.setAttribute('role','status');
 const actions=$('div',wrap);actions.className='actions';
 const download=$('button',actions,'Export coded audit review (JSON)');download.type='button';download.className='button';
 const importLabel=$('label',actions,'Reopen a coded review file (JSON)');
 const importFile=$('input',importLabel);importFile.type='file';importFile.accept='.json,application/json';
 const documentButton=root.NavigatorPersonalDocx&&root.NavigatorDocx?$('button',actions,'Download working legal audit (Word)'):null;
 if(documentButton){documentButton.type='button';documentButton.className='button';}
 const getValue=r=>({status:r.select.value,ref:r.reference.value.trim()});
 const validRef=v=>!v||(/^[A-Za-z0-9][A-Za-z0-9_.\\/-]{0,55}$/.test(v));
 const currentContext=()=>Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value]));
 const problems=()=>{
   const invalid=[],unverified=[],blocked=[];
   for(const [id,row] of [...gateRows,...checks]){
     const v=getValue(row);
     if(!validRef(v.ref)||(v.status!=='unverified'&&!v.ref))invalid.push(id);
     if(v.status==='unverified'||v.status==='legal-determination'||v.status==='remediation')unverified.push(id);
     if(v.status==='fundamental-defect')blocked.push(id);
   }
   return {invalid,unverified,blocked};
 };
 function warnings(){
   const c=currentContext(),notes=[];
   if(c.forum==='unknown')notes.push('Resolve whether the IC or LC is competent before a merits report.');
   if(c.procedure==='unknown')notes.push('Verify which service rules govern; Rule 7 cannot be assumed automatically.');
   if(c.procedure==='ccs')notes.push('Confirm preliminary versus formal disciplinary stage under the actual CCS (CCA) framework.');
   if(c.procedure==='ugc')notes.push('Verify current UGC/special-regime provisions and Committee composition.');
   if(c.bothEmployees==='unknown')notes.push('Determine whether Section 11(1) findings representations apply.');
   if(c.conciliation==='completed'&&c.report==='statutory')notes.push('A completed Section 10 settlement usually ends the merits inquiry; check breach route separately.');
   if(c.appealForum==='unknown')notes.push('Verify the competent Section 18 appeal forum under current law and transitional provisions.');
   if(c.report==='preliminary')notes.push('No prejudgment or unauthorised penalty in a preliminary report.');
   return notes;
 }
 function update(){
   const p=problems(),items=[...gateRows,...checks],reviewed=items.filter(([,r])=>r.select.value==='pass'||r.select.value==='not-applicable').length;
   overview.textContent='Review status: '+reviewed+' / '+items.length+' checked as pass or reasoned N/A; '+p.unverified.length+' open; '+p.blocked.length+' fundamental; '+p.invalid.length+' missing/invalid references.';
   alerts.replaceChildren();for(const warning of warnings())text(alerts,warning);
   const eligible=!p.blocked.length&&!p.unverified.length&&!p.invalid.length&&!warnings().length;
   outcome.textContent=eligible?'All selected controls recorded. A competent independent reviewer must still validate the evidence and sign off; this page does not certify statutory compliance.':'Not ready for final release. Resolve applicable open issues, verify each record reference and obtain competent legal review.';
 }
 function snapshot(){
   return {schema:'navigator-v4-coded-audit',version:'4.0',exportedAt:new Date().toISOString(),context:currentContext(),
     gates:Object.fromEntries([...gateRows].map(([id,row])=>[id,getValue(row)])),
     checks:Object.fromEntries([...checks].map(([id,row])=>[id,getValue(row)]))};
 }
 download.onclick=()=>{
   const json=JSON.stringify(snapshot(),null,2);
   const a=$('a',actions);a.href=URL.createObjectURL(new Blob([json],{type:'application/json'}));a.download='posh-v4-coded-review.json';a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
 };
 importFile.onchange=async()=>{
   try{
     const file=importFile.files?.[0];if(!file||file.size>500000)throw Error('Choose a coded review file smaller than 500 KB.');
     const saved=JSON.parse(await file.text());
     if(saved.schema!=='navigator-v4-coded-audit'||saved.version!=='4.0')throw Error('This is not a v4 coded audit review.');
     for(const [key,select] of Object.entries(fields))if(typeof saved.context?.[key]==='string'&&[...select.options].some(o=>o.value===saved.context[key]))select.value=saved.context[key];
     for(const [id,row] of [...gateRows,...checks]){
       const value=(gateRows.has(id)?saved.gates:saved.checks)?.[id];
       if(!value)continue;
       if(!STATUS.some(s=>s[0]===value.status)||typeof value.ref!=='string'||!validRef(value.ref))throw Error('The review file contains an invalid status or record code.');
       row.select.value=value.status;row.reference.value=value.ref;
     }
     update();outcome.textContent='Coded review reloaded locally. Reverify the actual source records before finalisation.';
   }catch(error){outcome.textContent=error.message;}
   finally{importFile.value='';}
 };
 if(documentButton)documentButton.onclick=()=>{
  try{
   const s=snapshot(),doc=[{type:'title',text:'POSH v4 Legal Audit — Restricted Working Record'},
     {type:'notice',text:'For competent IC/LC review only. Coded entries are not proof of compliance, evidence, finding or service.'},
     {type:'heading',text:'Legal pathway'},...Object.entries(s.context).map(([k,v])=>({type:'p',text:k+': '+v})),
     {type:'heading',text:'Eight release gates'},
     {type:'table',rows:[['Gate','Status','Reference'],...data.gates.map(g=>[g.title,s.gates[g.id].status,s.gates[g.id].ref||'[not recorded]'])]},
     ...data.sections.flatMap(group=>[{type:'heading',text:group.code+' · '+group.title},
       {type:'table',rows:[['Check','Class','Status','Reference'],...data.checks.filter(c=>c.domain===group.code).map(c=>[c.number+'. '+c.title,c.classification,s.checks[c.id].status,s.checks[c.id].ref||'[not recorded]'])]}]),
     {type:'heading',text:'Independent review'}, {type:'p',text:'Competent reviewer: [ROLE/CODE]  Review date: [DATE]  Outcome and unresolved defects: [RESTRICTED RECORD REFERENCE]'}];
   root.NavigatorDocx.download('POSH-v4-legal-audit-working-record.docx',root.NavigatorPersonalDocx.buildDocx('POSH v4 Legal Audit',doc,{workflow:true}));
  }catch(error){outcome.textContent='Word export could not be prepared. '+error.message;}
 };
 update();
 return {snapshot,update};
}
root.NavigatorDefensibilityV4={mount};
})(globalThis);
