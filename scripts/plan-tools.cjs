'use strict';

const ACT='https://www.indiacode.nic.in/bitstream/123456789/2104/1/A2013-14.pdf';
const RULES='https://spniwcd.wcd.gov.in/uploads/pdf/1719914401_2NUqe91gql.pdf';
const v4=require('./defensibility-v4.cjs');
const tiers={essential:1,professional:2,advanced:3,institutional:4,enterprise:5};
const labels={essential:'Inquiry Essential',professional:'Inquiry Professional',advanced:'Inquiry Advanced',institutional:'Institutional Plus',enterprise:'Enterprise'};

const readiness=[
  ['Before inquiry',[
    'Record the competent IC or LC, its constitution, applicable procedure and any conflicts.',
    'Check complaint timing, actual receipt and any extension decision against the record.',
    'Confirm the conciliation or inquiry route and document the basis without presuming consent.',
    'Verify notice, material supplied, opportunity to reply and hearing arrangements.'
  ]],
  ['Before report',[
    'Reconcile attendance, hearing records, disclosure and opportunity to respond.',
    'Review supporting and contrary material separately for each allegation.',
    'Check annexure references, outstanding objections and the Committee’s recorded reasons.',
    'Confirm the completion date and actual recipients for the Section 13 report.'
  ]],
  ['After report',[
    'Check delivery to the applicable employer or District Officer and availability to concerned parties.',
    'Record delivery and implementation evidence separately from draft generation.',
    'Track applicable implementation and appeal steps using actual trigger dates.',
    'Retain restricted records and use aggregate figures for annual reporting.'
  ]]
];

const reportSections=[
 ['Report identification, status and scope','Record the case reference, Committee or authority, version, date, confidentiality, and whether this is a jurisdictional, conciliation, preliminary, statutory, disciplinary, special-regime or referral document. Do not call a preliminary inquiry a final Section 13 finding.'],
 ['Applicable law, service rules and report pathway','Identify operative POSH Act provisions, any binding service rules, procedural applicability and effective date. Distinguish Rule 7 where applicable from another governing inquiry procedure; confirm the actual appellate forum.'],
 ['Committee constitution, independence and jurisdiction','Reference the IC/LC constitution order, member eligibility and tenure, recusal decisions, competent employer or District Officer, aggrieved woman and respondent status and workplace nexus.'],
 ['Complaint, maintainability, limitation and notified allegations','Identify original complaint and receipt, Section 9 time-limit and reasoned extension, issue-specific allegation codes, notifications and material objections to scope. Never replace original submissions with assumptions.'],
 ['Preliminary decisions, conciliation and interim measures','Record Section 10 route and settlement status, Section 12 written request and action, jurisdictional or limitation dispositions and competent directions only as applicable. A completed settlement requires the lawful closure route, not fabricated merits findings.'],
 ['Inquiry chronology, disclosure and procedural fairness','Trace actual notices, service and receipt, reply opportunities, witness questioning, sittings, quorum, absences, ex parte prerequisites, objections and reasons. Use actual dates and the correct governing procedure.'],
 ['Precisely framed issues for determination','Map each material notified allegation to the facts and statutory elements requiring determination; exclude allegations not fairly notified and legally out-of-scope questions.'],
 ['Evidence inventory, reliability and disputed material','Reference exhibits, witness records and original custody, electronic provenance, authenticity objections, nonproduction, relevant corroboration and material contrary evidence. Keep originals and personal identities in secure institutional custody.'],
 ['Parties’ material submissions, explanations and witness accounts','Present the complainant and respondent positions separately, admissions and denials, contested facts, relevant witness knowledge and alternative explanations without stereotyping.'],
 ['Allegation-wise evaluation and provisional findings','For each allegation separately assess Section 2(n)/3(2), supporting and contrary exhibits, credibility reasons, material contradictions, unavailable evidence, probability, limits and precisely stated provisional findings. Cross-reference the separate 14-field allegation matrix.'],
 ['Representations against findings and reconsideration','Where both parties are employees, record delivery of findings, meaningful opportunity and representations under the Section 11(1) second proviso and the Committee’s reasoned consideration; otherwise record the applicable service-rule position. Do not invent a fixed statutory response period.'],
 ['Final findings and legally authorised recommendations','State the precise conduct proved, partly proved or not proved, and reasoned Sections 13(2)/(3) conclusions; assess service-rule proportionality, Section 15 compensation factors and independent Section 14 safeguards where triggered. Never conflate fact-finding with employer penalty action.'],
 ['Authentication, restricted annexures, delivery and appeal','Record Committee authorisation, signatures, verified completion and dispatch dates, Section 13(1) delivery, Section 13(4) implementation follow-up, confidentiality, Section 18 current appeal forum and indexed secure annexures. Validate all eight legal release gates.']
];
const reportTypeChapters={
 jurisdiction:[0,1,2,3,4,12],
 conciliation:[0,1,2,3,4,12],
 preliminary:[0,1,2,3,4,5,6,7,8,9,12],
 statutory:[0,1,2,3,4,5,6,7,8,9,10,11,12],
 disciplinary:[0,1,2,3,4,5,6,7,8,9,10,11,12],
 special:[0,1,2,3,4,5,6,7,8,9,10,11,12],
 referral:[0,1,2,3,4,12]
};
const allegationMatrixFields=[
 'Allegation code and exact notified scope','Section 2(n) and relevant 3(2) elements',
 'Complainant’s material assertions','Respondent’s admission, denial or response',
 'Supporting exhibit and witness references','Contrary exhibits and exculpatory material',
 'Electronic provenance or authenticity dispute','Credibility reasons and material inconsistencies',
 'Missing or inaccessible evidence and effect','Alternative explanations and their evaluation',
 'Preponderance-of-probabilities analysis','Provisional finding and reasons',
 'Applicable representations on findings','Committee-approved final allegation-wise conclusion'
];

const toolkit=[
  ['Committee and workplace readiness',['Review IC constitution and coverage.','Check LC referral pathways and current contacts.','Keep policy, training and reporting arrangements current.']],
  ['Intake and first steps',['Prepare a private receipt channel and identify assistance needs.','Record actual receipt, verify authority and route promptly.','Use codes and keep originals in institutional custody.']],
  ['Hearing preparation',['Confirm applicable procedure and hearing arrangements.','Check attendance, service and fair opportunity.','Assign someone to maintain restricted records and follow-up.']],
  ['Closure and annual reporting',['Check delivery and action records.','Reconcile annual reporting totals with restricted registers.','Exclude identifying details and individual case narratives.']]
];

const knowledge=[
  ['Committee authority','Start with Sections 4–7 and 11. Check the applicable committee, constitution and governing procedure. Record the basis before proceeding.'],
  ['Conciliation and inquiry','Review Sections 10 and 11. Keep conciliation on its own route and document the actual request or outcome.'],
  ['Fair participation and evidence','Use applicable service rules or prescribed procedure. Record material shared, opportunities to respond, objections and reasoned directions.'],
  ['Findings and implementation','Use Sections 13–15 and 18. Record allegation-specific reasons, applicable recommendations, actual communication and follow-up.'],
  ['Confidentiality and annual reporting','Read Sections 16 and 21–22 and the applicable rules. Keep case records restricted and report required aggregate information.']
];

const advanced={
  scenarios:[
    ['party','Two respondents face overlapping allegations. A record relevant to one may identify a witness connected to the other.','Separate allegation and participant codes. Check scope, disclosure, responses and any protective direction for each affected person. Record a competent decision before using restricted material.'],
    ['jurisdiction','A workplace event involved people connected to more than one organisation.','Record each connection separately. Check authority and applicable procedure, identify relevant employers or officers and seek a competent decision on the proper route.'],
    ['remand','A competent authority sets aside part of a report and directs further consideration.','Record the exact direction and scope. Preserve the earlier record and dates. Identify the affected steps and give the applicable opportunities before recording fresh decisions.'],
    ['disclosure','An important document arrives after a recorded inquiry completion date.','Preserve the actual receipt and earlier history. Seek competent direction on further procedure, confidentiality and fair opportunity. Avoid assuming authority to reopen.']
  ],
  profiles:[
    ['Applicable employer service rules','Record the instrument, edition, effective date and clauses governing appointment, inquiry and appeal.'],
    ['Prescribed procedure where applicable','Record why the prescribed procedure applies and identify the operative rules.'],
    ['Public service or sector-specific framework','Record the applicable service instrument and disciplinary/appeal authority. Verify the interaction with POSH requirements.'],
    ['Multiple employers or disputed framework','Record the candidate instruments, authority question, competent reviewer and reasoned direction.']
  ]
};

function getPlanTools(plan) {
  if (!Object.hasOwn(tiers,plan)) return null;
  const level=tiers[plan];
  return {
    plan, label:labels[plan], reportAssembly:true, sources:{act:ACT,rules:RULES}, toolkit,
    legalAudit:v4.publicData(),
    reportOutline:reportSections,reportTypeChapters,allegationMatrixFields,
    ...(level>=2?{readiness,reportSections,knowledge}:{}),
    ...(level>=3?{advanced:{...advanced,scenarios:[...advanced.scenarios,...v4.challenges.map(c=>[c.id,c.title,c.expected])]}}:{})
  };
}
module.exports={getPlanTools,tiers};

