'use strict';

const ACT='https://www.indiacode.nic.in/bitstream/123456789/2104/1/A2013-14.pdf';
const RULES='https://spniwcd.wcd.gov.in/uploads/pdf/1719914401_2NUqe91gql.pdf';
const tiers={essential:1,professional:2,advanced:3};
const labels={essential:'Inquiry Essential',professional:'Inquiry Professional',advanced:'Inquiry Advanced'};

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
  ['Document control','Record the draft version, reviewer code and restricted distribution.'],
  ['Proceeding reference','Use the approved internal code. Keep the identity key offline.'],
  ['Committee constitution','Cite the appointment and composition record.'],
  ['Authority and jurisdiction','Record the Committee’s reasons and source references.'],
  ['Members and roles','Record member codes and actual functions.'],
  ['Conflicts and substitutions','Record checks, decisions, reasons and applicable directions.'],
  ['Applicable procedure','Identify the governing service rules or applicable prescribed procedure.'],
  ['Complaint and receipt','Cite the actual complaint and receipt record.'],
  ['Limitation review','Record applicable dates and any reasoned extension decision.'],
  ['Scope of allegations','Identify each allegation code and the scope actually notified.'],
  ['Conciliation status','Record the actual route and relevant direction. Keep settlement material restricted.'],
  ['Interim measures','Record the application, recommendation and response, if any.'],
  ['Notice and service','Cite proof of actual issue, service and material supplied.'],
  ['Reply and position','Identify the reply or actual opportunity to respond.'],
  ['Hearing schedule','Cite the hearing diary and actual dates.'],
  ['Attendance and quorum','Cite sitting-level records and any corrective action.'],
  ['Absence and adjournments','Cite reasons, notices and governing procedure.'],
  ['Participation arrangements','Record accommodation and language arrangements where applicable.'],
  ['Aggrieved woman’s account','Cite the relevant record and material actually considered.'],
  ['Respondent’s account','Cite the relevant record and material actually considered.'],
  ['Witness accounts','Cite witness codes, relevant statements and opportunity to test them.'],
  ['Evidence register','Reconcile the controlled register and original custody.'],
  ['Electronic and documentary material','Record provenance, integrity issues and review references.'],
  ['Disclosure and responses','Record which material was supplied, when and any direction.'],
  ['Objections and rulings','Cite reasoned decisions on recorded objections.'],
  ['Allegation matrix','Reconcile allegation codes and supporting and contrary evidence.'],
  ['Applicable legal tests','Identify only governing provisions and verified authorities actually relied on.'],
  ['Supporting material','Explain the bearing of supporting material allegation by allegation.'],
  ['Contrary material','Explain the bearing of contrary material and alternative accounts.'],
  ['Reliability and weight','Record the Committee’s reasons, uncertainty and limits.'],
  ['Material not relied on','Record what was excluded or given no weight and the reasons.'],
  ['Preliminary findings and representations','Where applicable, cite disclosure of findings and representations.'],
  ['Allegation-wise reasons','Set out the Committee’s own reasoning for each allegation.'],
  ['Findings','Enter only the Committee’s actual findings.'],
  ['Recommendations','Record the Committee’s reasoned recommendations within the governing framework.'],
  ['Compensation review if applicable','Cite actual Section 15 considerations and reasons, where relevant.'],
  ['Separate Section 14 consideration','Record this only if applicable. Lack of proof does not establish malice.'],
  ['Annexure and exhibit index','Reconcile approved markings, attachment and disclosure.'],
  ['Statutory and service-rule index','List sources actually relied on, with precise provision references.'],
  ['Judgment index','List verified decisions actually relied on with citations and pinpoint references.'],
  ['Confidentiality and circulation','Record the approved recipient list and redaction decisions.'],
  ['Approval and signatures','Complete only after the Committee’s actual review and authorisation.'],
  ['Delivery and implementation record','Track actual delivery and follow-up separately from findings.'],
  ['Appeal and custody note','Record applicable route, custody and any actual directions without deciding outcomes.']
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
    plan, label:labels[plan], sources:{act:ACT,rules:RULES}, toolkit,
    ...(level>=2?{readiness,reportSections,knowledge}:{}),
    ...(level>=3?{advanced}:{})
  };
}
module.exports={getPlanTools,tiers};

