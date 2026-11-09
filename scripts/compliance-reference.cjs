'use strict';

// The buyer records what they can verify from authorised correspondence.
// The committee's internal file remains in restricted custody.
const lc = {
  16: ['Can you verify that the Local Committee checked the filing time limit and recorded any extension?',
    'Authorised LC confirmation of the filing-window check and extension decision, where applicable.'],
  18: ['Can you verify when the Local Committee received the complaint and served it as required?',
    'LC acknowledgement and service confirmation showing dates. Track the reply separately.'],
  19: ['If conciliation took place, can you verify that the Local Committee followed the safeguards?',
    'Authorised LC confirmation of the aggrieved woman’s request before inquiry and that money was not the basis of settlement. If settled, verify communication to both parties.'],
  20: ['If interim relief was requested, can you verify that the Local Committee considered it and that the employer followed up on any recommendation?',
    'Authorised LC communication and the employer’s restricted implementation record, if applicable.'],
  21: ['Can you verify whether the Local Committee inquiry is on track or was completed within 90 days?',
    'LC status updates or completion confirmation with the relevant dates.'],
  22: ['Can you verify that the Local Committee sent its findings report to the employer or District Officer within 10 days of completion and made it available to both parties?',
    'Restricted receipt log or authorised LC confirmation showing completion, dispatch and availability to both parties.'],
  23: ['Were the Local Committee’s recommendations acted on within 60 days of receipt, and was the appeal route communicated?',
    'Restricted receipt and implementation dates for the responsible employer or District Officer, and confirmation that the appeal route was communicated.'],
  25: ['If the Local Committee considered action for a malicious complaint or false evidence, can you verify that it applied the statutory safeguards?',
    'Authorised LC confirmation of the applicable finding and recommendation.'],
  42: ['Can you verify that the Local Committee checked for conflicts of interest and dealt with any conflict it found?',
    'Authorised LC confirmation that it checked for conflicts and recorded any recusal.'],
  45: ['Can you verify that the Local Committee identified the applicable inquiry procedure and gave both parties a fair chance to respond?',
    'Authorised LC confirmation of the applicable procedure, notice and opportunity to respond.'],
  46: ['Can you verify that the Local Committee met the required quorum at each hearing where Rule 7 applied?',
    'Authorised LC confirmation of quorum for the relevant hearing dates.'],
  47: ['If the Local Committee ended a case or proceeded in a party’s absence under Rule 7, can you verify that it met the absence and notice conditions?',
    'Authorised LC confirmation of the qualifying absences, reasons assessment and advance notice.'],
  48: ['If the Local Committee recorded a settlement, can you verify implementation of the agreed terms and follow-up on any reported breach?',
    'Authorised LC correspondence and the employer’s restricted follow-up record for any action assigned to it.'],
  49: ['Can you verify that the Local Committee recorded reasons for its findings and applied the rules for action and compensation where relevant?',
    'Authorised confirmation or a restricted reference to the findings and any applicable recommendation.'],
  53: ['Can you verify that the Local Committee confirmed who should handle the complaint, including any coordination with another employer?',
    'Authorised LC routing or referral confirmation and the employer’s restricted coordination log, where applicable.'],
  54: ['Where Rule 7 applied, can you verify that the Local Committee checked the filing materials and explained the representation rules?',
    'Authorised LC intake confirmation and hearing instructions.']
};

const lcReferences = {
  16:'Authorised LC update LC-16 confirms the filing-window check and where the extension decision was recorded.',
  18:'LC acknowledgement LC-18 and authorised service confirmation give the receipt and service dates.',
  19:'Authorised LC confirmation LC-19 records the written request before inquiry, confirms the settlement basis, and gives the dispatch dates.',
  20:'LC recommendation LC-20 and restricted employer action log ACT-20 record the relief and implementation date.',
  21:'LC status update LC-21 gives the inquiry start and completion dates.',
  22:'LC confirmation LC-22 records completion on 2 Nov, dispatch to the District Officer on 5 Nov and the date the report was made available to both parties.',
  23:'Restricted action log ACT-23 records receipt of the LC recommendation, implementation date and how the appeal route was communicated.',
  25:'Authorised LC confirmation LC-25 identifies the restricted finding and safeguards applied.',
  42:'Authorised LC confirmation LC-42 records that conflicts were checked and any recusal was addressed.',
  45:'Authorised LC update LC-45 confirms the applicable procedure and that both parties had an opportunity to respond.',
  46:'Authorised LC update LC-46 confirms quorum for the relevant hearings.',
  47:'Authorised LC update LC-47 confirms the qualifying absences, assessment of reasons and advance notice.',
  48:'LC communication LC-48 and employer action log ACT-48 record implementation and follow-up on the reported breach.',
  49:'Authorised LC communication LC-49 identifies the restricted findings and applicable recommendation.',
  53:'Authorised LC referral confirmation LC-53 records which committee took the case.',
  54:'Authorised LC intake confirmation LC-54 and hearing instructions confirm the filing and representation checks.'
};

const examples = {
  8:{Yes:'Noticeboard photo LC-DISPLAY-02 shows complaint instructions. District LC contact checked against the official directory on 9 Nov.',
    No:'The noticeboard has no district LC contact or complaint instructions.',
    Partly:'The district LC contact is posted at reception. The complaint instructions are missing.',
    'Not sure':'The noticeboard lists a phone number. It still needs to be checked against the official district directory.'},
  10:{Yes:'POSH Policy v3 is posted on the staff noticeboard and under Policies on the intranet. Both copies checked on 9 Nov.',
    No:'The noticeboard still shows v2. Workers cannot access the approved v3.',
    Partly:'The intranet has v3. The staff noticeboard still shows v2.',
    'Not sure':'HR holds v3. Worker access to the latest version still needs to be checked.'},
  11:{Yes:'12 Oct awareness briefing. Agenda and facilitator details in TRAIN-04, with attendance for all 8 workers.',
    No:'The training calendar and attendance register show no employee POSH session during the review year.',
    Partly:'TRAIN-04 records 6 of 8 workers at the 12 Oct briefing. Catch-up is scheduled for the other 2 on 20 Nov.',
    'Not sure':'An invitation for the 12 Oct briefing is on file. Attendance and session delivery still need verification.'},
  29:{Yes:'Annual report, POSH disclosure on p. 8, records complaints filed and their disposal.',
    No:'The annual report omits POSH figures, and no district intimation is on file.',
    Partly:'The draft disclosure lists complaints filed. The disposal figures still need to be reconciled.',
    'Not sure':'The disclosure working paper is on file. The final annual report or district acknowledgement still needs to be checked.'},
  50:{'Not sure':'Last year’s district circular is on file. The reporting channel and deadline for the review year still need verification.'}
};

function referenceExamples(id, route) {
  const samples={...examples[id]};
  if (route==='LC'&&lc[id]) {
    const proof=lc[id][1].replace(/\.$/,'');
    const evidence=proof[0].toLowerCase()+proof.slice(1);
    Object.assign(samples,{
      Yes:lcReferences[id],
      No:'Authorised correspondence LC-GAP-01 confirms that the required step was missed.',
      Partly:'The case timeline is on file. It still needs to be checked against '+evidence+'.',
      'Not sure':id===46
        ?'Hearing dates are on file. Authorised confirmation of quorum is still pending.'
        :'The employer’s correspondence log is on file. Authorised confirmation from the Local Committee is still pending.'
    });
  }
  if (route==='LC'&&id===19) samples['Not triggered']='The Local Committee confirmed that it received no written request for conciliation.';
  return samples;
}

module.exports={lc,referenceExamples};
