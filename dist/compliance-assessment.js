(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const order=new URLSearchParams(location.search).get('order')||'';
  const endpoint='/api/compliance-assessment?order='+encodeURIComponent(order);
  const form=$('scope'), fields=form.elements;
  fields.year.max=new Intl.DateTimeFormat('en-IN',{year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date());
  let current=null,busy=false,selectedId=null,dirty=false;
  const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  function notice(text){$('notice').textContent=text;}
  async function api(body) {
    const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(20000),
      ...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    const data=await response.json();
    if(response.status===401)$('signin').hidden=false;
    if(!response.ok)throw Error(data.error||'The request could not be completed.');
    return data;
  }
  async function run(work) {
    if(busy)return;
    busy=true;
    try{await work();}catch(e){notice(e.message);}finally{busy=false;}
  }
  function refreshScope() {
    const hasSiteCount=fields.siteType.value!=='standalone';
    $('site-workers').hidden=!hasSiteCount; fields.siteWorkers.required=hasSiteCount;
    fields.siteWorkers.disabled=!hasSiteCount;
    fields.siteWorkers.max=fields.workers.value===''?'10000000':fields.workers.value;
    const company=fields.employer.value==='company';
    for(const node of document.querySelectorAll('[data-company]'))node.hidden=!company;
    fields.mca.required=fields.listed.required=company;
    fields.sebi.required=company&&fields.listed.value==='Yes';$('sebi').hidden=!fields.sebi.required;
    $('route-preview').textContent=fields.workers.value===''?'':Number(fields.workers.value)>=10?
      'IC route. A complaint against the employer uses the district LC route.':
      'LC route. IC-only checks are excluded.';
  }
  form.addEventListener('input',refreshScope);
  form.onsubmit=e=>{
    e.preventDefault();
    run(async()=>{
      const yes=name=>fields[name].value==='Yes';
      const scope={workplace:fields.workplace.value,district:fields.district.value,year:Number(fields.year.value),workers:Number(fields.workers.value),
        siteType:fields.siteType.value,siteWorkers:fields.siteWorkers.disabled||fields.siteWorkers.value===''?null:Number(fields.siteWorkers.value),
        complaints:yes('complaints'),employer:fields.employer.value,listed:yes('listed'),mca:yes('mca'),sebi:yes('sebi')};
      render(await api({action:'start',scope}));notice('Assessment started. Save each answer before moving on.');
    });
  };
  function input(label,type,value,max) {
    const wrap=el('label',label),node=el(type==='textarea'?'textarea':'input');
    if(type!=='textarea')node.type=type;
    if(max)node.maxLength=max;
    node.value=value||'';wrap.append(node);return {wrap,node};
  }
  function questionLabel(q){
    const parent=q.parentId&&current.review.applicable.find(item=>item.id===q.parentId);
    return parent?parent.title+' · '+q.title:q.title;
  }
  // Fictional examples. Each entry pairs a record with a check-specific evidence gap.
  const evidenceSamples={
    1:['Signed IC constitution order IC-01, current version.','a signed current IC constitution order'],
    2:['IC order IC-01 and HR role record PO-01, checked against the appointment.','the Presiding Officer’s designation or eligibility record'],
    3:['IC order IC-01, employee-member entries 2 and 3.','appointment records for both employee members'],
    4:['External member appointment EM-01, eligibility note and fee approval.','the external member’s eligibility or engagement record'],
    5:['IC roster v2, composition check recorded in ROSTER-01.','a current roster showing the committee composition'],
    6:['IC appointment and tenure tracker IC-TENURE-01, reviewed this quarter.','current appointment, term or replacement records'],
    7:['Main staff entrance display photo DISPLAY-01, showing the signed IC order.','a dated display record for the current signed IC order'],
    8:['District LC contact source LC-01 and dated workplace notice DISPLAY-02.','a verified district LC contact and a staff notice showing how to reach it'],
    9:['Approved POSH Policy v3 and management approval POL-03.','an approved current POSH policy'],
    10:['POSH Policy v3, HR intranet and staff noticeboard, checked this quarter.','proof workers can access the current policy'],
    11:['Awareness session AW-02, agenda and attendance log by shift.','awareness attendance evidence covering all relevant shifts and locations'],
    12:['IC orientation OR-01, agenda and member attendance record.','orientation or refresher evidence for the relevant IC members'],
    13:['Staff noticeboard display photo DISPLAY-03, showing the penal consequences notice.','a dated display record for the penal consequences notice'],
    14:['New-joiner induction deck v2, conduct and reporting slides, and completion log IND-04 for the October batch.','evidence that new joiners were briefed on expected conduct and where to report concerns'],
    15:['Vendor onboarding pack VEND-02, reporting notice and briefing acknowledgement.','a reporting notice or briefing record for the relevant third parties'],
    16:['Restricted filing-time review entry TIM-01, with any extension decision reference.','the filing-time assessment or documented extension decision'],
    17:['Reporting procedure REP-01, private channel details and assistance instructions.','instructions for using the private complaint channel and requesting writing assistance'],
    18:['Restricted receipt and service log SERV-01, with acknowledgement reference.','the receipt or service acknowledgement'],
    19:['Restricted conciliation checklist CON-01 and request and settlement references.','the request, timing or settlement-basis verification record'],
    20:['Restricted interim relief register REL-01 and implementation acknowledgement.','the interim relief decision or implementation record'],
    21:['Restricted inquiry milestone tracker INQ-01, reviewed against the completion date.','the dated inquiry milestones or verified completion record'],
    22:['Restricted findings report dispatch register FIND-01, acknowledgements recorded.','dated delivery evidence for the report recipients'],
    23:['Restricted action tracker IMPL-01 and appeal communication reference.','proof of implementation or communication of the applicable appeal route'],
    24:['Restricted folder access review SEC-01 and retaliation reporting procedure.','a current access review or a safe retaliation reporting route'],
    25:['Restricted safeguards review SAFE-01 and decision reference.','a record showing the statutory safeguards were considered'],
    26:['IC annual report dispatch EMP-01 and employer acknowledgement.','the employer’s dated acknowledgement for the review-year report'],
    27:['IC annual report filing DO-01 and District Officer receipt.','the District Officer’s dated receipt for the review-year report'],
    28:['IC annual report AR-01 and reconciliation worksheet AR-CHECK-01.','reconciliation of the annual report figures against the underlying records'],
    29:['Employer disclosure EMP-AR-01, relevant page or district intimation receipt.','the applicable employer disclosure or district intimation record'],
    30:['Records custody note CUST-01 and restricted access list.','a named records custodian or documented access controls'],
    31:['Workplace risk review RISK-02 and corrective-action tracker.','the workplace risk review or evidence of action on identified risks'],
    32:['Reporting contacts notice CONTACT-01, checked against the current committee or district listing.','a current notice with verified reporting contacts'],
    33:['Management support procedure SUP-01 and restricted request log.','a documented process for providing space, information or attendance support'],
    34:['Restricted assistance register ASSIST-01 and support action reference.','a restricted record of the assistance considered or provided'],
    35:['Applicable service rules v2, misconduct clause, and approval reference SR-02.','the applicable misconduct clause or disciplinary procedure'],
    36:['Gap tracker ACT-01 with assigned roles, target dates and closure checks.','an owner, target date or closure check for an identified gap'],
    37:['Remote-work reporting guide REM-01 and staff circulation record.','reporting guidance for work-related messages, calls or remote work'],
    38:['Work-event safety briefing EVT-01 and transport or reporting instructions.','a relevant event or travel safety and reporting briefing'],
    39:['Site coverage register SITE-01 and applicable IC order or district LC reference.','verified committee coverage or the complaint route for each location'],
    40:['Workforce coverage matrix WORK-01 and policy or training distribution log.','proof the relevant trainees and contract staff are covered'],
    41:['Member eligibility review MEM-02 and replacement order, where needed.','the member eligibility review or replacement appointment'],
    42:['Restricted conflict-of-interest check COI-01 and recusal record, where applicable.','the committee conflict check or recusal record'],
    43:['Awareness agenda AW-03 and reference to the applicable State Government module.','a record linking the session materials to the applicable State Government module'],
    44:['Website reporting page WEB-01, dated screenshot and verified contact source.','the current website reporting details or evidence of when they were checked'],
    45:['Restricted procedure checklist PROC-01 and records showing both sides could respond.','the applicable procedure or records showing both parties had an opportunity to respond'],
    46:['Restricted hearing attendance sheets QUORUM-01, checked against Rule 7.','hearing attendance records sufficient to verify quorum'],
    47:['Restricted hearing and notice register ABS-01 with dated service acknowledgement.','the absence record or proof of advance notice'],
    48:['Restricted settlement follow-up log SET-01 and breach response reference, if applicable.','evidence that settlement terms or any reported breach were tracked'],
    49:['Restricted findings review DEC-01 and applicable action or compensation reference.','recorded reasons or a documented review of the applicable action and compensation rules'],
    50:['District filing direction DIST-01, with review year, deadline and accepted channel noted.','the current district filing direction and accepted channel'],
    51:['Restricted protective-action log PROTECT-01, with follow-up review reference.','the restricted assessment or follow-up on a reported retaliation concern'],
    52:['Applicability register DIR-01, with official source and effective date.','the current sector, state or district applicability review'],
    53:['Restricted routing decision ROUTE-01, with jurisdiction review reference.','a documented decision identifying the responsible employer or committee'],
    54:['Restricted procedure review R7-01, with filing and representation checks.','the applicable filing or representation checks'],
    55:['Official request register REQ-01 and secure response reference.','the written authority, deadline or response record for the request'],
    56:['Restricted safeguarding reporting acknowledgement SAFE-02.','a restricted record confirming the report was made through the applicable channel'],
    57:['Applicable company disclosure DISC-01 and filing receipt or published report reference.','evidence of each applicable company or listed-entity disclosure'],
    58:['Awareness session AW-02 and dated trainer empanelment verification.','trainer empanelment verification for the awareness session date'],
    59:['IC orientation OR-01 and dated facilitator empanelment verification.','facilitator empanelment verification for the IC training date'],
    60:['SHe-Box Head Office approval acknowledgement SHE-HO-01.','the SHe-Box Head Office approval acknowledgement'],
    61:['SHe-Box branch mapping confirmation SHE-BR-01 under the Head Office profile.','proof the branch is mapped to the Head Office profile'],
    62:['Current SHe-Box IC entry screenshot SHE-IC-01 and approval reference.','evidence the current IC entry was updated on the portal'],
    63:['SHe-Box compliance submission receipt SHE-COMP-01 for the applicable review period.','the applicable SHe-Box compliance submission records'],
    64:['District Officer receipt DO-IC-01 for the current signed IC order.','evidence that the current IC order was sent through the applicable district channel']
  };
  const nonTriggerSamples={
    19:'No conciliation request was recorded before inquiry. Restricted intake register checked.',
    20:'No interim relief request arose in the cases reviewed. Restricted request log checked.',
    21:'No inquiry reached the stage at which this timing check applies. Restricted milestone log checked.',
    22:'No findings report became due during the review period. Restricted milestone log checked.',
    23:'No recommendation requiring implementation arose during the review period. Restricted action register checked.',
    25:'No potential malicious complaint or false evidence issue was identified. Restricted case register checked.',
    34:'No circumstance requiring criminal reporting assistance arose in the review period. Restricted assistance log checked.',
    38:'No relevant work travel, transport arrangement or work event occurred in the review period. Operations register checked.',
    42:'No case was handled by this committee during the review period. Restricted register checked.',
    44:'No website is operated. The applicable directions were reviewed for any publication requirement.',
    45:'No inquiry began during the review period. Restricted milestone log checked.',
    46:'No hearing in the review period was governed by Rule 7. Procedure review reference recorded.',
    47:'Termination or proceeding in a party’s absence was never considered. Restricted hearing log checked.',
    48:'No conciliation terms were recorded during the review period. Restricted settlement log checked.',
    49:'No inquiry reached findings during the review period. Restricted milestone log checked.',
    51:'No retaliation or interference concern was recorded. Restricted concern register checked.',
    54:'No procedure governed by Rule 7 applied to the cases reviewed. Procedure review reference recorded.',
    55:'No official information request or authorised inspection was received. Requests register checked.',
    56:'No information triggering this reporting check came to light in the review period. Safeguarding review recorded.',
    58:'No applicable direction or adopted policy required an empanelled awareness trainer for the session. Source review recorded.',
    59:'No applicable direction or adopted policy required an empanelled IC trainer for the session. Source review recorded.',
    60:'Head Office onboarding was assessed as outside this review’s applicable portal requirements. Applicability review recorded.',
    61:'Branch mapping was assessed as outside the applicable portal requirements for this review. Applicability review recorded.',
    62:'This portal update was assessed as outside the applicable requirements for this review. Applicability review recorded.',
    63:'No applicable portal submission was triggered for this review period. Applicability review recorded.',
    64:'The applicable district directions were checked. No order submission was required for this review.'
  };
  function evidenceExample(q,value,route){
    if(!value)return 'Select an answer to see an example.';
    const tailored=q.referenceExamples?.[value];
    if(tailored)return 'Example only · '+tailored;
    const examples={
      10:{No:'Workers can only find the previous policy version on the noticeboard.',Partly:'The updated policy is on the intranet. The noticeboard still shows the earlier version.', 'Not sure':'The current policy is in the HR folder. I still need to verify whether workers can access it.'},
      14:{No:'The induction materials do not cover expected conduct or where to report concerns.',Partly:'The October induction deck covers expected conduct. It does not show the reporting channel.', 'Not sure':'I have the induction agenda. I still need to check the slides for the reporting channel and verify the completion log.'}
    };
    if(examples[q.id]?.[value])return 'Example only · '+examples[q.id][value];
    let sample;
    if(value==='Not triggered')sample=nonTriggerSamples[q.id]||'Applicability review recorded. Note which condition did not arise and the record used to confirm it.';
    else if(q.parentId){
      const verify=q.title==='Verification follow-up';
      const task=verify?'verification request':'corrective action assignment';
      const subject=questionLabel(q).split(' · ')[0];
      sample=value==='Yes'?'Action tracker ACT-01, '+subject+' '+task+'. Owner: HR Lead. Target date recorded.':
        value==='Partly'?'Action tracker ACT-01 lists '+subject+'. The owner is recorded and the target date is pending.':
        value==='No'?'No '+task+' is recorded for '+subject+' in the action tracker.':
        'Check whether the '+task+' for '+subject+' was entered in the action tracker.';
    }else{
      const scoped=q.id===44?(route==='LC'?['Website reporting page WEB-LC-01, dated screenshot and verified district LC contact source.','the current district LC contact and complaint instructions on the website']:['Website reporting page WEB-IC-01, dated screenshot and current IC contact details.','current IC and complaint reporting details on the website']):null;
      const [record,gap]=scoped||evidenceSamples[q.id]||['The dated record or register entry that supports this check.','a record that confirms this check'];
      sample=value==='Yes'?record:value==='No'?'No record found for '+gap+'.':
        value==='Partly'?'Some records are available. Still to confirm: '+gap+'.':'I need to verify '+gap+' before confirming.';
    }
    return 'Example only · '+sample;
  }

  function renderChecks(focus=false) {
    const list=$('checks');list.replaceChildren();
    for(const q of current.review.applicable.filter(q=>current.final||q.id===selectedId)) {
      const card=el('article');card.className='assessment-card';
      card.id='check-'+q.id;
      const title=el('h3',q.question);title.tabIndex=-1;
      const meta=el('p',q.topic+' · '+q.priority+' · '+q.authority);meta.className='check-meta';
      card.append(title,meta,el('p','What to look for: '+q.proof));
      if(q.referenceNote&&!current.final)card.append(el('p',q.referenceNote));
      if(q.id===11)card.append(el('p','Regular worker awareness applies on both the IC and LC routes, including establishments with fewer than 10 workers. IC member orientation is a separate check.'));
      const next=el('p',q.next);next.className='next';card.append(next);
      if(current.final) {
        const a=q.answer;
        card.append(el('p',a.value+(a.evidence?' · '+a.evidence:'')));
        if(a.owner||a.due)card.append(el('p','Owner: '+(a.owner||'Unassigned')+' · Target: '+(a.due||'Unset')));
      }else{
        const entry=el('form'),grid=el('div');grid.className='assessment-grid';
        const label=el('label','Answer'), answer=el('select');answer.required=true;
        answer.append(new Option('Choose',''));
        for(const option of ['Yes','Partly','No','Not sure',...(q.conditional?['Not triggered']:[])])answer.append(new Option(option,option));
        answer.value=q.answer?.value||'';label.append(answer);
        const proof=input('Record reference or reason','textarea',q.answer?.evidence,300);
        const example=el('small');example.id='evidence-example-'+q.id;
        proof.node.setAttribute('aria-describedby',example.id);proof.wrap.append(example);
        const reviewer=input('Exclusion reviewer role','text',q.answer?.reviewer,80);
        const owner=input('Action owner or role','text',q.answer?.owner,80), due=input('Target date','date',q.answer?.due);
        grid.append(label,proof.wrap,reviewer.wrap,owner.wrap,due.wrap);
        function guidance(){
          const value=answer.value, excluded=value==='Not triggered', issue=['Partly','No','Not sure'].includes(value);
          reviewer.wrap.hidden=!excluded;reviewer.node.required=excluded;proof.node.required=excluded||value==='Yes';
          owner.wrap.hidden=due.wrap.hidden=!issue;
          example.textContent=evidenceExample(q,value,current.scope.route);
          const latest=current.review.applicable.find(item=>item.id===q.id);
          next.textContent=latest.blocked&&value!=='Not triggered'?latest.next:issue?(value==='Not sure'?'Verify the facts and collect evidence. ':'')+q.action:
            value==='Yes'?'Enter a short reference to the record you checked.':
            excluded?'Record why the condition did not arise and who reviewed it.':q.next;
        }
        answer.onchange=guidance;guidance();
        const save=el('button','Save and continue');save.className='button';save.type='submit';
        entry.append(grid,save);card.append(entry);
        entry.oninput=()=>{dirty=true;};
        entry.onsubmit=e=>{e.preventDefault();run(async()=>{
          const saved=await api({action:'save',id:q.id,revision:current.revision,answer:{value:answer.value,
            evidence:proof.node.value,reviewer:reviewer.node.value,owner:owner.wrap.hidden?'':owner.node.value,due:due.wrap.hidden?'':due.node.value}});
          const items=saved.review.applicable, at=items.findIndex(item=>item.id===q.id);
          selectedId=(items.slice(at+1).find(item=>!item.answer)||items.find(item=>!item.answer))?.id??q.id;
          render(saved,true);
          notice(saved.review.remaining?'Answer saved. The next applicable question is ready.':'All applicable questions are saved. Review the actions, then finalise.');
        });};
      }
      list.append(card);
      if(focus&&!current.final)title.focus();
    }
  }
  function updateProgress() {
    const v=current.review;
    $('progress').textContent=(v.applicable.length-v.remaining)+' of '+v.applicable.length+' answered · '+v.open+' open actions';
    $('finish').disabled=!!v.remaining;
  }
  function render(state,focus=false) {
    current=state;dirty=false;form.hidden=!!state.scope;$('review').hidden=!state.scope;
    if(!state.scope){fields.year.value=fields.year.max;refreshScope();return;}
    const s=state.scope;
    $('scope-label').textContent=state.organisation+' · '+s.workplace+' · '+s.district+' · '+s.year+' · '+s.route+' route';
    const items=state.review.applicable, navigation=$('question-nav');
    if(!items.some(q=>q.id===selectedId))selectedId=(items.find(q=>!q.answer)||items[0])?.id??null;
    navigation.replaceChildren(...items.map(q=>new Option(questionLabel(q)+(q.answer?' · Saved':''),String(q.id))));
    navigation.value=String(selectedId);
    $('filter-label').hidden=state.final;
    const rank={Critical:0,High:1,Medium:2,Low:3};
    const actions=items.filter(q=>q.answer&&(q.blocked||!['Yes','Not triggered'].includes(q.answer.value)))
      .sort((a,b)=>(rank[a.priority]??4)-(rank[b.priority]??4));
    $('actions-label').textContent='Management action summary ('+actions.length+')';
    $('actions').replaceChildren(...actions.map(q=>el('li',questionLabel(q)+' · '+q.priority+' · '+q.next+' Owner: '+(q.answer.owner||'Unassigned')+' · Target: '+(q.answer.due||'Unset'))));
    $('excluded-label').textContent='Excluded by setup ('+state.review.excluded.length+')';
    $('excluded').replaceChildren(...state.review.excluded.map(q=>el('li',q.title+' — '+q.reason)));
    $('finish').hidden=state.final;$('report').hidden=!state.final;
    if(state.final){$('report').href='/api/compliance-assessment/report?order='+encodeURIComponent(order);$('final-note').textContent='This assessment is final. Download the same report from this order whenever you need it.';}
    updateProgress();renderChecks(focus);
  }
  $('question-nav').onchange=e=>{
    if(dirty&&!confirm('Leave this question and discard its unsaved edits?')){e.target.value=String(selectedId);return;}
    dirty=false;selectedId=Number(e.target.value);renderChecks(true);
  };
  $('reload').onclick=()=>run(async()=>{if(!confirm('Reload saved answers? Unsaved edits on this page will be discarded.'))return;render(await api());notice('Saved assessment loaded.');});
  $('finish').onclick=()=>run(async()=>{
    if(!confirm('Finalise the saved answers and lock this assessment? Unsaved edits will be omitted.'))return;
    render(await api({action:'finish',revision:current.revision}));notice('Assessment finalised. Your PDF is ready.');
  });
  run(async()=>{render(await api());notice(current.scope?'Saved assessment loaded.':'Verify the scope before starting.');});
})();

