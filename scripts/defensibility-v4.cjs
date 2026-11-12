'use strict';
// POSH Navigator v4 legal-design audit. This is a decision support inventory, not an adjudication.
// Class M = mandatory when governing law makes it applicable; J = judicial safeguard;
// E = enhanced audit control. The actual inquiry file is retained by the institution.
const groups=[
{code:'A',name:'Legality, competence and independence',items:[
['Report identifier, date, status and controlled version','E','R'],
['Correct report type: preliminary, statutory or disciplinary','J','R'],
['Competent IC/LC forum including employer-respondent cases','M','R+F'],
['Correct statutory employer and receiving authority','M','R+F'],
['Aggrieved-woman status under Section 2(a)','M','R'],
['Respondent status and employment relationship','M','R'],
['Workplace nexus under Section 2(o)','M','R'],
['Valid constitution order, tenure and replacements','M','R+F'],
['Eligible members, external member and minimum women members','M','R+F'],
['Conflicts, independence, objections and recusal','J','R+F']
]},
{code:'B',name:'Complaint, limitation and preliminary route',items:[
['Original complaint, receipt date and filing particulars','M','R+F'],
['Assistance in writing or Rule 6 authorised filing','M','R+F'],
['Three-month limitation and documented statutory extension','M','R'],
['Connected-series nexus and later-event limitation analysis','J','R'],
['Separate incident and allegation inventory','E','R'],
['Section 2(n) conduct and Section 3(2) initial classification','M','R'],
['Scope and material jurisdiction objections decided','J','R'],
['Section 10 request, lawful conciliation or settlement-breach route','M','R+F'],
['Section 12 interim request and employer implementation','M','R+F']
]},
{code:'C',name:'Notice, hearing and natural justice',items:[
['Identify applicable service rules and prescribed procedure','M','R'],
['Actual inquiry chronology and Section 11(4) 90-day review','M','R+F'],
['Rule 7(1) complaint materials and required copies','M','F','rule7'],
['Rule 7(2) seven-working-day forwarding','M','F','rule7'],
['Rule 7(3) ten-working-day defence opportunity','M','F','rule7'],
['Actual service, receipt and re-service evidence','J','R+F'],
['Precise allegations communicated to respondent','J','R'],
['Adverse evidence disclosed for meaningful reply','J','R+F'],
['Fresh material disclosed and tested before reliance','J','R+F'],
['Reasonable preparation time under circumstances','J','R+F'],
['Meaningful opportunity for each party and witnesses','J','R+F'],
['Material witness production and refusal reasons','J','R+F'],
['Fair process to question and test disputed testimony','J','R+F'],
['Safe examination without automatic direct confrontation','J','R'],
['Neutral Committee questions and accurate records','J','R+F'],
['Rule 7(7) hearing quorum where governing','M','F','rule7'],
['Rule 7(6) practitioner restriction where governing','M','F','rule7'],
['Rule 7(5) three absences and 15-day advance notice','M','R+F','rule7'],
['Independent evidence assessment after valid ex parte steps','J','R'],
['Reasoned procedural objections and prejudice review','J','R+F']
]},
{code:'D',name:'Evidence authenticity and reliability',items:[
['Stable exhibit and witness identifiers','E','R+F'],
['Original, copy, screenshot and summary distinguished','E','F'],
['Relevance and probative value under inquiry standard','J','R'],
['Electronic provenance and contextual metadata','E','F'],
['Sensitive record custody, access and movement','E','F'],
['Contested provenance or authenticity resolved fairly','J','R+F'],
['Contemporaneous supporting and exculpatory records','J','R'],
['Direct observations distinguished from indirect accounts','J','R'],
['Complete material questions, answers and corrections','E','F'],
['Material contradictions evaluated with reasons','J','R'],
['Unavailable, destroyed and contrary material considered','J','R'],
['Full context of communications and evidentiary limitations','J','R']
]},
{code:'E',name:'Allegation-wise reasoned findings',items:[
['Each material allegation framed as separate issue','J','R'],
['Section 2(n) statutory elements applied to the conduct','M','R'],
['Relevant Section 3(2) circumstances linked to harassment','J','R'],
['Preponderance of probabilities, never criminal proof burden','J','R'],
['Identified supporting exhibits and their weight','J','R'],
['Respondent rebuttal and contrary exhibits addressed','J','R'],
['Witness credibility supported by record-based reasons','J','R'],
['Significant testimony and documentary conflicts resolved','J','R'],
['Corroboration assessed without automatic eyewitness demand','J','R'],
['Workplace context analysed without stereotypes','J','R'],
['Plausible alternative explanations evaluated','J','R'],
['No collective guilt or undisclosed material allegations','J','R'],
['Exact conduct proved, partly proved or not proved with reasons','J','R']
]},
{code:'F',name:'Findings representation and finalisation',items:[
['Section 11(1) findings supplied where both are employees','M','R+F','both-employees'],
['Meaningful opportunity and actual party representations','M','R+F','both-employees'],
['Reasoned consideration before finalisation','J','R','both-employees'],
['Final rationality and contradiction check','J','R']
]},
{code:'G',name:'Findings, recommendations and relief',items:[
['Section 13(2) no-action conclusion for unproved allegation','M','R','not-proved'],
['Section 13(3)(i) misconduct recommendation if proved','M','R','proved'],
['Action within powers and proportionate to proven conduct','J','R','proved'],
['Reasoned Section 15 factors if compensation recommended','M','R','compensation'],
['Separate Section 14 safeguards for malicious complaint','M','R','section14'],
['Separate Section 14(2) safeguards for false evidence','M','R','section14'],
['Correct employer handover and further disciplinary steps','M','R'],
['Report does not unlawfully prejudge other proceedings','J','R']
]},
{code:'H',name:'Authentication, communication and appeal',items:[
['Members, signatures, date and recorded dissent if any','E','R+F'],
['Section 13(1) ten-day report submission','M','R+F'],
['Report availability to concerned parties and proof','M','F'],
['Sections 16–17 privacy and lawful party access','M','R+F'],
['Correct current Section 18 appeal route and period','M','R'],
['Restricted indexed evidence and procedural record','E','F'],
['Section 13(4) 60-day employer action tracking','M','F'],
['Independent legal risk review and signed release decision','E','R+F']
]}];
const sections=groups.map(g=>({code:g.code,title:g.name,count:g.items.length}));
const checks=groups.flatMap(g=>g.items.map((item,index)=>({
 number:groups.slice(0,groups.indexOf(g)).reduce((n,r)=>n+r.items.length,0)+index+1,
 id:g.code+String(index+1).padStart(2,'0'),domain:g.code,domainTitle:g.name,
 title:item[0],classification:item[1],location:item[2],condition:item[3]||'general'
})));
if(checks.length!==84)throw Error('V4 audit must have exactly 84 controls');
const gates=[
['G1','Applicable legal authority and effective date'],
['G2','Forum, constitution and impartiality'],
['G3','Maintainability, limitation and allegation scope'],
['G4','Notice, disclosure, examination and hearing fairness'],
['G5','Reliable evidence and allegation-wise reasoning'],
['G6','Representations on findings wherever required'],
['G7','Lawful report type, findings and recommendations'],
['G8','Authentication, delivery, confidentiality and appeal']
].map(([id,title],index)=>({id,title,domain:sections[index].code}));
const reports=[
{id:'jurisdiction',label:'Jurisdiction / maintainability decision',note:'Never invent a merits finding.'},
{id:'conciliation',label:'Lawful conciliation settlement or closure',note:'Section 10 route only where its prerequisites are met.'},
{id:'preliminary',label:'Preliminary fact-finding record',note:'Do not predetermine a later formal disciplinary inquiry.'},
{id:'statutory',label:'Full Section 13 statutory inquiry report',note:'Allegation-wise findings and reasons, Committee approval required.'},
{id:'disciplinary',label:'Formal service-rule disciplinary inquiry report',note:'Requires the actual governing disciplinary rules.'},
{id:'special',label:'Special-regime report (including UGC/LC)',note:'Apply additional binding sectoral provisions.'},
{id:'referral',label:'Referral / other procedural disposal',note:'No fictional finding or unauthorised forum.'}
];
const challenges=[
['T01','Fewer than ten workers','Evaluate LC route under Section 6.'],
['T02','Complaint against employer','Determine LC forum under Section 6.'],
['T03','Ten or more workers but no valid IC','Do not assume LC jurisdiction: legal decision needed.'],
['T04','Complaint filed in fifth month','Check reasoned Section 9 extension, not automatic acceptance.'],
['T05','Later unrelated workplace grievance','Do not use it to restart sexual-harassment limitation.'],
['T06','Central Government cross-department respondent','Determine cross-workplace jurisdiction and applicable CCS process.'],
['T07','Employer panel counsel as external member','Review independence and conflict carefully.'],
['T08','Late disclosure of decisive adverse record','Require meaningful response opportunity before reliance.'],
['T09','Three missed hearings','Verify Rule 7(5) safeguards only where applicable.'],
['T10','Contested digital screenshot','Consider origin, completeness, integrity, weight and disclosure.'],
['T11','No eyewitness','No automatic independent corroboration requirement.'],
['T12','Both parties employed but findings undisclosed','Apply Section 11(1) representation safeguard.'],
['T13','Preliminary report prematurely orders penalty','Separate fact-finding and disciplinary decision.'],
['T14','Complaint not proved and malice alleged','Section 14 demands independent proof and safeguards.'],
['T15','University student-employee complaint','Apply relevant UGC regulations, constitution and student rights.'],
['T16','Minor involved','Assess separate POCSO Section 19 reporting immediately.'],
['T17','Compensation recommendation without Section 15 analysis','Require statutory factor review and reasons.'],
['T18','Independent appeal while discipline pending','Check Section 18 right and current competent forum.']
].map(([id,title,expected])=>({id,title,expected}));
const legalSources=[
{id:'POSH',title:'POSH Act 2013',url:'https://www.indiacode.nic.in/bitstream/123456789/2104/1/A2013-14.pdf',verification:'Primary text; verify as amended for case date'},
{id:'RULES',title:'POSH Rules 2013',url:'https://spniwcd.wcd.gov.in/uploads/pdf/1719914401_2NUqe91gql.pdf',verification:'Verify operative rule and service-rule interplay'},
{id:'SCP',title:'Supreme Court legal principles',verification:'Verify exact judgment text and pinpoint before quoting; no automated case citation certification'},
{id:'UGC',title:'UGC 2015 regulations / 2016 notification',verification:'Check institutional applicability and operative version'},
{id:'LABOUR',title:'Industrial Relations Code transition',verification:'Confirm effective law, saving provisions and appellate authority as of relevant date'}
];
const statuses=['unverified','pass','not-applicable','remediation','legal-determination','fundamental-defect'];
function applicability(check,context={}){
 if(check.condition==='rule7'){
  if(context.procedure==='prescribed')return {applies:true,reason:'Rule 7 prescribed procedure selected; confirm applicability.'};
  return {applies:null,reason:'Determine whether Rule 7 governs under Section 11 and service rules before marking not applicable.'};
 }
 if(check.condition==='both-employees'){
  if(context.bothEmployees==='yes')return {applies:true,reason:'Section 11(1) second proviso applies where both parties are employees.'};
  if(context.bothEmployees==='no')return {applies:false,reason:'Not both employees; verify any corresponding applicable-service-rule opportunity.'};
  return {applies:null,reason:'Employment status of both parties needs legal verification.'};
 }
 if(['proved','not-proved','compensation','section14'].includes(check.condition))
  return {applies:null,reason:'Conditional on Committee findings or separate statutory determination; do not pre-judge.'};
 return {applies:true,reason:'Review applicability against actual forum and governing law.'};
}
function route(context={}){
 let report=context.report||'statutory',flags=[];
 if(context.conciliation==='completed')report='conciliation';
 if(context.forum==='unknown')flags.push('Competent IC/LC forum unresolved: do not finalise merits.');
 if(context.respondentEmployer===true)flags.push('Complaint against employer: examine Section 6 LC jurisdiction.');
 if(context.workers>=10&&context.icValid===false)flags.push('At least ten workers but invalid or missing IC: legal forum determination required; no automatic LC substitution.');
 if(context.procedure==='unknown')flags.push('Service-rule applicability unresolved: verify the current binding procedure.');
 if(context.bothEmployees==='unknown')flags.push('Employment status unresolved: verify Section 11(1) representation rights.');
 if(context.hei)flags.push('Higher-education institution: check applicable UGC framework and student composition.');
 if(context.minor)flags.push('Child involved: separately assess immediate POCSO Section 19 reporting.');
 if(context.crossEmployer||context.employmentRelationship==='different')flags.push('Cross-employer matter: verify jurisdiction, respondent rules and enforceable recommendations. Assess the Section 11(1) second proviso by employment status.');
 if(context.inquiryPath==='domestic'&&context.conciliation!=='completed'){
  if(!['jurisdiction','referral'].includes(report))report='referral';
  flags.push('Domestic-worker pathway: verify Local Committee authority and the prima facie police-referral decision under Section 11(1). Section 11(2) addresses compensation after conviction.');
 }
 if(context.inquiryPath==='third-party'&&context.conciliation!=='completed'&&!['jurisdiction','referral'].includes(report))report='referral';
 if(context.conciliation==='completed'&&context.report==='statutory')flags.push('Completed Section 10 settlement: avoid continuing merits inquiry unless breach route arises.');
 if(context.procedure==='ccs'&&context.report==='statutory')flags.push('Assess distinct preliminary and disciplinary stages under applicable CCS (CCA) rules.');
 if(context.appealForum==='unknown')flags.push('Determine current Section 18 forum, including legal transition and savings; never infer forum from repealed citation.');
 return {report,flags};
}
function publicData(){return {version:'4.0',sections,checks,gates,reports,challenges,legalSources,statuses};}
module.exports={groups,checks,sections,gates,reports,challenges,legalSources,statuses,applicability,route,publicData};
