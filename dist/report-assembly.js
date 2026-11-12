(function(root){
'use strict';
const choices = {
  conduct: {i:'physical contact and advances', ii:'demand or request for sexual favours', iii:'sexually coloured remarks', iv:'showing pornography', v:'other unwelcome physical, verbal or non-verbal conduct of a sexual nature'},
  circumstance: {i:'promise of preferential employment treatment', ii:'threat of detrimental employment treatment', iii:'threat about present or future employment status', iv:'work interference or an intimidating, offensive or hostile work environment', v:'humiliating treatment likely to affect health or safety', other:'another connected circumstance'},
  source: {complainant:'Aggrieved woman', respondent:'Respondent', committee:'Committee', other:'Other source'},
  evidence: {document:'Document', message:'Message or email', media:'Photo, audio, video or CCTV', system:'System or access record', physical:'Physical item', other:'Other'},
  outcome: {proved:'Proved', 'not-proved':'Not proved', partial:'Proved in part', pending:'Pending determination'},
  route: {statutory:'Section 13 inquiry report', preliminary:'Provisional findings for representations', disciplinary:'Disciplinary inquiry record', special:'Special-regime inquiry record', jurisdiction:'Jurisdiction and maintainability decision', conciliation:'Section 10 settlement record', referral:'Referral record'}
};
const merits = new Set(['statutory','preliminary','disciplinary','special']);
const disposition = new Set(['statutory','disciplinary','special']);
const get = (value,label) => String(value ?? '').trim() || '['+label+']';
const recordId = /^[A-Z][A-Z0-9-]{0,23}$/;
const has = (map,key) => Object.hasOwn(map,key);
const table = rows => ({type:'table',rows});
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
function validate(c){
  const errors=[];
  const need=(condition,message)=>{if(!condition)errors.push(message);};
  const lists=[c.allegations,c.evidence,c.witnesses];
  need(lists.every(list=>Array.isArray(list)&&list.length<=100),'Each register must be a list of up to 100 entries.');
  if(errors.length)return errors;
  need(has(choices.route,c.route),'Select a report pathway.');
  need(['IC','LC',''].includes(c.forum),'Select a valid Committee.');
  need(['same','different','one','neither',''].includes(c.employment),'Select a valid employment relationship.');
  need(['employee','third-party','domestic',''].includes(c.path),'Select a valid Section 11 pathway.');
  need(!(['same','different'].includes(c.employment)&&c.path==='third-party'),'The respondent cannot be both an employee and a third party.');
  need(!(c.employment==='neither'&&c.path==='employee'),'The respondent cannot be an employee when neither party is employed.');
  need(!(c.path==='domestic'&&(c.forum==='IC'||merits.has(c.route))),'Use the Local Committee and a referral or other applicable non-merits record for the domestic-worker pathway.');
  need(!(c.path==='third-party'&&merits.has(c.route)),'Select a jurisdiction or referral record for the third-party pathway.');
  need(!(c.settlement==='completed'&&merits.has(c.route)),'Use the conciliation record for a subsisting Section 10 settlement.');
  need(c.route!=='conciliation'||c.settlement==='completed','Confirm that a Section 10 settlement was reached for a settlement record.');
  need(['','service','prescribed','special',undefined].includes(c.procedure),'Select a valid procedure.');
  need(['','none','completed','breach',undefined].includes(c.settlement),'Select a valid settlement status.');
  need(!(c.employment==='different'&&c.complainantEmployer?.trim()&&c.complainantEmployer.trim().toLowerCase()===c.respondentEmployer?.trim().toLowerCase()),'Separate employers must have distinct identifiers.');
  need(!merits.has(c.route)||c.allegations.length>0,'Add each notified allegation separately.');
  const ids=new Set();
  for(const entry of lists.flat()){
    if(!entry||typeof entry!=='object'){errors.push('Each register entry must be a record.');continue;}
    need(recordId.test(entry.id||'')&&!ids.has(entry.id),'Record identifiers must be unique across all registers.');
    ids.add(entry.id);
  }
  if(errors.length)return errors;
  const references=new Set([...c.evidence,...c.witnesses].map(row=>row.id).concat(c.indexedReferences||[]));
  for(const a of c.allegations){
    need(!a.conduct||has(choices.conduct,a.conduct),a.id+' has an invalid Section 2(n) clause.');
    need(!a.circumstance||has(choices.circumstance,a.circumstance),a.id+' has an invalid Section 3(2) selection.');
    need(!a.outcome||has(choices.outcome,a.outcome),a.id+' has an invalid finding status.');
    for(const id of [a.support,a.contrary].flatMap(refs=>String(refs||'').replace(/^\s*none\s*$/i,'').split(/[\s,]+/).filter(Boolean)))
      need(references.has(id),a.id+' references an unknown exhibit or witness: '+id+'.');
  }
  for(const e of c.evidence){
    need(!e.status||['held','disputed','missing'].includes(e.status),e.id+' has an invalid evidence status.');
    need(!e.type||has(choices.evidence,e.type),e.id+' has an invalid evidence type.');
  }
  for(const w of c.witnesses)need(has(choices.source,w.source)&&w.source!=='other',w.id+' must identify who called the witness.');
  const dateKeys=['incident','received','commenced','completed','issued','recipientReceipt','partyService'];
  for(const key of dateKeys)need(!c[key]||validDate(c[key]),'Enter a valid date for '+key+'.');
  for(const keys of [['incident','received','commenced','completed','issued','recipientReceipt'],['completed','partyService']]){
    const dates=keys.filter(key=>c[key]);
    dates.slice(1).forEach((key,i)=>need(c[key]>=c[dates[i]],key+' precedes '+dates[i]+'. Check the recorded dates.'));
  }
  return errors;
}
function assemble(c){
  const errors=validate(c);
  if(errors.length)throw Error(errors.join(' '));
  const items=[];
  const add=(title,text)=>items.push({type:'heading',text:title},{type:'p',text});
  const f=(key,label)=>get(c[key],label);
  const title=choices.route[c.route];
  const forum={IC:'Internal Committee',LC:'Local Committee'}[c.forum]||'[Competent Committee]';
  const both=['same','different'].includes(c.employment);
  items.push({type:'title',text:title},{type:'notice',text:'Confidential under Section 16 · Editable working document for Committee approval'});
  add('Case and authority',forum+' of '+f('institution','Institution or district')+' records this matter as '+f('reference','Case reference')+'. The parties are '+f('complainant','Aggrieved woman name or record code')+' and '+f('respondent','Respondent name or record code')+'. The constitution order, membership, conflicts, workplace nexus and reasons for forum competence are recorded as follows: '+f('authority','Constitution and jurisdiction reasons')+'.');
  if(c.employment==='different'){
    add('Separate employers','The recorded employers are '+f('complainantEmployer','Aggrieved woman’s employer')+' and '+f('respondentEmployer','Respondent’s employer')+'. The Committee records the basis for taking up this matter, the respondent’s governing rules, the authorised inter-employer disclosure and the competent implementing authority: '+f('coordination','Cross-employer authority and arrangements')+'.');
  }else if(c.employment==='same'){
    add('Common employer','Both parties are employees of '+f('respondentEmployer','Common employer')+'. The employer’s identity is recorded separately from the Committee’s authority and the respondent’s applicable rules.');
  }else if(c.employment==='one'||c.employment==='neither'){
    add('Employment status','The record identifies '+(c.employment==='one'?'one party as an employee':'neither party as an employee')+'. The both-employee trigger for the second proviso to Section 11(1) is absent on these entries. Record the status of each party and any independent participation and representation rights: '+f('statusReasons','Employment status and applicable procedural rights')+'.');
  }else add('Employment status','The basis for each party’s employment status and any employer relationship is '+f('statusReasons','Employment status and relationship determination')+'.');
  if(c.path==='employee'){
    const procedures={
      service:'Under Section 11(1), the inquiry follows the service rules applicable to the respondent. The controlling instrument and clauses are '+f('rules','Service-rule instrument, version and clauses')+'.',
      prescribed:'The respondent is an employee and no applicable service rules have been identified on the recorded determination. The inquiry therefore follows the prescribed procedure under Section 11(1), including Rule 7 where applicable. Basis: '+f('rules','Record establishing absence of applicable service rules')+'.',
      special:'The governing service or sector instrument, competent authority and interaction with the POSH Act are '+f('rules','Applicable special rules and legal basis')+'.'
    };
    add('Inquiry procedure',procedures[c.procedure]||'The respondent’s applicable service rules or prescribed procedure must be determined under Section 11(1). Record: '+f('rules','Applicable procedure and basis')+'.');
  }else if(c.path==='domestic'){
    add('Domestic-worker pathway','The dwelling and domestic-worker status under Sections 2(a)(ii), 2(e) and 2(o)(vi) are recorded as follows: '+f('domesticBasis','Household work, remuneration and status')+'. The Local Committee’s prima facie determination is '+f('referralDecision','Reasoned prima facie determination')+'. Where a prima facie case exists, Section 11(1) requires police forwarding within seven days. Record the referral, receipt and applicable criminal provision with date and savings analysis: '+f('referral','Police forwarding details or basis for disposition')+'. Section 11(2) concerns a court’s compensation power after conviction, having regard to Section 15.');
  }else if(c.path==='third-party'){
    add('Third-party pathway','The respondent’s status and the basis for any referral, support or action under Section 19, including Sections 19(g) and 19(h) where applicable, are recorded as follows: '+f('referral','Status, authority and referral or assistance record')+'.');
  }else add('Governing pathway',f('rules','Employee, domestic-worker or third-party determination and applicable law'));
  add('Complaint and limitation','The incident or last incident date is '+f('incident','Incident or last incident date')+' and receipt is recorded on '+f('received','Complaint receipt date')+'. Section 9 ordinarily allows three months from the incident or last incident in a series. Any extension is limited to a further three months and requires recorded reasons. The Committee’s scope and limitation determination is '+f('limitation','Section 9 determination and extension reasons if applicable')+'.');
  if(c.settlement==='completed'){
    add('Conciliation and settlement','The aggrieved woman’s pre-inquiry request, terms agreed, and confirmation that money did not form the basis of settlement are recorded at '+f('settlementRecord','Request, settlement and signed terms')+'. Record copies supplied to both parties and forwarding to the employer or District Officer: '+f('settlementDelivery','Settlement delivery and implementation record')+'.');
  }else if(c.settlement==='breach'){
    add('Reported breach of settlement','The aggrieved woman’s report of non-compliance and the resulting Section 11(1) first-proviso inquiry or police route are '+f('settlementRecord','Reported breach, date, affected term and resulting action')+'.');
  }else if(c.settlement==='none'){
    add('Conciliation','No completed Section 10 settlement is recorded.');
  }
  if(!merits.has(c.route)&&c.route!=='conciliation'&&c.path!=='domestic'&&c.path!=='third-party')
    add('Decision and onward action',f('routeDecision','Reasoned determination, competent authority and communication'));
  if(merits.has(c.route)){
    const beyond=(from,to,days)=>from&&to&&Date.parse(to)-Date.parse(from)>days*86400000;
    if(beyond(c.commenced,c.completed,90)||beyond(c.completed,c.issued,10))
      add('Recorded timing exception','The dates exceed one or more statutory periods measured from the recorded triggers. Record the calculation, any disputed trigger and the competent Committee’s response: '+f('timingReasons','Timing exception and reasons')+'.');
    add('Inquiry chronology and participation','Commencement is recorded on '+f('commenced','Inquiry commencement date')+(c.route==='preliminary'?'.':', and completion on '+f('completed','Inquiry completion date')+'.')+' Section 11(4) provides a 90-day completion period. The actual service, response, sittings, quorum, disclosure, questioning and objections are recorded at '+f('fairness','Procedural record and reasons for directions')+'.');
    if(c.procedure==='prescribed'){
      add('Prescribed procedure','Rule 7 addresses complaint forwarding within seven working days of receipt, the respondent’s reply within ten working days of receipt of the complaint documents, natural justice, representation and quorum.');
      if(c.absence==='yes')add('Absence and procedural decision','The Rule 7(5) record must identify three consecutive absences without sufficient cause and fifteen days’ advance written notice before termination or an ex parte decision: '+f('absenceRecord','Hearing dates, cause, notice, delivery and decision')+'.');
    }else if(c.absence==='yes')add('Absence and procedural decision','The applicable rule, attendance history, notice, fair opportunity and reasoned decision are '+f('absenceRecord','Applicable rule and absence decision record')+'.');
    if(c.interim==='yes')add('Interim measures','The Section 12 written request, Committee recommendation, and the employer’s action and implementation report are '+f('interimRecord','Interim request, recommendation and implementation')+'.');
    if(both)add('Opportunity to respond to findings','The second proviso to Section 11(1) requires an opportunity to be heard and availability of a copy of the findings to both parties so they may make representations before the Committee. '+(c.route==='preliminary'?'Communication and response arrangements: ':'Delivery, representations and the Committee’s reasoned consideration: ')+f('representations','Findings communication and representation record')+'.');
    else if(!c.employment)add('Opportunity to respond to findings',f('representations','Verify the second proviso trigger and other governing representation rights'));
    for(const a of c.allegations){
      add(a.id+' · '+get(a.title,'Notified allegation'), 'The notified particulars are '+get(a.scope,'Conduct, date, place and notice reference')+'. The aggrieved woman’s account is '+get(a.complainant,'Material assertions')+'. The respondent’s position is '+get(a.respondent,'Admissions, denials and alternative account')+'.');
      add('Statutory issues for '+a.id,'Section 2(n) issue: '+(a.conduct?'clause ('+a.conduct+'), '+choices.conduct[a.conduct]:'[Identify applicable conduct clause(s)]')+'. The Committee addresses the alleged conduct, its sexual nature as applicable, and whether it was unwelcome: '+get(a.elements,'Element-wise reasons')+'.');
      if(a.circumstance)add('Connected circumstance under Section 3(2)','The allegation also raises '+choices.circumstance[a.circumstance]+(a.circumstance==='other'?'':' under clause ('+a.circumstance+')')+'. The Committee’s reasoning on the circumstance and its connection to the alleged conduct is '+get(a.nexus,'Circumstance and connection reasons')+'.');
      add('Assessment and finding for '+a.id,'Supporting record: '+get(a.support,'Supporting exhibit/witness codes, or none')+'. Contrary record: '+get(a.contrary,'Contrary exhibit/witness codes, or none')+'. The weight assigned to material accounts and exhibits, including inconsistencies, missing evidence and competing explanations, is '+get(a.weight,'Reasoned assessment on the applicable standard')+'. '+(c.route==='preliminary'?'Provisional':'Committee-recorded')+' finding: '+(choices.outcome[a.outcome]||'[Committee finding]')+'. Reasons and precise scope: '+get(a.reasons,'Finding reasons and precise facts determined')+'.');
    }
  }
  if(disposition.has(c.route)){
    const includeSection13=c.route==='statutory'||c.section13==='included';
    if(c.route!=='statutory')add('Authority and effect of this record','Identify the controlling instrument, the role of this Committee and the disciplinary or sector authority, and whether the following Section 13 entries form part of this record or a separate statutory report: '+f('specialAuthority','Authority, procedural stage and relationship to Section 13')+'.');
    const proved=c.allegations.filter(a=>['proved','partial'].includes(a.outcome)).map(a=>a.id);
    const unproved=c.allegations.filter(a=>['not-proved','partial'].includes(a.outcome)).map(a=>a.id);
    if(proved.length&&includeSection13)add('Action on proved findings','For the proved conduct in '+proved.join(', ')+', the Committee records its Section 13(3) recommendations as '+f('remedy','Misconduct recommendation and applicable service rule or prescribed action')+'. Compensation analysis under Section 15, including relevant harm, career loss, medical expenses, respondent’s financial circumstances and payment feasibility: '+f('compensation','Reasoned compensation determination and applicable recovery route')+'.');
    if(unproved.length&&includeSection13)add('Unproved findings','Under Section 13(2), no action is recommended for the unproved allegations or portions identified in '+unproved.join(', ')+'.');
    if(c.allegations.some(a=>!a.outcome||a.outcome==='pending'))add('Outstanding determinations','Complete each outstanding finding and record its corresponding recommendation before approving this report.');
    if(c.malice==='yes')add('Separate Section 14 determination','The distinct inquiry, procedural safeguards and reasons for any Section 14 recommendation are '+f('maliceRecord','Separate Section 14 record and recommendation')+'. A failure to substantiate an allegation is insufficient by itself.');
    if(c.section13==='separate')add('Disciplinary or sector disposition',f('separateDisposition','Determination, competent authority, delivery, implementation and appeal under governing instrument'));
    else if(includeSection13)add('Report delivery, implementation and appeal','Under Section 13(1), provide the report to the employer or District Officer, as applicable, within ten days of inquiry completion and make it available to the concerned parties. Recipient: '+f('recipient','Competent employer or District Officer')+'. Dispatch: '+f('issued','Dispatch date')+'. Receipt: '+f('recipientReceipt','Recipient receipt date')+'. Party communication: '+f('partyService','Party communication date and proof')+'. Section 13(4) requires action within sixty days of receipt. For matters appealable under Section 18, the appeal period is ninety days from the recommendations. The applicable forum, governing procedure and recommendation date are '+f('appeal','Verified appeal forum, rule and recommendation date')+'.');
  }
  if(disposition.has(c.route)&&c.route!=='statutory'&&!['included','separate'].includes(c.section13))add('Disposition and distribution',f('separateDisposition','Determine whether Section 13 recommendations belong in this or a separate record and identify the delivery and appeal route'));
  if(!c.evidence.length&&c.noEvidence==='confirmed')add('Evidence inventory','The Committee recorded that no separate exhibits were identified.');
  if(!c.witnesses.length&&c.noWitnesses==='confirmed')add('Witness inventory','The Committee recorded that no additional witnesses were called.');
  if(c.evidence.length){
    add('Annexure E · Exhibit index','The register identifies '+c.evidence.length+' item(s). Use the exhibit codes when citing the record and keep originals in restricted custody.');
    items.push(table([['Exhibit','Description and type','Status and annexure reference'],...c.evidence.map(e=>[e.id,get(e.title,'Exhibit description')+' · '+get(choices.evidence[e.type],'Type'),(e.status==='missing'?'Missing · no enclosure':get(e.status,'Status')+' · '+'Annexure '+e.id+' · '+get(e.annexure,'File or folio'))])]));
    for(const e of c.evidence){
      add(e.id+' · Provenance and custody','Submitted or identified by '+get(e.source,'Source and receipt details')+'. '+(e.status==='missing'?'Production steps and effect of non-availability: '+get(e.dispute,'Production attempts and impact')+'.':'Authenticity checks and original custodian or transfer history: '+get(e.authenticity,'Verification method and result')+' / '+get(e.custody,'Custody and access reference')+'.')+(e.status==='disputed'?' Objection, response and weight: '+get(e.dispute,'Dispute and reasoned resolution')+'.':''));
    }
  }
  if(c.witnesses.length){
    add('Annexure W · Witness statements',['complainant','respondent','committee'].map(key=>choices.source[key]+': '+c.witnesses.filter(w=>w.source===key).length).join(' · '));
    for(const w of c.witnesses){
      add(w.id+' · '+get(w.name,'Witness name or code'),'Called by: '+choices.source[w.source]+'. Examination date and setting: '+get(w.hearing,'Hearing date and mode')+'. Statement: '+get(w.statement,'Witness’s account in their own words, including firsthand and reported information')+'. Questions, answers and clarifications: '+get(w.questions,'Questions put, responses and corrections')+'. Authentication: '+get(w.confirmation,'Witness confirmation or signature, date and file reference')+'.');
    }
  }
  if(c.audit?.gates?.length){
    add('84-point review and release gates','The coded review reports '+c.audit.completed+' of 84 checks recorded as verified or reasoned inapplicable. Gate entries below are copied from the working review.');
    items.push(table([['Gate','Status','Record reference'],...c.audit.gates]));
  }
  add('Authorisation and restricted custody','Committee sign-off and date: '+f('signoff','Participating members, signatures and date')+'. Keep the complaint, identities, witness accounts, proceedings and recommendations restricted under Sections 16–17, with lawful access and delivery recorded at '+f('custody','Restricted repository and access record')+'.');
  return items;
}
const api={choices,merits,assemble,validate};
if(typeof module!=='undefined')module.exports=api;else root.PoshReportAssembly=api;
})(typeof window==='undefined'?globalThis:window);
