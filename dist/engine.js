/** POSH Inquiry Navigator v2 — standalone, dependency-free decision core.
 * This is reviewed-for-design preliminary guidance, NOT a certified legal expert system.
 * No credibility, guilt, forum competence, or malice determination is automated.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NavigatorEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SOURCES = {
    act: { id:'POSH-ACT-2013', name:'POSH Act, 2013', uri:'https://www.indiacode.nic.in/bitstream/123456789/15239/1/sexual_harassment_act_2013.pdf', status:'primary-text-reference; application requires review' },
    rules: { id:'POSH-RULES-2013', name:'POSH Rules, 2013', uri:'https://spniwcd.wcd.gov.in/uploads/pdf/1719914401_2NUqe91gql.pdf', status:'primary-source-link; jurisdiction-specific rules pending review' },
    pocso: { id:'POCSO-ACT-2012', name:'POCSO Act, 2012', uri:'https://www.ncpcr.gov.in/uploads/165648758662bbfea22021a_protection-of-children-from-sexual-offences-act-2012-english-hindi.pdf', status:'primary-text-reference; current amendments require review' }
  };
  const opt = (value,label,detail) => ({value,label,detail});
  const questions = [
    {id:'w.concern',role:'woman',stage:'start',label:'What would you like help with?',hint:'Choose the closest description. You do not need to share private details here.',kind:'choice',choices:[opt('sexual','Possible sexual harassment','Unwelcome sexual conduct connected with work'),opt('unsure','I am not sure','Help me understand relevant indicators'),opt('other','Another workplace concern','Bullying, unfair treatment, or another issue'),opt('safety','I need safety or reporting help','Immediate practical support first')]},
    {id:'w.age',role:'woman',stage:'start',label:'Which age group applies?',hint:'This is used only to display relevant child-protection guidance.',kind:'choice',choices:[opt('adult','18 or older'),opt('minor','Under 18'),opt('unknown','Prefer not to say / not sure')]},
    {id:'w.childIndicators',role:'woman',stage:'safety',when:{eq:['w.age','minor']},label:'Could the concern involve sexual conduct or a suspected sexual offence against a child?',hint:'A broad answer is enough. Please do not enter a child’s identity or detailed statement.',kind:'choice',choices:[opt('yes','Yes / potentially'),opt('unsure','I am unsure'),opt('no','No')]},
    {id:'w.urgent',role:'woman',stage:'safety',label:'Is anyone at immediate risk of harm?',hint:'Choose “Yes” for urgent assistance guidance. This app does not contact emergency services.',kind:'choice',choices:[opt('yes','Yes, immediate assistance is needed'),opt('unsure','Possibly / not sure'),opt('no','No immediate danger identified')]},
    {id:'w.conduct',role:'woman',stage:'conduct',when:{in:['w.concern',['sexual','unsure','safety']]},label:'Which broad description is closest to the reported conduct?',hint:'Select one primary category. More than one may ultimately apply.',kind:'choice',choices:[opt('physical','Unwelcome physical contact or advances'),opt('favours','Requests or demands for sexual favours'),opt('remarks','Sexually coloured remarks'),opt('pornography','Showing pornography'),opt('nonverbal','Other unwelcome conduct of a sexual nature'),opt('unsure','I cannot classify it yet'),opt('nonsexual','No apparent sexual element')]},
    {id:'w.circumstances',role:'woman',stage:'conduct',when:{all:[{in:['w.concern',['sexual','unsure','safety']]},{notEq:['w.conduct','nonsexual']}]},label:'Were any of these circumstances connected with the reported conduct?',hint:'Section 3(2): select all that may apply. These circumstances matter when connected with alleged sexual harassment; an ordinary workplace dispute alone does not establish sexual harassment.',kind:'multi',choices:[opt('promise','Promise of favourable treatment in employment','For example, a promotion or benefit linked to the conduct'),opt('detriment','Threat of unfavourable treatment in employment','For example, adverse appraisal or work allocation'),opt('employment','Threat to current or future employment status','For example, job continuation or confirmation'),opt('environment','Interference with work or an intimidating, offensive or hostile work environment','Connected with the alleged sexual conduct'),opt('humiliation','Humiliating treatment likely to affect health or safety','Connected with the alleged sexual conduct'),opt('none','None of these identified'),opt('unsure','I am not sure') ]},
    {id:'w.nexus',role:'woman',stage:'workplace',when:{notEq:['w.concern','other']},label:'Is the concern connected with a workplace or work-related activity?',hint:'The legal meaning of workplace may extend beyond a physical office.',kind:'choice',choices:[opt('yes','Yes'),opt('unknown','I am not sure'),opt('no','No apparent workplace connection')]},
    {id:'w.relationship',role:'woman',stage:'workplace',when:{notEq:['w.concern','other']},label:'What best describes the affected woman’s connection?',kind:'choice',choices:[opt('employee','Employee'),opt('contractor','Contractor / temporary worker'),opt('intern','Intern / trainee'),opt('student','Student'),opt('visitor','Visitor / applicant'),opt('other','Other / uncertain')]},
    {id:'w.dateType',role:'woman',stage:'timeline',when:{notEq:['w.concern','other']},label:'Was this one incident or a series?',kind:'choice',choices:[opt('single','One incident'),opt('series','Series of incidents'),opt('unsure','Unsure')]},
    {id:'w.lastDate',role:'woman',stage:'timeline',when:{all:[{notEq:['w.concern','other']},{in:['w.dateType',['single','series']]}]},label:'Date of incident / last incident of alleged sexual harassment',hint:'Use the last incident only if it relates to the alleged sexual harassment, not an unrelated workplace event.',kind:'date'},
    {id:'w.filed',role:'woman',stage:'timeline',when:{notEq:['w.concern','other']},label:'Has a written complaint already been submitted?',kind:'choice',choices:[opt('yes','Yes'),opt('no','Not yet'),opt('unknown','Not sure')]},
    {id:'w.submittedDate',role:'woman',stage:'timeline',when:{eq:['w.filed','yes']},label:'On what date did you submit the written complaint?',hint:'Enter the date on which you sent or handed over the complaint. The Committee’s date of receipt and its acknowledgement may differ and must be verified separately.',kind:'date'},
    {id:'w.againstEmployer',role:'woman',stage:'forum',when:{notEq:['w.concern','other']},label:'Is the allegation against the employer?',kind:'choice',choices:[opt('yes','Yes'),opt('no','No'),opt('unknown','Unsure')]},
    {id:'w.workforce',role:'woman',stage:'forum',when:{notEq:['w.concern','other']},label:'Approximately how many workers are in the workplace?',kind:'choice',choices:[opt('10plus','10 or more'),opt('under10','Fewer than 10'),opt('unknown','I do not know')]},
    {id:'w.ic',role:'woman',stage:'forum',when:{notEq:['w.concern','other']},label:'Is an Internal Committee (IC) formally constituted at this workplace?',hint:'“No” means you have reasonably established that it has not been constituted. Choose “Information not available” if you cannot verify the current constitution order or contact.',kind:'choice',choices:[opt('yes','Yes, IC details are available'),opt('no','No, the IC is not constituted'),opt('unknown','Information not available / not verified')]},
    {id:'w.acknowledged',role:'woman',stage:'timeline',when:{eq:['w.filed','yes']},label:'Has the Committee acknowledged your complaint in writing?',hint:'An acknowledgement is different from your submission confirmation and from a jurisdictional or maintainability decision.',kind:'choice',choices:[opt('yes','Yes, I have a written acknowledgement'),opt('no','No, nothing received yet'),opt('unknown','Not sure / cannot verify')]},
    {id:'w.conciliation',role:'woman',stage:'next',when:{all:[{notEq:['w.concern','other']},{in:['w.conduct',['physical','favours','remarks','pornography','nonverbal','unsure']]}]},label:'Would you like to request conciliation under Section 10?',hint:'An entirely optional request made by the aggrieved woman before initiation of inquiry under Section 11. It cannot be imposed, and a monetary settlement cannot be its basis.',kind:'choice',choices:[opt('yes','Yes, I want to request conciliation'),opt('no','No, I do not request conciliation'),opt('unsure','Please explain before I decide')]},
    {id:'w.conciliationVoluntary',role:'woman',stage:'next',when:{eq:['w.conciliation','yes']},label:'Is this your own choice, free from pressure or coercion?',hint:'If you are being pressured, this application will not draft an unconditional conciliation request.',kind:'choice',choices:[opt('yes','Yes, this is my voluntary choice'),opt('no','No, I feel pressured'),opt('unsure','I am uncertain')]},
    {id:'w.inquiryStarted',role:'woman',stage:'next',when:{all:[{eq:['w.conciliation','yes']},{eq:['w.filed','yes']}]},label:'Has the IC/LC already initiated a formal inquiry under Section 11?',hint:'Conciliation under Section 10 is contemplated before initiation of the inquiry. If unsure, verify the actual procedural stage.',kind:'choice',choices:[opt('no','No, no inquiry has begun'),opt('yes','Yes, an inquiry has commenced'),opt('unknown','I do not know')]},
    {id:'w.need',role:'woman',stage:'next',label:'Which assistance is most useful now?',kind:'choice',choices:[opt('draft','Prepare an editable complaint template'),opt('authority','Identify the appropriate reporting authority'),opt('protection','Understand protection and confidentiality'),opt('procedure','Understand the next procedural steps')]},

    {id:'r.notice',role:'respondent',stage:'start',label:'What information have you received?',hint:'The inquiry should be approached on its actual procedural status; allegation alone is not a finding.',kind:'choice',choices:[opt('formal','Formal notice and complaint copy'),opt('informal','Only an informal allegation'),opt('reported','I have heard a complaint was filed'),opt('started','An inquiry is underway'),opt('completed','An inquiry has concluded'),opt('unknown','The situation is unclear')]},
    {id:'r.allegations',role:'respondent',stage:'notice',label:'Are the specific allegations and supporting materials available to you?',kind:'choice',choices:[opt('complete','Yes, enough to identify the allegations'),opt('partial','Only some information'),opt('none','No written particulars received'),opt('disputed','Service or completeness is disputed')]},
    {id:'r.reply',role:'respondent',stage:'notice',when:{in:['r.notice',['formal','started']]},label:'Have you filed a written reply?',kind:'choice',choices:[opt('yes','Yes'),opt('no','Not yet'),opt('partial','A partial reply only')]},
    {id:'r.serviceDate',role:'respondent',stage:'notice',when:{eq:['r.notice','formal']},label:'When did you actually receive the relevant complaint documents?',hint:'For Central Rule 7, response time relates to receipt of specified documents; applicability must be checked.',kind:'date'},
    {id:'r.evidence',role:'respondent',stage:'preparation',label:'Which best describes your supporting material?',kind:'choice',choices:[opt('records','I have relevant records'),opt('witnesses','I may have witnesses'),opt('both','Records and potential witnesses'),opt('none','Nothing yet / I need help identifying records')]},
    {id:'r.concern',role:'respondent',stage:'preparation',label:'Is there a procedural issue requiring attention?',kind:'choice',choices:[opt('materials','Missing complaint or evidence material'),opt('bias','Potential Committee conflict or bias'),opt('service','Notice/service or hearing concerns'),opt('access','Accessibility, illness or attendance issue'),opt('none','No procedural concern identified'),opt('other','Another issue / uncertain')]},
    {id:'r.stage',role:'respondent',stage:'preparation',label:'What would help most?',kind:'choice',choices:[opt('reply','A structured editable reply'),opt('access','A document-access request'),opt('fairness','A procedural clarification request'),opt('appeal','Understanding findings or appeal options')]}
  ];
  const stages = {
    woman:[{id:'start',name:'Your concern'},{id:'safety',name:'Safety check'},{id:'conduct',name:'Classification'},{id:'workplace',name:'Workplace link'},{id:'timeline',name:'Timeline'},{id:'forum',name:'Reporting route'},{id:'next',name:'Next steps'}],
    respondent:[{id:'start',name:'Your situation'},{id:'notice',name:'Notice & reply'},{id:'preparation',name:'Fair-process preparation'}]
  };
  function conditionMatches(when, state) {
    if (!when) return true;
    if (when.all) return when.all.every(c=>conditionMatches(c,state));
    if (when.any) return when.any.some(c=>conditionMatches(c,state));
    if (when.eq) return state[when.eq[0]]===when.eq[1];
    if (when.notEq) return state[when.notEq[0]]!==when.notEq[1];
    if (when.in) return when.in[1].includes(state[when.in[0]]);
    return false;
  }
  function activeAnswers(role,state) {
    const roleQuestions=questions.filter(q=>q.role===role);
    let current=Object.fromEntries(Object.entries(state).filter(([k])=>roleQuestions.some(q=>q.id===k)));
    // Remove descendants of an inactive branch as well as its immediate answer.
    // Each pass only removes keys, so this reaches a fixed point in at most N passes.
    for(let pass=0;pass<=roleQuestions.length;pass++){
      const allowed=new Set(roleQuestions.filter(q=>conditionMatches(q.when,current)).map(q=>q.id));
      const next=Object.fromEntries(Object.entries(current).filter(([k])=>allowed.has(k)));
      if(Object.keys(next).length===Object.keys(current).length)return next;
      current=next;
    }
    return current;
  }
  function activeQuestions(role,state,stage) { const current=activeAnswers(role,state);return questions.filter(q=>q.role===role && (!stage || q.stage===stage) && conditionMatches(q.when,current)); }
  function indiaDay(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));const part=t=>parts.find(x=>x.type===t).value;return part('year')+'-'+part('month')+'-'+part('day');}
  function validAnswer(q, value, now=new Date()) {
    if (value === undefined || value === null || value === '') return false;
    if (q.kind === 'multi') {const selected = Array.isArray(value) ? value : []; const choices=new Set((q.choices||[]).map(c=>c.value));return selected.length>0&&selected.every(v=>choices.has(v))&&(!selected.includes('none')&&!selected.includes('unsure')||selected.length===1);}
    if (q.kind === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const dt = new Date(`${value}T00:00:00Z`);
      return Number.isFinite(dt.getTime()) && dt.toISOString().slice(0,10) === value && value <= indiaDay(now);
    }
    return q.choices?.some(c => c.value === value) ?? true;
  }
  function stageReady(role, state, stage) {return activeQuestions(role,state,stage).every(q=>validAnswer(q,state[q.id]));}
  function nextStage(role,state,current) {
    const all=stages[role]; let i=all.findIndex(s=>s.id===current);
    while(++i<all.length) if(activeQuestions(role,state,all[i].id).length) return all[i].id;
    return 'result';
  }
  function previousStage(role,state,current) {
    const all=stages[role]; let i=current==='result'?all.length:all.findIndex(s=>s.id===current);
    while(--i>=0) if(activeQuestions(role,state,all[i].id).length) return all[i].id;
    return all[0].id;
  }
  function addMonthsClamped(iso,n) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||'')||!Number.isInteger(n))return null;
    const source=new Date(iso+'T00:00:00Z');
    if(!Number.isFinite(+source)||source.toISOString().slice(0,10)!==iso)return null;
    const day=source.getUTCDate(),x=new Date(source);x.setUTCDate(1);x.setUTCMonth(x.getUTCMonth()+n);
    if(!Number.isFinite(+x))return null;
    const last=new Date(x);last.setUTCMonth(last.getUTCMonth()+1,0);x.setUTCDate(Math.min(day,last.getUTCDate()));
    const result=x.toISOString().slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(result)?result:null;
  }
  const action=(priority,title,detail,source,owner='You',type='action')=>({priority,title,detail,source,owner,type});
  function answeredLabels(role, state) {
    return activeQuestions(role,state).filter(q=>state[q.id]!==undefined && state[q.id]!=='' )
      .map(q=>({id:q.id,question:q.label,answer:q.kind==='choice' ? (q.choices.find(c=>c.value===state[q.id])?.label||state[q.id]) : q.kind==='multi' ? state[q.id].map(v=>q.choices.find(c=>c.value===v)?.label||v).join('; ') : state[q.id]}));
  }
  function outcome(role, raw) {
    const s=activeAnswers(role,raw),actions=[],notices=[];
    let eligibleDoc=true;
    const emit=(priority,title,detail,source,owner,now,records,next)=>actions.push({
      ...action(priority,title,detail,source,owner),now,records,next
    });
    if(role==='woman') {
      const minor=s['w.age']==='minor',urgent=s['w.urgent'],child=minor&&['yes','unsure'].includes(s['w.childIndicators']);
      const nonsexual=s['w.concern']==='other'||s['w.conduct']==='nonsexual';
      eligibleDoc=!nonsexual;
      if(urgent==='yes'||urgent==='unsure')emit(1,'Address immediate safety before paperwork',
        urgent==='yes'?'You reported immediate danger. This website has NOT called the police or arranged help.':'You were uncertain whether someone is in immediate danger; treat any current threat as a priority.',
        'Immediate safety','Person seeking assistance','If there is a present threat in India, call 112 or seek help from local police/emergency services; move to a safer location if possible.',
        'Keep only safe, factual notes of any assistance sought; do not delay safety to collect evidence.', 'After safety is addressed, use the relevant reporting route.');
      if(child)emit(1,'Check POCSO Section 19 reporting without delay',
        'The affected person is under 18 and the response raises a possible child sexual offence, or uncertainty about one. Being under 18 alone does not establish a POCSO offence.',
        'POCSO Act §19','Person with relevant information','Where a POCSO offence is known or reasonably apprehended, promptly report to the Special Juvenile Police Unit or local police; obtain child-safe assistance.',
        'Do not put the child’s name, intimate narrative or statement into this public tool. Avoid repeated interviewing.', 'Police receipt or action must be established independently; this tool has made no report.');
      if(nonsexual)emit(2,'Use the appropriate non-POSH grievance route',
        'Your answers currently indicate no apparent unwelcome conduct of a sexual nature; this tool will not generate a POSH complaint based only on that selection.',
        'POSH Act §§2(n), 3','You','Identify whether the issue concerns bullying, discrimination, employment terms, violence or an educational grievance; approach the relevant grievance officer or professional.',
        'Record dates, relevant orders/messages and names of people with direct knowledge, privately.', 'If an unwelcome sexual element is later identified, revisit this assessment.');
      if(!nonsexual && ['unsure'].includes(s['w.conduct']))emit(2,'Clarify statutory indicators: what conduct is alleged',
        'You chose “I cannot classify it yet.” An IC/LC must determine the legal position; no classification has been made here.',
        'POSH Act §§2(n), 3','You','Privately describe the actual words or actions, whether unwelcome, and any sexual character or relevant circumstances. If unsure, seek independent assistance before making definitive allegations.',
        'Preserve accurate contemporaneous notes or existing messages; avoid speculative labels.', 'Use the recorded facts to decide whether a POSH draft is appropriate.');
      if(!nonsexual && Array.isArray(s['w.circumstances'])) {
        const values=s['w.circumstances'];
        const q=questions.find(x=>x.id==='w.circumstances');
        const labels=values.map(v=>q.choices.find(c=>c.value===v)?.label||v);
        if(!values.includes('none') && !values.includes('unsure')) {
          const evidence=[];
          if(values.includes('promise')) evidence.push('messages or meeting notes about an alleged offer of favourable treatment');
          if(values.includes('detriment')) evidence.push('relevant appraisal, assignment or disciplinary communications');
          if(values.includes('employment')) evidence.push('job-confirmation, contract-renewal or termination-related communications');
          if(values.includes('environment')) evidence.push('dated examples of work interference and the alleged sexual conduct to which they relate');
          if(values.includes('humiliation')) evidence.push('dated descriptions of the alleged humiliating treatment and its effect, without speculative medical claims');
          emit(2,'Record the particular Section 3(2) circumstances you selected',`You selected: ${labels.join('; ')}. These do not establish a POSH violation by themselves; examine their connection to the alleged sexual conduct.`, 'POSH Act §3(2)','You', 'In a private chronology, pair each selected circumstance with the alleged sexual conduct, identify when it happened, who was present and whether the circumstance was express or implied.', `Preserve only existing, lawfully available material: ${evidence.join('; ')}.`, 'Include relevant factual context in the complaint, not just the legal labels; the Committee decides its significance.');
        } else if(values.includes('unsure')) emit(3,'Clarify the surrounding circumstances without guessing','You could not yet identify a Section 3(2) circumstance. Not identifying one does not automatically defeat an otherwise relevant Section 2(n) allegation.','POSH Act §§2(n), 3(2)','You','Privately note any exact words/actions and whether any employment benefit, threat, hostile condition or humiliating treatment was connected to the sexual conduct.','Keep original messages or a dated recollection, clearly marked as your account.','Use only circumstances you can factually describe; seek help if unsure.');
      }
      if(!nonsexual && s['w.nexus']!=='yes')emit(2,'Verify the connection to a workplace',
        s['w.nexus']==='no'?'You selected “No apparent workplace connection.” POSH jurisdiction is not established by these answers.':'You are unsure about the workplace connection; a work-related off-site incident may still require examination.',
        'POSH Act §2(o)','You','Record why the interaction occurred, the location, organisational link and how you were present. Obtain a forum review instead of assuming coverage.',
        'Keep invitations, work messages, travel assignments or visit records if relevant.', 'Select a competent reporting route once the workplace connection is clarified.');
      if(!nonsexual && s['w.dateType']==='unsure')emit(3,'Identify the relevant incident dates',
        'You were unsure whether this was a single incident or a series.', 'POSH Act §9','You',
        'Create a private chronological list of incidents that may be sexual in nature; separate unrelated workplace disputes.',
        'For each entry: date or best estimate, location and available source record.', 'Determine the last relevant incident date before relying on a filing reference.');
      if(!nonsexual && s['w.lastDate']){
        const d=s['w.lastDate'],first=addMonthsClamped(d,3),outer=addMonthsClamped(d,6),today=indiaDay(),filed=s['w.filed']==='yes';
        const passed3=first && today>first,passed6=outer&&today>outer;
        const timeline= `Date you entered: ${d}. Indicative three-calendar-month reference: ${first}. Possible additional three-calendar-month reference: ${outer}.`;
        let target='Compare your stated submission date with the incident date. Keep a sent copy and seek confirmation of actual receipt from the authority.';
        if(!filed) target=passed6?'The ordinary reference periods appear elapsed. Seek prompt qualified advice; this tool cannot create an exception or decide maintainability.':passed3?'If not yet filed, promptly seek assistance with a written complaint and any factually supported explanation for delay. Extension is not automatic.':'If you choose to file, prepare the written complaint for the correct IC/LC before the preliminary three-month reference date.';
        emit(passed6&&!filed?1:2,'Check your Section 9 date position',
          timeline+(passed3?' The initial reference date is past.':' The initial reference date has not passed on the current calendar.')+' This calculation is provisional, not a finding of limitation.',
          'POSH Act §9','You / competent Committee',target,
          `Incident-date reference ${d}; ${filed?`you stated a complaint was submitted${s['w.submittedDate']?` on ${s['w.submittedDate']}`:''}`:'you stated no complaint has been submitted yet'}. If a series, verify that the last incident is an alleged sexual-harassment incident.`,
          'Only the competent Committee can consider any legally permitted extension on reasons recorded in writing.');
      }
      if(!nonsexual && s['w.filed']==='yes'&&s['w.submittedDate']&&s['w.lastDate']&&s['w.submittedDate']<s['w.lastDate'])emit(1,'Re-check the two dates before relying on the filing position',
        `You entered last incident ${s['w.lastDate']} but submission ${s['w.submittedDate']}. This can occur for a later incident in a series or a supplemental complaint; the dates need clarification, not automatic rejection.`, 'POSH Act §9','You', 'Check whether your submission covered an earlier incident, and whether a later incident occurred after that submission.', 'Keep both versions of the chronology and genuine submission records.','Correct any entry error and ask for procedure-specific review where necessary.');
      if(!nonsexual && s['w.filed']==='yes' && s['w.acknowledged']==='no')emit(1,'Request a written acknowledgement of the complaint now',
        'You reported that a written complaint was submitted but no written acknowledgement was received. A prompt receipt acknowledgement is good administrative practice; the Act does not prescribe a fixed same-day acknowledgement deadline.',
        'POSH Act §9; administrative good practice','You / receiving IC or LC','Ask the verified Committee channel to confirm actual receipt date, any reference number, the receiving officer and whether any document is missing. Do not resend sensitive details to an unverified address.',
        'Retain your original submitted complaint, sent-mail headers, delivery proof and any follow-up request.', 'Ask for a written procedural update; no fixed seven-day accept/reject deadline is prescribed in the Central Rule 7.');
      if(!nonsexual && s['w.filed']==='yes' && s['w.acknowledged']==='yes')emit(3,'Preserve the actual acknowledgement, not just the sent date',
        'You reported a written acknowledgement. It is not, by itself, a decision on competence, maintainability or the truth of allegations.',
        'POSH Act §9','You','Check the recorded receipt date, issuing Committee and reference number before calculating any procedural follow-up.',
        'Keep the complete acknowledgement and original submission.', 'Request an update only if no meaningful procedural information follows in a reasonable time.');
      if(!nonsexual && s['w.filed']==='yes')emit(2,'Preserve your submission record; separately verify receipt',
        s['w.submittedDate']?`You stated that you submitted the complaint on ${s['w.submittedDate']}; this does not independently establish the Committee's date of receipt or acknowledgement.`:'You indicated that a written complaint was already submitted.',
        'POSH Act §9','You','Retrieve the sent email with attachments or a signed hand-delivery copy dated on the day you submitted. Check separately whether the IC/LC actually received and acknowledged it.',
        'Write down the submission channel and add the exact sent-mail timestamp, dispatch tracking or acknowledgement number if one exists. Do not equate the date you sent it with the date officially received.', 'If there is no acknowledgement, request written confirmation of receipt from the identified IC/LC through its verified contact channel.');
      if(!nonsexual) {
        if(s['w.againstEmployer']==='yes'||s['w.workforce']==='under10')emit(2,'Verify the competent Local Committee and district',
          `${s['w.againstEmployer']==='yes'?'You stated the allegation is against the employer. ':''}${s['w.workforce']==='under10'?'You stated the establishment has fewer than 10 workers. ':''}These are relevant Section 6 circumstances; the competent LC and district remain to be verified.`,
          'POSH Act §6','You / District Officer','Ask the District Officer’s office for the notified Local Committee and its complaint receipt details; do not send intimate details to an unverified address.',
          'Keep the employer relationship, approximate worker count and district/workplace details for forum review.', 'Address the final complaint to the confirmed competent Committee.');
        else if(s['w.workforce']==='10plus' && s['w.ic']==='no')emit(1,'No IC constituted at a workplace with 10 or more workers — escalate promptly',
          'You indicated at least ten workers and confirmed that no Internal Committee is constituted. This raises a serious employer compliance concern under Sections 4 and 26. Do not assume that every such complaint automatically belongs before the Local Committee; Sections 6 and 9 require forum-specific examination.',
          'POSH Act §§4, 6, 9, 26','You / employer / District Officer','Request in writing that the employer urgently constitute and publish a legally compliant IC and identify a secure complaint-receiving process. Approach the District Officer or Women and Child Development district office for verified Local Committee/appropriate-forum directions; if the employer is implicated, do not send the confidential allegations to them.',
          'Keep proof of the worker-count estimate, the absence/non-constitution information, written requests and any official replies. Preserve the dated complaint and original evidence.', 'Do not miss a Section 9 filing window while waiting for IC formation: obtain timely qualified forum advice and preserve proof of every attempted submission.');
        else if(s['w.workforce']==='10plus' && s['w.ic']==='unknown')emit(1,'IC details unavailable for a workplace with 10 or more workers — verify urgently',
          'You indicated at least ten workers but cannot verify the IC. Lack of publicly available information is not proof that no committee exists. Section 4 ordinarily requires an IC for this worker-count category.',
          'POSH Act §§4, 6, 9','You / employer / District Officer','Send a short written request to the employer/HR for the latest signed IC constitution order, Presiding Officer name, appointment validity and confidential complaint contact; do not disclose intimate allegations merely to identify the committee. If unanswered, seek district District Officer/WCD assistance and a forum review.',
          'Retain dated requests, screenshots of any official IC notice, replies and approximate workforce information.', 'Prepare and preserve the written complaint immediately; do not delay statutory filing because committee information is missing.');
        else if(s['w.ic']==='no')emit(2,'Confirm receiving forum where an IC is not constituted',
          'The information supplied does not establish a competent IC. LC competence must be examined under Sections 6 and 9 in the actual circumstances.',
          'POSH Act §§4, 6, 9','You / District Officer','Obtain official forum advice and the verified receiving authority details; do not send sensitive facts to unverified channels.',
          'Keep correspondence about IC constitution and workplace size.', 'Seek prompt review so uncertainty does not jeopardise timely filing.');
        else if(s['w.ic']==='unknown'||s['w.againstEmployer']==='unknown'||s['w.workforce']==='unknown')emit(3,'Resolve the specific missing forum facts',
          `IC status: ${s['w.ic']==='unknown'?'unknown':'stated'}. Employer allegation: ${s['w.againstEmployer']==='unknown'?'uncertain':'answered'}. Worker count: ${s['w.workforce']==='unknown'?'unknown':'answered'}.`,
          'POSH Act §§4, 6','You','Ask the workplace for its IC appointment order and obtain approximate workforce information; verify whether the allegation concerns the legal employer.',
          'Keep only the facts needed to identify IC versus LC, including district and establishment.', 'Confirm the correct forum before submitting the formal complaint.');
        else emit(3,'Confirm current IC details before sending the complaint',
          s['w.ic']==='yes'?'You indicated that an IC exists; its composition, tenure and address have not been verified.':'You have not established the appropriate receiving Committee.',
          'POSH Act §§4, 6','You','Obtain the current IC order, Presiding Officer name and secure submission method.',
          'Keep the order/contact source and a copy of the complaint after finalising it.', 'Send only after confirming the Committee and chosen submission route.');
      }
      if(!nonsexual && s['w.conciliation']==='unsure')emit(2,'Understand the optional Section 10 conciliation route before choosing',
        'Conciliation is initiated at the aggrieved woman’s request, before a Section 11 inquiry begins. It is not a compulsory step and no monetary settlement may be its basis.',
        'POSH Act §10','You / competent IC or LC','Ask the competent Committee to explain voluntary conciliation, how settlement terms would be recorded, and your right to choose the ordinary inquiry pathway instead.',
        'Keep only a record of any explanation requested or pressure reported.', 'Return to this question and choose Yes or No when you can decide freely.');
      if(!nonsexual && s['w.conciliation']==='yes' && s['w.conciliationVoluntary']!=='yes')emit(1,'Do not submit a conciliation request under pressure or uncertainty',
        s['w.conciliationVoluntary']==='no'?'You indicated you are being pressured. A request under Section 10 must be your own voluntary choice.':'You have not confirmed that this is your free and informed choice.',
        'POSH Act §10','You / competent IC or LC','Inform the Committee, through a safe channel, that you need independent procedural information and protection from pressure. No unconditional conciliation request will be generated.',
        'Keep any existing records of coercion or influence, only when safe.', 'You may choose the statutory complaint/inquiry route; do not treat conciliation as mandatory.');
      if(!nonsexual && s['w.conciliation']==='yes' && s['w.conciliationVoluntary']==='yes' && s['w.filed']==='yes' && s['w.inquiryStarted']==='yes')emit(1,'Formal inquiry has reportedly begun — verify whether Section 10 is still available',
        'You stated that an inquiry under Section 11 has already commenced. Section 10 contemplates conciliation before initiating that inquiry, so this tool will not issue a standalone Section 10 request as automatically procedurally available.',
        'POSH Act §§10–11','You / competent Committee','Ask the Committee to confirm the recorded stage and obtain case-specific legal advice. Do not interpret any informal proposal as a statutory settlement.',
        'Keep the Committee’s initiation or hearing notices and dates.', 'Proceed according to the competent Committee’s lawful directions.');
      if(!nonsexual && s['w.conciliation']==='yes' && s['w.conciliationVoluntary']==='yes' && s['w.inquiryStarted']==='unknown')emit(2,'Verify whether the inquiry has started before making a Section 10 request',
        'You want voluntary conciliation, but the inquiry stage is unknown. Section 10 applies before Section 11 inquiry initiation.',
        'POSH Act §10','You / competent Committee','Request written confirmation of the inquiry stage and then use the optional request only if legally available.',
        'Save any official notice of inquiry initiation.', 'Do not assume the request has been received or conciliation approved.');
      if(!nonsexual && s['w.conciliation']==='yes' && s['w.conciliationVoluntary']==='yes' && (s['w.filed']==='no'||(s['w.filed']==='yes'&&s['w.inquiryStarted']==='no')))emit(2,'Make a separate, voluntary Section 10 conciliation request if desired',
        'You selected voluntary conciliation. The Committee may consider it before initiation of inquiry; a request is not a settlement, and monetary settlement cannot be its basis.',
        'POSH Act §10','You / competent IC or LC','Download the separate editable conciliation request or include the optional request in your complaint. Address it to the competent Committee and do not propose monetary settlement as its basis.',
        'Preserve your signed request and evidence of actual submission. Do not contact or pressure the respondent directly.', 'The Committee must follow Section 10 requirements if conciliation is pursued; any settlement and copies must be properly recorded.');
      if(!nonsexual && s['w.conciliation']==='yes' && s['w.conciliationVoluntary']==='yes' && s['w.filed']==='unknown')emit(2,'Clarify whether any formal complaint or inquiry already exists',
        'Submission status is uncertain. The app cannot assume a Section 10 request would be made before inquiry commencement.',
        'POSH Act §§9–11','You / competent Committee','Verify the actual complaint/submission and inquiry status before issuing a formal conciliation request.',
        'Preserve any existing complaint/notice and dated communication.', 'Make a voluntary Section 10 request only after confirming statutory timing.');
      if(!nonsexual && s['w.filed']!=='yes')emit(3,'Request prompt written acknowledgement when you submit',
        'You have not indicated a completed written submission. A downloaded Word draft is not filed or received.',
        'POSH Act §9; administrative good practice','You / receiving Committee','When filing through a verified IC/LC channel, request a date-stamped acknowledgement with the actual receipt date and a reference number; retain the original. No fixed statutory same-day acknowledgement deadline is asserted.',
        'Keep the signed complaint, annexure list and securely preserved dispatch/delivery proof.', 'Ask for a written preliminary procedural update; the Central seven-working-day rule concerns onward service to the respondent, not obligatory accept/reject of the complaint.');
      if(!nonsexual)emit(3,'Understand the statutory seven-working-day step accurately',
        'Central Rule 7(2), where applicable, concerns the Committee sending the complaint copy to the respondent within seven WORKING days of receipt. It does not require acceptance or rejection within seven days.',
        'Central Rule 7(2)–(3)','Competent IC / LC','Ask which inquiry/service rules govern the matter. Request that any competence or maintainability objection be decided with written reasons and appropriately communicated.',
        'Keep actual receipt and notices where available.', 'Under applicable Central Rule 7, the respondent ordinarily files a reply within ten working days of receiving specified complaint documents.');
      if(!nonsexual && (s['w.need']==='protection'||urgent==='yes'))emit(2,'Specify the protection needed',
        'You selected protection or immediate safety as relevant. Do not assume a particular interim order can be granted automatically.',
        'POSH Act §§12, 16','You / competent Committee','Write a concise request describing the immediate practical measure needed, such as avoiding contact or evidence preservation; seek the Committee’s consideration of available statutory/service-rule options.',
        'Identify factual risk and requested measure without disclosing details in this public app.', 'Request a documented decision from the appropriate authority.');
      if(!nonsexual && s['w.need']==='draft')emit(3,'Finish the pre-filled complaint Word draft',
        'Your broad answers, workplace status, relevant date and reported filing status will appear in the editable document, clearly distinguished from details you must supply.',
        'POSH Act §9','You','Download the complaint DOCX; fill in name, respondent, exact events, place, evidence and appropriate recipient privately in Word.',
        'Review the auto-filled intake summary, remove any incorrect or irrelevant selections, sign and retain a copy.', 'Downloading is NOT filing. Use a verified secure channel for any submission.');
      if(!nonsexual && s['w.need']==='procedure')emit(3,'Obtain the applicable inquiry procedure',
        'You asked to understand procedural steps after a complaint.',
        'POSH Act §§10, 11; applicable rules','You','Ask the confirmed IC/LC for the applicable procedure, notice process and communication channel; conciliation is not compulsory.',
        'Keep genuine acknowledgements and procedural notices.', 'Respond to actual notices and deadlines, with assistance where needed.');
      if(!nonsexual && s['w.need']==='authority' && !actions.some(a=>/Committee|reporting authority/.test(a.title)))emit(3,'Obtain the receiving authority’s verified contact',
        'The workplace/district and current committee contact must be determined; this app has not identified a named officer.',
        'POSH Act §§4, 6','You','Check the published IC order or obtain District Officer/LC details from an official source.',
        'Retain name, designation, district and mode of contact.', 'Only then address the complaint.');
      notices.push('All answers are self-reported. This browser has not contacted any committee, employer, police or district office.');
    } else {
      if(['reported','informal','unknown'].includes(s['r.notice']))emit(2,'Confirm whether formal proceedings exist',
        `You selected: ${s['r.notice']==='informal'?'informal allegation only':s['r.notice']==='reported'?'complaint reportedly filed, no copy':'status unclear'}. Do not assume a written complaint, statutory notice or inquiry has been served.`,
        'Fair-process guidance','You','Request case status through the proper official channel, without directly contacting or pressuring the complainant or witnesses.',
        'Preserve any communication actually received and its date.', 'Review the formal allegations if and when properly communicated.');
      if(s['r.allegations']!=='complete')emit(1,'Request clear allegations and relied-upon material',
        `Material status: ${s['r.allegations']==='partial'?'some material received':s['r.allegations']==='none'?'no written particulars':s['r.allegations']==='disputed'?'service/completeness disputed':'not verified'}.`,
        'Central Rule 7, where applicable','You / Committee','Send a neutral written request specifying the complaint copy, relied-upon attachments and any document references missing.',
        'List each missing item and the date/mode of actual service, if known.', 'Ask for a reasonable response opportunity under the governing rules.');
      if(s['r.notice']==='formal' && s['r.serviceDate'])emit(2,'Confirm the applicable written-reply deadline',
        `Reported actual receipt: ${s['r.serviceDate']}. Central Rule 7(3), when applicable, speaks of up to ten working days from receipt of specified documents. Please verify service rules: the operative date depends on applicable rules, receipt and holidays.`,
        'Central Rule 7(3)','You / Committee','Ask the Committee to confirm which rules apply, the documents treated as served and the reply deadline; do not calculate a final deadline from this screen.',
        'Retain envelope/email headers, attachments, receiving stamp and any deadline communication.', 'Prepare a reply after checking the operative timeline and material supplied.');
      if(s['r.concern']==='bias')emit(2,'Record the specific conflict concern',
        'You indicated potential Committee bias; an assertion without factual particulars is not a determination of bias.',
        'Fairness / applicable service rules','You / Committee','Identify the member, objective facts and how those facts relate to potential conflict; request a reasoned procedural response.',
        'Keep only relevant existing correspondence or appointment information.', 'Wait for the competent procedural decision; do not presume recusal.');
      if(['service','access','materials','other'].includes(s['r.concern']))emit(2,'Document the identified procedural difficulty',
        `You selected: ${({'service':'notice or hearing service','access':'illness, accessibility or attendance','materials':'missing materials','other':'other/uncertain issue'})[s['r.concern']]}.`,
        'Fair opportunity','You / Committee','Describe the specific missed document, hearing notice, accommodation needed or practical difficulty through an appropriate written request.',
        'Keep any notices, medical certificate if voluntarily used or relevant correspondence.', 'Ask for a documented direction before the affected step proceeds.');
      if(s['r.notice']==='completed'||s['r.stage']==='appeal')emit(2,'Review findings and remedy deadlines',
        'You indicated that an inquiry has concluded or sought appeal guidance. The tool has no copy of findings or governing service rules.',
        'POSH Act §§13,18','You','Obtain the communicated findings/order, record the actual communication date and identify the applicable service-rule appeal forum.',
        'Keep the signed order and proof of when you received it.', 'Verify the applicable limitation and available relief before preparing an appeal.');
      if(['records','witnesses','both'].includes(s['r.evidence']))emit(3,'Preserve identified evidence lawfully',
        `You indicated ${s['r.evidence']==='both'?'records and potential witnesses':s['r.evidence']==='records'?'relevant records':'potential witnesses'}.`,
        'Fair procedure','You','Make a private index of genuine records or witnesses, noting what allegation each may address. Do not alter originals or approach witnesses improperly.',
        'Keep original metadata, capture dates and sources where legitimately available.', 'Disclose and rely on material only through appropriate inquiry procedure.');
      emit(3,'Prepare an allegation-wise, factually accurate response',
        s['r.reply']==='yes'?'You reported having already submitted a reply. Consider a supplementary submission only if requested or procedurally permitted.':s['r.reply']==='partial'?'You reported a partial reply. Distinguish information already provided from material still outstanding.':'You have not recorded a complete filed reply.',
        'Fair procedure / Central Rule 7 where applicable','You','Use the editable Word response matrix to distinguish each allegation as admitted, disputed or not known, supported by actual facts and genuine material.',
        'Attach only authentic evidence and references actually possessed; do not invent denials, testimony or admissions.', 'Verify the Committee’s directions and actual submission requirements before sending.');
      notices.push('No presumption of guilt or malicious complaint is made. This tool has not contacted the Committee.');
    }
    return {actions:actions.sort((a,b)=>a.priority-b.priority),notices,eligibleDoc,s,answers:answeredLabels(role,s)};
  }
  return {SOURCES,questions,stages,conditionMatches,activeQuestions,activeAnswers,indiaDay,validAnswer,stageReady,nextStage,previousStage,addMonthsClamped,outcome};
});
