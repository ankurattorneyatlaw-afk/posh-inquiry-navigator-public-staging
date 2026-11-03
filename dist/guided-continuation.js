/* POSH Inquiry Navigator staged continuation, P18-P47 and Section 10 completion.
   This is a synthetic procedural walkthrough, not a case manager or automated adjudicator.
   Legal requirements remain subject to jurisdiction, service rules and independent review. */
(function(root){
  'use strict';
  const S=(id,prompt,law,options)=>({
    id,prompt,law,
    opts:options.map(([value,label,next])=>({value,label,next}))
  });
  const stages=[
    S('P18','Have the committee identified the issues requiring inquiry?','Section 11 inquiry scope, admitted/disputed facts and relevant issues',[
      ['identified','Issues and disputed facts documented','P19'],
      ['unclear','Material factual issues remain unclear','ISSUES_REVIEW']]),
    S('P19','Is the hearing properly prepared and notified?','Section 11 and applicable rules; notice, materials, fair opportunity, quorum',[
      ['prepared','Hearing logistics, disclosure and participation checked','P20'],
      ['missing_notice','Notice, disclosure, access or quorum needs correction','HEARING_PREPARATION_REVIEW']]),
    S('P20','What is the participation status for the hearing?','Rule 7(5) where applicable; absence is not proof of allegations',[
      ['present','Parties have been offered meaningful participation','P21'],
      ['single_absence','A party is absent or seeks reasonable adjournment','HEARING_ATTENDANCE_REVIEW'],
      ['repeated_absence','Repeated absence raises ex-parte concerns','EXPARTE_REVIEW']]),
    S('P21','Has the applicable ex-parte or termination safeguard been considered?','Rule 7(5) only if applicable: three consecutive missed hearings without sufficient cause and fifteen days advance written notice',[
      ['not_applicable','No ex-parte or termination direction is proposed','P22'],
      ['reviewed','Competent committee has reviewed safeguards and recorded direction','P22'],
      ['unresolved','Necessary ex-parte safeguards are not verified','EXPARTE_REVIEW']]),
    S('P22','Has the complainant been given a fair opportunity to present her account?','Section 11 and natural justice; record actual Q&A and source',[
      ['completed','Opportunity provided, account and corrections referenced','P23'],
      ['pending','Examination, language assistance or correction is pending','TESTIMONY_REVIEW']]),
    S('P23','Has the respondent had a fair opportunity to answer the allegations?','Section 11 and natural justice; avoid conflating admissions of facts with misconduct',[
      ['completed','Opportunity provided, admissions and denials distinguished','P24'],
      ['unavailable','Participation or reply opportunity remains disputed','TESTIMONY_REVIEW']]),
    S('P24','Are material witness opportunities addressed?','Natural justice, relevant witnesses, fair questioning and protection from interference',[
      ['examined','Material witnesses and opportunity to challenge recorded','P25'],
      ['none','No material witness identified or available','P25'],
      ['unresolved','A witness is reluctant, unavailable or needs correction','WITNESS_REVIEW']]),
    S('P25','Have documentary records been indexed and fairly considered?','Section 11; provenance, authenticity, original/copy and access',[
      ['indexed','Documentary evidence indexed with opposing material','P26'],
      ['none','No documentary material submitted and this is recorded','P26'],
      ['missing','Material documents are missing or disputed','EVIDENCE_REVIEW']]),
    S('P26','Has electronic evidence been addressed appropriately?','Digital records, authenticity and applicable evidence law',[
      ['reviewed','Electronic items reviewed with provenance and objections','P27'],
      ['none','No electronic material relied upon','P27'],
      ['disputed','Authenticity, metadata or disclosure disputed','EVIDENCE_REVIEW']]),
    S('P27','Are new or late evidence requests resolved?','Natural justice, fair response opportunity, disclosure and late material',[
      ['none','No outstanding supplementary material','P28'],
      ['addressed','Late material addressed with response opportunity','P28'],
      ['pending','Late evidence or supplementary allegation awaits review','EVIDENCE_REVIEW']]),
    S('P28','Have procedural objections been addressed?','Section 11, hearing fairness, conflicts, disclosure and questioning restrictions',[
      ['addressed','Reasons and remedies documented','P29'],
      ['none','No outstanding material objection','P29'],
      ['pending','A material procedural objection requires decision','OBJECTION_REASONING_REVIEW']]),
    S('P29','Are interim relief and protection issues addressed?','Section 12 and lawful non-retaliation safeguards',[
      ['none','No current Section 12 request or concern identified','P30'],
      ['addressed','Request and authorised recommendations documented','P30'],
      ['pending','Safety, interim relief or retaliation risk outstanding','PROTECTION_REVIEW']]),
    S('P30','Has any interference or non-cooperation been addressed?','Natural justice and applicable protection powers; do not threaten witnesses',[
      ['none','No material interference identified','P31'],
      ['addressed','Interference assessed and safeguards documented','P31'],
      ['active','Pressure, retaliation or non-cooperation remains active','PROTECTION_REVIEW']]),
    S('P31','Is examination and evidence collection sufficiently complete?','Fair opportunity, remaining relevant questions and procedural closure',[
      ['complete','Material opportunities complete and omissions recorded','P32'],
      ['pending','Material evidence or hearing opportunity outstanding','EVIDENCE_REVIEW']]),
    S('P32','Is each allegation mapped to supporting and contrary records?','Provenance mapping: allegation to testimony, Q&A, evidence and issues',[
      ['complete','Allegation-wise source matrix reviewed','P33'],
      ['incomplete','Links to source material, admissions or contradictions missing','EVIDENCE_REVIEW']]),
    S('P33','Has the committee entered balanced evidence appreciation?','Committee reasoning, context, reliability, contrary evidence and fairness',[
      ['recorded','Reasoned evidence appreciation entered by committee','P34'],
      ['unresolved','Credibility or source conflict needs competent evaluation','EVIDENCE_REVIEW']]),
    S('P34','Is the governing legal and service-rule profile verified?','Applicable Act, Rules, service regulations and verified judicial propositions',[
      ['verified','Current relevant legal provisions and citations reviewed','P35'],
      ['uncertain','Sector rules, authority or citation uncertain','LEGAL_PROFILE_REVIEW']]),
    S('P35','What allegation-wise findings has the competent committee approved?','Section 13; findings must originate from the competent committee, never from the software',[
      ['not_proved','Committee has entered not proved findings with reasons','P36'],
      ['proved','Committee has entered proved findings with reasons','P36'],
      ['mixed','Committee has entered mixed findings with allegation-wise reasons','P36'],
      ['pending','Findings have not been approved','FINDINGS_APPROVAL_REVIEW']]),
    S('P36','Have permitted recommendations been considered separately from findings?','Section 13, service rules, proportionality and Section 14 safeguards',[
      ['not_required','No action recommendation is appropriate to the recorded findings','P37'],
      ['reasoned','Lawful recommendations with proportionality recorded','P37'],
      ['unreviewed','Recommendation authority or reasons unverified','RECOMMENDATIONS_REVIEW']]),
    S('P37','Has the separate compensation assessment been addressed?','Sections 13(3), 15; factors and jurisdiction may differ',[
      ['not_applicable','Compensation is not recommended after lawful review','P38'],
      ['assessed','Applicable Section 15 factors evaluated and recorded','P38'],
      ['pending','Compensation basis or facts require review','RECOMMENDATIONS_REVIEW']]),
    S('P38','Is the complete, sourced draft inquiry report assembled?','Section 13(1); allegation-wise reasons, authority, annexures and evidence',[
      ['assembled','Report draft assembled with source index and limitations','P39'],
      ['missing','Material report references or reasoning missing','REPORT_COMPLETENESS_REVIEW']]),
    S('P39','Has the report undergone fairness and appeal-readiness review?','Section 18 and judicial scrutiny; review is not a certificate of validity',[
      ['reviewed','Completeness and procedural vulnerability review done','P40'],
      ['defects','Material fairness or citation defects remain','REPORT_COMPLETENESS_REVIEW']]),
    S('P40','Is the applicable representation and final-approval process complete?','Section 11(1) representation against findings where applicable; competent authorisation of final document',[
      ['completed','Applicable representations and committee approval recorded','P41'],
      ['not_applicable','Correctly reviewed as not applicable, with reasons','P41'],
      ['pending','Representation or report approval remains pending','REPRESENTATION_REVIEW']]),
    S('P41','Is the inquiry report ready for authorised communication?','Section 13(1), lawful recipients and Section 16 confidentiality',[
      ['communicated','Recipient, method and lawful communication recorded','P42'],
      ['not_sent','Report circulation or access control unverified','CUSTODY_REVIEW']]),
    S('P42','Has implementation responsibility and status been addressed?','Section 13(4) where applicable; authorised action remains with employer/District Officer',[
      ['recorded','Implementation or lawful follow-up status recorded','P43'],
      ['pending','Implementation review, directions or delayed action pending','IMPLEMENTATION_REVIEW']]),
    S('P43','Have applicable appeal rights and forum been reviewed?','Section 18, governing service rules and current forum; do not assume universal appeal route',[
      ['advised','Applicable appeal information and limitation reviewed','P44'],
      ['not_relevant','No separate pending appeal task identified after review','P44'],
      ['uncertain','Appeal forum, limitation or proceeding unclear','LEGAL_PROFILE_REVIEW']]),
    S('P44','Have lawful disclosure or RTI-related requests been handled?','Section 16 confidentiality, RTI where applicable, party rights and exemptions',[
      ['none','No pending disclosure request','P45'],
      ['reviewed','Applicable disclosure rules and permissions reviewed','P45'],
      ['uncertain','Disclosure or RTI conflict unresolved','CUSTODY_REVIEW']]),
    S('P45','Is authorised records custody established?','Section 16, document access, original record custody, confidentiality',[
      ['established','Custodian, authorised access and handover documented','P46'],
      ['missing','Custody or access accountability missing','CUSTODY_REVIEW']]),
    S('P46','Is retention, preservation and lawful disposal addressed?','Applicable schedules, litigation hold and record-preservation duties (no universal fixed period)',[
      ['verified','Applicable retention and litigation-hold position reviewed','P47'],
      ['uncertain','Retention or preservation requirement unresolved','CUSTODY_REVIEW']]),
    S('P47','Has the complete inquiry closure checklist been reviewed?','Section 13 report, implementation, Section 18 guidance, confidentiality and custody',[
      ['complete','All applicable closure tasks reviewed and approval recorded','P48'],
      ['gaps','Material closure task remains outstanding','REPORT_COMPLETENESS_REVIEW']]),
    S('C01','Has the voluntary Section 10 settlement been correctly recorded?','Section 10(1)-(2): voluntary before inquiry, non-monetary basis, written settlement and recommendation',[
      ['recorded','Settlement and lawful terms recorded','C02'],
      ['pending','Settlement record or lawful terms need correction','SETTLEMENT_RECORD_REVIEW']]),
    S('C02','Has the settlement been forwarded and copies provided as required?','Section 10(2)-(3): forwarding to employer/District Officer; copy to both parties',[
      ['completed','Authorised forwarding and distribution documented','C03'],
      ['pending','Copies or forwarding are outstanding','SETTLEMENT_RECORD_REVIEW']]),
    S('C03','What is the implementation status of the conciliation settlement?','Sections 10 and 11: monitor implementation; failure may permit an inquiry',[
      ['implemented','Implementation verified and closure record ready','C04'],
      ['pending','Implementation is pending or uncertain','SETTLEMENT_IMPLEMENTATION_REVIEW'],
      ['breached','Settlement not complied with, inquiry route must be reviewed','SETTLEMENT_BREACH_ROUTE']])
  ];
  const R=(id,title,issue,checks,actions)=>({
    id,title,issue,checks,
    actions:actions.map(([id,label,target])=>({id,label,target}))
  });
  const reviews={
    ISSUES_REVIEW:R('ISSUES_REVIEW','Clarify issues for determination','The inquiry must identify relevant admitted and disputed facts without inventing issues.',[
      'List each actual allegation and known admissions and denials.',
      'Identify relevant facts that need witness or record examination.',
      'Document the committee-approved issues.'
    ],[['issues_recorded','Issues identified and recorded','NEXT']]),
    HEARING_PREPARATION_REVIEW:R('HEARING_PREPARATION_REVIEW','Correct hearing preparation','Notice, fair opportunity, participation and applicable quorum must be checked.',[
      'Check the hearing notice, delivery and relevant disclosure.',
      'Check accessibility, representation restrictions and applicable quorum.',
      'Record the committee direction and next hearing opportunity.'
    ],[['hearing_ready','Preparation and notices lawfully corrected','NEXT']]),
    HEARING_ATTENDANCE_REVIEW:R('HEARING_ATTENDANCE_REVIEW','Attendance and reasonable opportunity','A party being absent does not establish misconduct.',[
      'Identify actual attendance and reasons for absence.',
      'Consider postponement and fair opportunity under applicable procedure.',
      'Record the next lawful hearing direction.'
    ],[['attendance_resolved','Attendance and next fair opportunity addressed','NEXT']]),
    EXPARTE_REVIEW:R('EXPARTE_REVIEW','Ex-parte and termination safeguards','Rule 7(5) requires independent review where it applies: three consecutive absences without sufficient cause and fifteen days advance written notice.',[
      'Verify consecutive hearings and actual reasons for non-attendance.',
      'Verify the applicable Rule and fifteen-day advance written notice.',
      'Obtain competent committee direction without presuming guilt.'
    ],[['safeguards_reviewed','Safeguards and reasons confirmed by committee','NEXT']]),
    TESTIMONY_REVIEW:R('TESTIMONY_REVIEW','Actual testimony and fair examination','Do not fabricate or infer unanswered questions or testimony.',[
      'Identify the specific missing examination or clarification.',
      'Provide the fair opportunity and record actual Q&A and corrections.',
      'Preserve original record and committee-verified amendments.'
    ],[['testimony_complete','Fair examination and record verified','NEXT']]),
    WITNESS_REVIEW:R('WITNESS_REVIEW','Witness issues and protections','Unavailability, retraction or pressure require lawful fair-process review.',[
      'Identify relevant witness and actual availability without inventing evidence.',
      'Document permitted questioning, alternative measures and protections.',
      'Address disclosure and material response opportunities.'
    ],[['witness_addressed','Witness issue lawfully addressed','NEXT']]),
    EVIDENCE_REVIEW:R('EVIDENCE_REVIEW','Evidence, contradictions and source integrity','Evidence must be traceable and considered with supporting and contrary material.',[
      'Identify precisely which record, Q&A or disclosure is outstanding.',
      'Assess provenance, authenticity, contradictions and fair response opportunity.',
      'Record the committee response to missing or disputed material.'
    ],[['evidence_resolved','Evidence issue addressed with sources and reasons','NEXT']]),
    PROTECTION_REVIEW:R('PROTECTION_REVIEW','Protection and interference concerns','Section 12 safeguards and other remedies require competent, proportionate directions.',[
      'Document actual request, risk and interference without speculation.',
      'Distinguish statutory interim powers and employer safeguards.',
      'Refer urgent safety matters to appropriate assistance, with confidentiality.'
    ],[['protection_handled','Lawful protection or interference route addressed','NEXT']]),
    LEGAL_PROFILE_REVIEW:R('LEGAL_PROFILE_REVIEW','Applicable law and forum verification','Do not assert an unverified universal service rule, citation or appeal forum.',[
      'Identify the governing organisation, service rules and legal dates.',
      'Check authoritative statutes and judgment sources and subsequent treatment.',
      'Record the competent reviewer and a supported legal conclusion.'
    ],[['legal_verified','Applicable legal route independently verified','NEXT']]),
    FINDINGS_APPROVAL_REVIEW:R('FINDINGS_APPROVAL_REVIEW','Committee findings required','No software-selected finding can replace committee deliberation and approved reasons.',[
      'Resolve material evidence gaps and objections.',
      'Record allegation-wise reasons and committee deliberation.',
      'Obtain competent approval before preparing recommendations.'
    ],[['approved','Committee-entered findings and reasons approved','NEXT']]),
    RECOMMENDATIONS_REVIEW:R('RECOMMENDATIONS_REVIEW','Recommendations and compensation review','Discipline and compensation cannot be assigned automatically.',[
      'Separate findings from recommendations and Section 15 factors.',
      'Identify available options under applicable service rules.',
      'Document proportionality and lawful committee reasoning.'
    ],[['reviewed','Recommendations legally reviewed and justified','NEXT']]),
    REPORT_COMPLETENESS_REVIEW:R('REPORT_COMPLETENESS_REVIEW','Report completeness and closure review','Incomplete reports, missing findings or open objections cannot be called final.',[
      'Check source-linked allegations, evidence, Q&A and reasoned findings.',
      'Resolve remaining material procedural objections and communications.',
      'Obtain authorised report and closure approval.'
    ],[['report_complete','Outstanding report or closure gaps addressed','NEXT']]),
    REPRESENTATION_REVIEW:R('REPRESENTATION_REVIEW','Representation against findings and final approval','The Section 11 representation route depends on the applicable service-rule context.',[
      'Determine legally applicable representation process and timing.',
      'Provide and record opportunity as required by the applicable procedure.',
      'Obtain competent committee approval after material representation.'
    ],[['representation_complete','Representation and approval lawfully complete','NEXT']]),
    IMPLEMENTATION_REVIEW:R('IMPLEMENTATION_REVIEW','Implementation and authorised follow-up','Only the competent employer or District Officer can take statutory implementation action.',[
      'Identify the actual recommendation and intended recipient.',
      'Check the applicable time frame and proof of receipt.',
      'Record actions, delays and lawful escalation.'
    ],[['implementation_reviewed','Implementation and follow-up position documented','NEXT']]),
    CUSTODY_REVIEW:R('CUSTODY_REVIEW','Confidentiality, circulation and custody','Section 16 and any RTI/retention duties require an authorised access review.',[
      'Identify the correct recipients, lawful disclosure basis and controls.',
      'Assign an authorised custodian, access and preservation responsibilities.',
      'Apply governing retention schedules and litigation holds.'
    ],[['custody_reviewed','Distribution and custody controls verified','NEXT']]),
    SETTLEMENT_RECORD_REVIEW:R('SETTLEMENT_RECORD_REVIEW','Conciliation record and communication','A lawful Section 10 settlement cannot be bypassed by generic inquiry stages.',[
      'Check voluntary request and lawful non-monetary basis.',
      'Record settlement terms and forward to employer or District Officer.',
      'Provide copies to the aggrieved woman and respondent.'
    ],[['settlement_steps_verified','Settlement documentation and distribution complete','NEXT']]),
    SETTLEMENT_IMPLEMENTATION_REVIEW:R('SETTLEMENT_IMPLEMENTATION_REVIEW','Implementation still outstanding','Do not mark a conciliation record finally closed while implementation is unverified.',[
      'Review each obligation and its completion evidence.',
      'Request authorised follow-up from the employer or District Officer.',
      'If breached, assess the Section 11 route; otherwise update the status when verified.'
    ],[['implementation_confirmed','Implementation verified and completion documented','NEXT'],['implementation_breached','Non-compliance confirmed — inquiry route reviewed','NOTICE']])
  };
  const guides=Object.fromEntries(Object.values(reviews).map(r=>[r.id,[
    r.checks[0],
    r.checks[1],
    r.checks[2],
    r.title+' — review memorandum'
  ]]));
  const phase=(s)=>s.startsWith('C')?'Section 10 conciliation and closure':Number(s.slice(1))<=31?'Inquiry hearing and evidence':Number(s.slice(1))<=40?'Findings and inquiry report':'Post-inquiry and closure';
  function finalPreview(path,answers,encode){
    const esc=typeof encode==='function'?encode:s=>String(s);
    if(path==='C04'){
      return '<h2>Conciliation closure and implementation record</h2>'+
        '<div class="g-success"><strong>Section 10 settlement route completed — fictional checklist</strong><p>This is not a finding of misconduct or an inquiry report. No further Section 11 inquiry follows a lawful settlement, subject to the statutory non-compliance route.</p></div>'+
        '<h3>Draft closure-record structure (not ready to issue)</h3>'+
        '<ol><li>Committee and jurisdiction: [competent IC/LC and constitution order]</li><li>Voluntary request and date: [actual records]</li><li>Settlement terms and legal checks: [written terms, not a monetary basis]</li><li>Section 10(2) forwarding: [recipient, date and method]</li><li>Section 10(3) copies to parties: [documented distribution]</li><li>Employer/District Officer implementation: [evidence and status]</li><li>Closure review and restricted record custody: [authorised sign-off]</li></ol>'+
        '<p class="g-mini">All placeholders are intentionally blank. This is a non-operative checklist until a legally reviewed template and authorised records are supplied.</p>';
    }
    const f={not_proved:'Not proved',proved:'Proved',mixed:'Mixed allegation-wise findings'}[answers.P35]||'Not entered';
    const r={not_required:'No action recommendation indicated',reasoned:'Reasoned recommendations entered'}[answers.P36]||'Unreviewed';
    const c={not_applicable:'No compensation recommended after assessment',assessed:'Section 15 factors considered'}[answers.P37]||'Unreviewed';
    return '<h2>Inquiry report and administrative closure</h2>'+
      '<div class="g-success"><strong>P01–P47 procedural walkthrough completed — fictional checklist</strong><p>The report remains a committee-authored and approved legal document. The software has not adjudicated facts or verified an actual case.</p></div>'+
      '<h3>Inquiry report outline (not a final legal report)</h3>'+
      '<ol><li>Committee authority and applicable law: [reviewed source and order]</li><li>Complaint chronology and allegation identifiers: [original source]</li><li>Notices, service and reply opportunities: [proof and dates]</li><li>Hearing minutes and actual Q&A: [verified testimony]</li><li>Documents, electronic records and witness matrix: [source index]</li><li>Allegation-wise evidence appreciation: [committee-entered reasons]</li><li>Committee-approved findings: <strong>'+esc(f)+'</strong> (synthetic selection only)</li><li>Disciplinary recommendations: '+esc(r)+' (synthetic selection only)</li><li>Compensation assessment: '+esc(c)+' (synthetic selection only)</li><li>Representations, report authentication and annexures: [applicable records]</li><li>Section 13 communication, implementation, appeals and custody: [actual records]</li></ol>'+
      '<p class="g-mini">Placeholders identify required real records. Do not copy this sample as an operative report.</p>';
  }
  root.PoshGuidedContinuation={stages,reviews,guides,phase,finalPreview};
})(typeof globalThis!=='undefined'?globalThis:this);
