(function(root){
'use strict';
const {choices,merits,assemble,depthFor,caseDetail,allegationDetail}=root.PoshReportAssembly;
const options=entries=>[['','Select if known'],...Object.entries(entries)];
const yesNo=options({yes:'Yes',no:'No'});
const fields={
  reference:'Case reference', institution:'Institution or district', complainant:'Aggrieved woman code', respondent:'Respondent code',
  forum:['Committee',options({IC:'Internal Committee',LC:'Local Committee'})],
  employment:['Employment relationship',options({same:'Both employees · same employer',different:'Both employees · separate employers',one:'Only one party is an employee',neither:'Neither party is an employee'})],
  path:['Section 11 pathway',options({employee:'Employee respondent',domestic:'Domestic-worker complaint', 'third-party':'Third-party respondent'})],
  procedure:['Governing procedure',options({service:'Respondent’s service rules',prescribed:'Prescribed procedure',special:'Special service or sector rules'})],
  authority:'Constitution, member eligibility, recusal, workplace nexus and forum competence',
  complainantEmployer:'Aggrieved woman employer code', respondentEmployer:'Respondent or common employer code', coordination:'Inter-employer authority, limited disclosure and implementation',
  statusReasons:'Party status and independent procedural rights', rules:'Controlling instrument, clauses and applicability', domesticBasis:'Domestic work, remuneration, and dwelling basis',
  referralDecision:'Prima facie determination and reasons', referral:'Referral, receipt, governing provisions and reasons',
  incident:['Incident or last incident date','date'],received:['Complaint receipt date','date'], limitation:'Limitation, notified scope and any extension',
  settlement:['Section 10 status',options({none:'No completed settlement',completed:'Settlement reached',breach:'Settlement breach reported'})],
  settlementRecord:'Request, terms or reported breach', settlementDelivery:'Settlement delivery and implementation',
  routeDecision:'Reasons, disposition and onward action',
  commenced:['Commencement date','date'],completed:['Inquiry completion date','date'], fairness:'Service, receipt, reply, hearings, quorum, disclosure, questioning and objections',
  absence:['Absence decision in scope',yesNo],absenceRecord:'Consecutive absences, notice, service and reasoned decision',
  interim:['Section 12 written request in scope',yesNo],interimRecord:'Written request, recommendation and employer implementation',
  representations:'Communication of findings, opportunity, representations and consideration',
  remedy:'Misconduct recommendation, applicable rule and reasons',compensation:'Section 15 factors and compensation/recovery determination',
  malice:['Separate Section 14 determination in scope',yesNo],maliceRecord:'Separate inquiry, procedural safeguards and reasons',
  timingReasons:'Timing exception, statutory trigger and reasons',
  specialAuthority:'Disciplinary or sector authority and relationship to Section 13',
  section13:['Section 13 recommendations and delivery',options({included:'Included in this report',separate:'Recorded in a separate statutory report'})],
  separateDisposition:'Disposition, competent authority, delivery and appeal under governing instrument',
  noEvidence:['No separate exhibits',options({confirmed:'Confirmed in the record'})], noWitnesses:['No additional witnesses',options({confirmed:'Confirmed in the record'})],
  recipient:'Employer or District Officer',issued:['Dispatch date','date'],recipientReceipt:['Recipient receipt date','date'],
  partyService:['Party communication date','date'],appeal:'Appeal forum, procedure and recommendation date',
  signoff:'Committee members, authorisation and signature/date record',custody:'Restricted custody and access record'
};
const schemas={
  allegations:{title:'Allegation label',scope:'Notified facts, date, workplace and notice reference',complainant:'Aggrieved woman’s account',respondent:'Respondent’s account',conduct:['Section 2(n) clause',options(choices.conduct)],elements:'Conduct, sexual nature and unwelcomeness reasons',circumstance:['Section 3(2) circumstance',[['','Section 2(n) only'],...Object.entries(choices.circumstance)]],nexus:'Circumstance and connection to alleged conduct',support:'Supporting exhibit/witness IDs (comma-separated)',contrary:'Contrary exhibit/witness IDs (comma-separated)',weight:'Weight, contradictions, missing material, alternative explanations and applicable standard',outcome:['Finding',options(choices.outcome)],reasons:'Finding reasons and precise scope'},
  evidence:{title:'Description',type:['Evidence type',options(choices.evidence)],status:['Status',options({held:'Held',disputed:'Disputed',missing:'Missing'})],source:'Source, submitter and receipt',authenticity:'Authenticity, provenance and verification',custody:'Original custodian and transfer/access record',dispute:'Objection or production attempts and effect',annexure:'Annexure file or folio reference'},
  witnesses:{name:'Witness code',source:['Called by',Object.entries(choices.source).filter(([key])=>key!=='other')],hearing:'Examination date and mode',statement:'Statement including firsthand and reported knowledge',questions:'Questions, answers and corrections',confirmation:'Confirmation, signature date and statement file reference'}
};
function mount(host,config={}){
  const depth=depthFor(config.plan);
  host.classList.add('posh-report-assembly');
  const state=config.state||{route:'statutory',allegations:[],evidence:[],witnesses:[]};
  const el=(tag,parent,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
  const control=(host,key,spec,data,changed)=>{
    const [label,format]=Array.isArray(spec)?spec:[spec];
    const group=el('label',host,label);
    group.className='posh-report-field';
    const input=el(Array.isArray(format)?'select':format==='date'?'input':'textarea',group);
    if(Array.isArray(format)){
      for(const [value,description] of format)el('option',input,description).value=value;
    }else if(format==='date'){
      input.type='date';
    }else{
      input.rows=2;
      input.maxLength=4000;
    }
    input.autocomplete='off';
    if(data[key]!==undefined)input.value=data[key];
    else data[key]=input.value;
    input.oninput=()=>{data[key]=input.value;changed?.();};
    return group;
  };
  el('p',host,'Use case codes and controlled record references. Entries stay in this page and the Word download. Add one row for each notified allegation, evidence item and witness.');
  const routes=config.routes||Object.entries(choices.route);
  const reportNote=el('p',host);
  const refresh=()=>{
    const meritsRoute=merits.has(state.route), final=meritsRoute&&state.route!=='preliminary';
    const proved=state.allegations.some(a=>['proved','partial'].includes(a.outcome));
    const visible={
      procedure:state.path==='employee',rules:!['domestic','third-party'].includes(state.path),
      complainantEmployer:state.employment==='different',respondentEmployer:['same','different'].includes(state.employment),
      coordination:state.employment==='different',statusReasons:!['same','different'].includes(state.employment),
      domesticBasis:state.path==='domestic',referralDecision:state.path==='domestic',referral:['domestic','third-party'].includes(state.path),
      settlementRecord:['completed','breach'].includes(state.settlement),settlementDelivery:state.settlement==='completed',
      routeDecision:state.route==='jurisdiction'||(state.route==='referral'&&!['domestic','third-party'].includes(state.path)),
      commenced:meritsRoute,completed:final,fairness:meritsRoute,absence:meritsRoute,absenceRecord:meritsRoute&&state.absence==='yes',
      interim:meritsRoute,interimRecord:meritsRoute&&state.interim==='yes',representations:meritsRoute,
      specialAuthority:final&&state.route!=='statutory',section13:final&&state.route!=='statutory',
      separateDisposition:final&&state.route!=='statutory'&&state.section13==='separate',
      noEvidence:!state.evidence.length,noWitnesses:!state.witnesses.length,timingReasons:final,
      remedy:final&&proved&&state.section13!=='separate',compensation:final&&proved&&state.section13!=='separate',malice:final,maliceRecord:final&&state.malice==='yes',
      recipient:final&&state.section13!=='separate',issued:final&&state.section13!=='separate',recipientReceipt:final&&state.section13!=='separate',partyService:final&&state.section13!=='separate',appeal:final&&state.section13!=='separate'
    };
    for(const [key,row] of Object.entries(controls))row.hidden=visible[key]===false;
    for(const [level,key,,,applies] of caseDetail)if(depth>=level)controls[key].hidden=!applies(state);
    registers.allegations.hidden=!meritsRoute;
    reportNote.textContent=config.notes?.[state.route]||'';
  };
  control(host,'route',['Report pathway',routes],state,refresh);
  const details=el('details',host);
  el('summary',details,'Case particulars and procedure');
  const caseFields={...fields,...Object.fromEntries(caseDetail.filter(([level])=>depth>=level).map(([,key,label,prompt])=>[key,label+' — '+prompt]))};
  const controls=Object.fromEntries(Object.entries(caseFields).map(([key,spec])=>[key,control(details,key,spec,state,refresh)]));
  const registers={};
  for(const [key,label,prefix] of [['allegations','Notified allegations','A'],['evidence','Evidence items','E'],['witnesses','Witnesses','W']]){
    const box=el('fieldset',host);
    registers[key]=box;
    el('legend',box,label);
    const count=el('p',box);
    const rows=el('div',box);
    const add=el('button',box,'Add '+{allegations:'allegation',evidence:'evidence item',witnesses:'witness'}[key]);
    add.type='button';
    let sequence=Math.max(0,...state[key].map(row=>Number(row.id.split('-').at(-1))||0));
    const updateCount=()=>{count.textContent=state[key].length+' recorded';add.disabled=state[key].length>=100;};
    const render=row=>{
      const entry=el('details',rows);
      el('summary',entry,row.id);
      const schema={...schemas[key]};
      if(key==='allegations')for(const [level,field,label,prompt] of allegationDetail)if(depth>=level)schema[field]=label+' — '+prompt;
      const local=Object.fromEntries(Object.entries(schema).map(([field,spec])=>[field,control(entry,field,spec,row,()=>{relevance();refresh();})]));
      function relevance(){
        if(key==='allegations')local.nexus.hidden=!row.circumstance;
        if(key==='evidence'){
          for(const field of ['authenticity','custody','annexure'])local[field].hidden=row.status==='missing';
          local.dispute.hidden=row.status==='held';
        }
      }
      relevance();
      const remove=el('button',entry,'Remove '+row.id);
      remove.type='button';
      remove.onclick=()=>{state[key].splice(state[key].indexOf(row),1);entry.remove();updateCount();refresh();add.focus();};
      return entry;
    };
    state[key].forEach(render);
    add.onclick=()=>{
      const row={id:prefix+'-'+String(++sequence).padStart(3,'0')};
      state[key].push(row);
      const entry=render(row);
      entry.open=true;
      entry.querySelector('input, select, textarea')?.focus();
      updateCount();refresh();
    };
    updateCount();
  }
  const download=el('button',host,'Download editable Word report');
  download.type='button';
  download.className='button';
  const status=el('p',host);
  status.setAttribute('role','status');
  download.onclick=()=>{
    try{
      const report={...state,...Object.fromEntries(Object.entries(config.dates?.()||{}).filter(([key,value])=>value&&!state[key]))};
      report.plan=config.plan;
      if(report.route==='statutory')report.section13='included';
      report.audit=config.audit?.();
      report.indexedReferences=config.indexedReferences?.();
      if(!merits.has(report.route))report.allegations=[];
      const body=assemble(report);
      const items=config.appendEvidence?.(body)||body;
      const title=items[0].text;
      const bytes=root.NavigatorDocx.buildDocx(title,items,{workflow:true,caseReport:true});
      if(config.record?.()===false)throw Error('The download could not be recorded. Check the timeline and try again.');
      root.NavigatorDocx.download('POSH-'+report.route+'-report.docx',bytes);
      status.textContent='Editable Word report downloaded for Committee verification.';
      config.downloaded?.();
    }catch(error){status.textContent=error.message;}
  };
  refresh();
}
root.PoshReportAssemblyUI={mount};
})(window);
