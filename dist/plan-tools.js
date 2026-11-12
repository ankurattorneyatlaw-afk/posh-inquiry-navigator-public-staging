(function(){
'use strict';
const $=id=>document.getElementById(id);
const status=$('tools-status');
const endpoint=new URL('/api/plan-tools',location.origin);
const testOrder=new URLSearchParams(location.search).get('testOrder');
if(testOrder!==null)endpoint.searchParams.set('testOrder',testOrder);
const guidedHref=testOrder?'/guided?testOrder='+encodeURIComponent(testOrder):'/guided';
function el(tag,text,parent){
  const node=document.createElement(tag);
  if(text)node.textContent=text;
  if(parent)parent.append(node);
  return node;
}
function section(title,parent=$('tools-panels')){
  const panel=el('section','',parent);
  panel.className='panel';
  el('h2',title,panel);
  return panel;
}
function link(parent,label,href){
  const a=el('a',label,parent);
  a.href=href;
  return a;
}
function select(parent,label,choices){
  const group=el('label',label,parent);
  const field=el('select','',group);
  for(const [value,title] of choices){
    const option=el('option',title,field);
    option.value=value;
  }
  return field;
}
function field(parent,label,max=160){
  const group=el('label',label,parent);
  const input=el('input','',group);
  input.maxLength=max;
  input.autocomplete='off';
  return input;
}
const heading=text=>({type:'heading',text});
const paragraph=text=>({type:'p',text});
const draftNote={type:'notice',text:'Restricted working draft. Complete and verify in institutional custody. No software-generated finding, approval, service or statutory milestone.'};
function documentItems(title,items){
  return [{type:'title',text:title},draftNote,...items];
}
async function access(){
  const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Plan access could not be verified.');
  return data;
}
function exportButton(parent,label,name,expected,items){
  const button=el('button',label,parent);
  button.type='button';
  button.className='button';
  button.onclick=async()=>{
    button.disabled=true;
    try{
      const current=await access();
      if(current.plan!==expected||(current.test&&current.entitlement?.state!=='active'))throw Error('Plan access changed. Open the tools again to load your current plan.');
      const title=name.replaceAll('-',' ');
      const doc=window.NavigatorPersonalDocx.buildDocx(title,documentItems(title,items()),{workflow:true});
      window.NavigatorDocx.download(name+'.docx',doc);
      status.textContent='Draft download requested.';
    }catch(error){status.textContent=error.message;}
    finally{button.disabled=false;}
  };
}
function reviewList(parent,groups,interactive=false){
  const items=[];
  for(const [title,checks] of groups){
    el('h3',title,parent);
    const list=el('ul','',parent);
    const inputs=checks.map(check=>{
      const row=el('li','',list);
      if(!interactive){row.textContent=check;return null;}
      const label=el('label','',row);
      const input=el('input','',label);
      input.type='checkbox';
      label.append(' '+check);
      return input;
    });
    items.push(()=>[
      heading(title),
      ...checks.map((check,index)=>paragraph((inputs[index]?(inputs[index].checked?'Reviewed — ':'Open — '):'')+check))
    ]);
  }
  return ()=>items.flatMap(read=>read());
}
function standardTools(data,audit){
  const plan=data.plan;
  const panel=section('Neutral question planning');
  const role=select(panel,'Role',[['complainant','Aggrieved woman'],['respondent','Respondent'],['witness','Witness']]);
  const output=el('p','',panel);
  const prompts={
    complainant:'What do you recall about the incident in scope? Which details come from your own observation? What records or people may help clarify it?',
    respondent:'What is your account of the notified incident? Which particulars do you agree with or dispute? What material or explanation should the Committee consider?',
    witness:'What did you personally observe? What did you learn later from others? What helps place your observation in context?'
  };
  function render(){output.textContent=prompts[role.value];}
  role.onchange=render;
  render();
  exportButton(panel,'Download question and answer record','Neutral-question-record',plan,()=>[
    heading(role.selectedOptions[0].textContent),paragraph(output.textContent),
    {type:'table',rows:[['Question as put','Answer or record reference','Follow-up and reviewer'],['','','']]}
  ]);
  const basic=section('Case-specific inquiry and review reports');
  const notes=Object.fromEntries(data.legalAudit.reports.map(r=>[r.id,r.note]));
  window.PoshReportAssemblyUI.mount(basic,{notes,audit});
  const pdf=el('button','Print or save the tools as PDF',basic);
  pdf.type='button';
  pdf.onclick=()=>window.print();
}
function professionalTools(data){
  const panel=section('Allegation-wise evidence and question planning');
  el('p','Use coded references. You can import the evidence index from a Navigator recovery file without uploading it.',panel);
  const input=el('input','',el('label','Navigator recovery JSON (optional)',panel));
  input.type='file';
  input.accept='.json,application/json';
  const code=field(panel,'Allegation code');
  const summary=el('p','No evidence index loaded.',panel);
  summary.setAttribute('role','status');
  let evidence=[];
  const imported=el('ul','',panel);
  function filtered(){
    const issue=code.value.trim().toUpperCase();
    return issue?evidence.filter(row=>row.issueRefs.toUpperCase().split(/[\s,]+/).includes(issue)):evidence;
  }
  function render(){
    imported.replaceChildren();
    for(const row of filtered()){
      const item=el('li',row.annexure+' · '+(row.active?'Active':'Withdrawn')+' · '+row.issueRefs,imported);
      if(row.active)el('span',' — Ask which fact this material addresses and what may support, qualify or contradict it.',item);
    }
  }
  code.oninput=render;
  input.onchange=async()=>{
    try{
      const file=input.files[0];
      if(!file||file.size>2_000_000)throw Error('Choose a Navigator recovery file up to 2 MB.');
      const content=JSON.parse(await file.text());
      const evidenceUrl=new URL("/evidence.js",location.origin);
      if(testOrder)evidenceUrl.searchParams.set("testOrder",testOrder);
      try{await import(evidenceUrl.href);}catch{throw Error("Evidence import is unavailable. Verify your plan access and try again.");}
      evidence=window.NavigatorEvidence.restore(content.evidence?.record||content.record||content).items;
      summary.textContent=evidence.length+' coded references loaded in this tab.';
    }catch(error){evidence=[];summary.textContent=error.message;}
    render();
  };
  const audience=select(panel,'Question audience',[['complainant','Aggrieved woman'],['respondent','Respondent'],['witness','Witness']]);
  const support=field(panel,'Supporting material code');
  const contrary=field(panel,'Contrary or qualifying material code');
  const question=el('p','',panel);
  question.setAttribute('role','status');
  const makeQuestion=el('button','Prepare neutral question prompts',panel);
  makeQuestion.type='button';
  makeQuestion.onclick=()=>{
    const issue=code.value.trim()||'the allegation in scope';
    const supporting=support.value.trim()||'the supporting material';
    const qualifying=contrary.value.trim()||'the contrary or qualifying material';
    const start=audience.value==='witness'?'What did you personally observe about ':audience.value==='respondent'?'What is your response to ':'What do you recall about ';
    question.textContent=start+issue+'? Which details can you clarify in '+supporting+' and '+qualifying+'? What else should the Committee consider?';
  };
  const rows=()=>filtered().map(row=>[code.value.trim()||row.issueRefs,row.annexure+(row.active?'':' (withdrawn)'),support.value.trim(),contrary.value.trim(),question.textContent]);
  exportButton(panel,'Download evidence matrix and question plan','Evidence-matrix-and-question-plan',data.plan,()=>[
    {type:'table',rows:[['Allegation','Annexure','Supporting relevance','Contrary or qualifying relevance','Question, response and reasoning'],...(rows().length?rows():[[code.value.trim(),'',support.value.trim(),contrary.value.trim(),question.textContent]])]}
  ]);
  const reviews=section('Three readiness reviews');
  const reviewItems=reviewList(reviews,data.readiness,true);
  exportButton(reviews,'Download readiness review record','Three-stage-readiness-review',data.plan,reviewItems);
  const knowledge=section('Expert Knowledge');
  for(const [title,note] of data.knowledge){el('h3',title,knowledge);el('p',note,knowledge);}
  exportButton(knowledge,'Download knowledge reference and authority index','Expert-Knowledge-and-authority-index',data.plan,()=>[
    ...data.knowledge.flatMap(([title,note])=>[heading(title),paragraph(note)]),
    paragraph(data.sources.act),paragraph(data.sources.rules),
    {type:'table',rows:[['Act, rule or judgment','Citation and pinpoint','Verified source and proposition actually relied on'],['','','']]}
  ]);
}
function advancedTools(data){
  const panel=section('Complex proceedings, remand and reopening');
  el('p','Use the scenario exercises to test a procedure. Do not enter names or free-text case histories here.',panel);
  const scenario=select(panel,'Procedural challenge',data.advanced.scenarios.map(([key,description])=>[key,description]));
  const detail=el('p','',panel);
  const compare=el('button','Show review prompts',panel);
  compare.type='button';
  const participant=field(panel,'Participant code');
  const issue=field(panel,'Allegation or issue code');
  const direction=field(panel,'Direction or history record code');
  const profile=select(panel,'Service-rule profile',data.advanced.profiles.map(([title],i)=>[String(i),title]));
  const profileNote=el('p','',panel);
  const current=()=>data.advanced.scenarios.find(([key])=>key===scenario.value);
  function selectedProfile(){return data.advanced.profiles[Number(profile.value)];}
  function update(){detail.textContent='';profileNote.textContent=selectedProfile()[1];}
  scenario.onchange=update;
  profile.onchange=update;
  compare.onclick=()=>{detail.textContent=current()[2];};
  update();
  function code(value){
    const raw=value.trim();
    if(raw&&!/^[A-Z][A-Z0-9-]{0,23}$/.test(raw))throw Error('Use short uppercase codes such as R-02 or ISSUE-1.');
    return raw||'[code to confirm]';
  }
  exportButton(panel,'Download coded question and continuity draft','Complex-inquiry-continuity-draft',data.plan,()=>{
    const person=code(participant.value),allegation=code(issue.value),reference=code(direction.value);
    return [
      heading('Review route'),paragraph(current()[1]),paragraph(current()[2]),
      heading('Coded question plan'),paragraph('What opportunity has '+person+' had to respond to material on '+allegation+'? What further clarification is allowed by the governing direction?'),
      heading('Direction and continuity'),paragraph('Review '+reference+' against the original restricted record. Preserve prior versions, actual dates and reasons. Record any new step separately.'),
      heading('Service-rule profile'),paragraph(selectedProfile().join(' — ')),
      {type:'table',rows:[['Original record code','New action code','Authorised basis','Actual date and reviewer code'],[reference,'','','']]}
    ];
  });
}
function showSeats(data){
  if(!data.entitlement?.owner)return;
  const seatOptions=$('tools-seat-options');
  seatOptions.querySelector('summary').textContent=data.entitlement.state==='active'?'Manage plan seats':'View plan seats';
  seatOptions.hidden=false;
  const panel=section('Plan seats',$('tools-seat-panel'));
  const url=new URL('/api/payments/seats',location.origin);
  url.searchParams.set('order',testOrder);
  const count=el('p','Loading seats…',panel);
  count.setAttribute('role','status');
  const message=el('p','',panel);
  message.setAttribute('role','status');
  const list=el('ul','',panel);
  const email=field(panel,'Member email address',254);
  email.type='email';
  const add=el('button','Assign or invite member',panel);
  add.type='button';
  const active=data.entitlement.state==='active';
  email.closest('label').hidden=!active;
  add.hidden=!active;
  let busy=false;
  async function update(change){
    if(busy)return;
    busy=true;
    add.disabled=true;
    for(const button of list.querySelectorAll('button'))button.disabled=true;
    try{
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store',
        ...(change?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(change)}:{})});
      let result=await response.json();
      let error='';
      if(!response.ok){
        error=result.error||'Seat access could not be verified.';
        if(!change)throw Error(error);
        const refresh=await fetch(url,{credentials:'same-origin',cache:'no-store'});
        if(!refresh.ok)throw Error(error);
        result=await refresh.json();
      }
      const pending=result.invitations||[];
      count.textContent=(result.members.length+1+pending.length)+' of '+result.seatLimit+' seats used, including your seat.'
        +(pending.length?' Pending invitations: '+pending.length+'.':'');
      message.textContent=error||result.notice||(change?.action==='add'?'Seat assigned. The member can sign in and open this plan.':'');
      list.replaceChildren();
      if(!error&&change?.action==='add')email.value='';
      for(const member of result.members){
        const item=el('li',member.email+' ',list);
        if(result.state!=='active')continue;
        const remove=el('button','Remove',item);
        remove.type='button';
        remove.setAttribute('aria-label','Remove '+member.email);
        remove.onclick=()=>update({action:'remove',member:member.id});
      }
      for(const invitation of pending){
        const item=el('li',invitation.email+' · '+(invitation.sent?'Invitation pending':'Delivery unconfirmed')+' ',list);
        if(result.state!=='active')continue;
        const cancel=el('button','Cancel invitation',item);
        cancel.type='button';
        cancel.setAttribute('aria-label','Cancel invitation for '+invitation.email);
        cancel.onclick=()=>update({action:'invite_cancel',member:invitation.id});
      }
    }catch(error){message.textContent=error.message;}
    finally{
      busy=false;
      add.disabled=false;
      for(const button of list.querySelectorAll('button'))button.disabled=false;
    }
  }
  add.onclick=()=>{if(email.reportValidity()&&email.value)update({action:'add',email:email.value});};
  el('p','People with a confirmed account can sign in straight away. New members receive an email invitation. A pending invitation reserves a seat for up to ten minutes. Inquiry files stay on each person’s device.',panel);
  update();
}
const reviewDates={
  receipt:'Written complaint received',commenced:'Verified inquiry commencement',
  firstMeeting:'First Committee meeting',completed:'Inquiry completed',
  reportSubmitted:'Report provided to employer or District Officer',
  partiesSupplied:'Report made available to parties',
  recommendationsReceived:'Recommendations received',implemented:'Action or implementation',
  conciliationRequested:'Conciliation requested',settled:'Settlement recorded',
  settlementForwarded:'Settlement forwarded',settlementCopies:'Settlement copies provided',
  breachReported:'Settlement breach reported'
};
function showReadOnly(){
  const panel=section('Review a saved inquiry',$('tools-review-panels'));
  el('p','Open a local Navigator recovery file to review it here. The file stays on this device and is never changed. Previously downloaded documents remain available on your device.',panel);
  const input=el('input','',el('label','Navigator recovery JSON',panel));
  input.type='file';
  input.accept='.json,application/json';
  const result=el('div','',panel);
  result.setAttribute('aria-live','polite');
  let previewRequest=0;
  const clearPreview=()=>{
    previewRequest++;
    input.value='';
    result.replaceChildren();
  };
  input.onchange=async()=>{
    const request=++previewRequest;
    result.replaceChildren();
    try{
      const current=await access();
      if(request!==previewRequest)return;
      if(current.entitlement?.state!=='read-only')throw Error('Read-only access could not be verified.');
      const file=input.files[0];
      if(!file||file.size>2_000_000)throw Error('Choose a Navigator recovery file up to 2 MB.');
      const text=await file.text();
      if(request!==previewRequest)return;
      const data=JSON.parse(text);
      if(data?.format!=='posh-navigator-session'||![1,2,3,4].includes(data.schemaVersion)||
        !data.workflow||!data.timeline)throw Error('Choose a saved Navigator inquiry recovery file.');
      el('h3','Saved inquiry at a glance',result);
      const route=data.timeline.route;
      if(route==='conciliation'||route==='inquiry')el('p',route==='conciliation'?'Recorded route · Conciliation':'Recorded route · Inquiry',result);
      const recorded=Object.entries(reviewDates).filter(([key])=>/^\d{4}-\d{2}-\d{2}$/.test(data.timeline.dates?.[key]||''));
      el('h4','Recorded milestone dates',result);
      if(recorded.length){
        const list=el('dl','',result);
        for(const [key,label] of recorded){
          el('dt',label,list);
          el('dd',data.timeline.dates[key],list);
        }
      }else el('p','No milestone dates are recorded in this file.',result);
      el('p','These dates come from your saved file. Confirm them against your Committee’s records.',result);
      el('h4','Detailed recovery record',result);
      for(const [label,value] of [['Inquiry workflow',data.workflow],['Timeline and history',data.timeline],['Evidence references',data.evidence],['Unsubmitted notes and references',data.drafts]]){
        if(!value)continue;
        const group=el('details','',result);
        el('summary',label,group);
        const pre=el('pre',JSON.stringify(value,null,2),group);
        pre.className='readonly-record';
      }
    }catch(error){if(request===previewRequest)el('p',error.message,result);}
  };
  return clearPreview;
}
access().then(data=>{
  $('tools-heading').textContent=data.label;
  $('tools-mode').textContent=data.test?'Staging test access · no real payment':'Verified plan access';
  const expiry=data.entitlement?.readOnlyUntil;
  const date=value=>new Intl.DateTimeFormat('en-IN',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(value))+' IST';
  status.textContent=data.test&&expiry?
    'Staging plan. Editing ends '+date(data.entitlement.ends_at)+'. Read-only access ends '+date(expiry)+'.':
    'Your plan tools are ready.';
  const content=$('tools-content');
  content.hidden=false;
  let clearPreview;
  if(data.test&&expiry){
    const state=data.entitlement.state;
    const boundary=Date.parse(state==='active'?data.entitlement.ends_at:expiry);
    let checkRequest=0;
    const lock=()=>{
      content.inert=true;
      clearPreview?.();
    };
    const recheck=async()=>{
      const request=++checkRequest;
      if(Date.now()>=boundary)lock();
      try{
        const current=await access();
        if(request!==checkRequest)return;
        if(current.entitlement?.state!==state)throw Error('Plan access changed.');
        if(state==='read-only'&&Date.now()>=boundary)throw Error('The read-only period has ended.');
        content.inert=false;
      }catch(error){
        if(request!==checkRequest)return;
        lock();
        status.textContent=error.message+' Reload to check your current access.';
      }
    };
    if(boundary-Date.now()<2147483647)setTimeout(recheck,Math.max(0,boundary-Date.now()));
    setInterval(recheck,60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)recheck();});
  }
  if(data.entitlement?.state==='read-only'){
    $('tools-editing-intro').hidden=true;
    status.textContent='Read-only access until '+date(expiry)+'. Editing and new draft creation have ended.';
    clearPreview=showReadOnly();
    showSeats(data);
    return;
  }
  $('tools-open-guided').href=guidedHref;
  $('tools-resume-guided').href=guidedHref+'#resume-inquiry';
  $('tools-start').hidden=false;
  $('tools-optional').hidden=false;
  let review;
  standardTools(data,()=>{
    const snapshot=review?.snapshot();
    if(!snapshot)return undefined;
    const completed=Object.values(snapshot.checks).filter(check=>check.ref&&['pass','not-applicable'].includes(check.status)).length;
    const gates=data.legalAudit.gates.map(gate=>[gate.title,snapshot.gates[gate.id].status,snapshot.gates[gate.id].ref||'[Gate record reference]']);
    return {completed,gates};
  });
  if(data.legalAudit&&window.NavigatorDefensibilityV4){
    const legal=section('IC/LC legal defensibility — Version 4.0');
    const target=el('div','',legal);
    review=window.NavigatorDefensibilityV4.mount(target,data.legalAudit,{id:'v4-plan-audit'});
  }
  const toolkit=section('POSH Readiness Toolkit');
  const toolkitItems=reviewList(toolkit,data.toolkit,true);
  exportButton(toolkit,'Download the readiness toolkit','POSH-Readiness-Toolkit',data.plan,toolkitItems);
  if(data.readiness)professionalTools(data);
  if(data.advanced)advancedTools(data);
  showSeats(data);
  const index=$('tools-index');
  el('h2','Tools in this plan',index);
  const list=el('ul','',index);
  for(const [i,panel] of Array.from($('tools-panels').children).entries()){
    panel.id='plan-tool-'+(i+1);
    link(el('li','',list),panel.querySelector('h2').textContent,'#'+panel.id);
  }
  index.hidden=false;
  link($('tools-sources'),'POSH Act on India Code',data.sources.act);
  $('tools-sources').append(' · ');
  link($('tools-sources'),'Central POSH Rules',data.sources.rules);
}).catch(error=>{status.textContent=error.message;});
})();
