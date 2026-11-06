(function(root){'use strict';
const woman={
start:{sections:'Sections 2(n) and 3(2)',meaning:'Check unwelcome sexual conduct and related workplace circumstances together. Uncertainty is not a finding.',next:'Choose the closest description without entering names or incident narratives.'},
safety:{sections:'Sections 12 and 19',meaning:'Interim measures and workplace safety are separate from deciding the complaint.',next:'Address urgent safety needs first. Use the protection and reporting guidance relevant to your answers.'},
conduct:{sections:'Sections 2(n) and 3(2)',meaning:'The conduct and surrounding workplace circumstances need assessment together.',next:'Select what best describes the concern. You can revise an answer before preparing your next steps.'},
workplace:{sections:'Sections 2(a) and 2(o)',meaning:'Workplace coverage can extend beyond the office; employment status alone does not settle coverage.',next:'Consider the work connection and setting. Keep identifying details in your own records.'},
timeline:{sections:'Section 9(1)',meaning:'Ordinarily three months from the incident or last incident; a reasoned extension up to three further months may apply.',next:'Check actual dates and any explanation for delay. The competent Committee reviews limitation.'},
forum:{sections:'Sections 4 and 6',meaning:'Check the competent IC or LC, including the applicable LC route for a complaint against the employer.',next:'Use verified Committee or District Officer contact details. This website cannot file or forward a complaint.'},
next:{sections:'Sections 10, 11 and 13',meaning:'Conciliation requires the aggrieved woman’s request before inquiry; otherwise follow the applicable inquiry procedure.',next:'Review your action plan and every draft before use. The Committee makes the legal decisions.'}
};
const respondent={
start:{sections:'Section 11 and applicable service rules',meaning:'Receiving a complaint does not itself establish the allegations.',next:'Use the actual notice and documents. Distinguish what is known from what still needs clarification.'},
notice:{sections:'Central Rule 7(2) and 7(3), where applicable',meaning:'A reply is due within ten working days of receiving the prescribed documents where Central Rule 7 applies.',next:'Check actual receipt and the applicable rules before calculating time; dispatch alone is not receipt.'},
preparation:{sections:'Section 11 and applicable Rule 7',meaning:'Respond to each allegation and seek a fair opportunity to address the material.',next:'Preserve original records. Separate admissions, denials and matters you cannot confirm; do not invent facts.'}
};
function forStage(role,stage){const row=(role==='woman'?woman:respondent)[stage]||(role==='woman'?woman.start:respondent.start);return{...row,title:'Sections and guidance for this step',limit:'This is procedural guidance, not a finding or filing service. Apply the rules relevant to your workplace.'};}
const api={forStage};if(typeof module!=='undefined')module.exports=api;else root.NavigatorGuidanceContext=api;
})(typeof window==='undefined'?globalThis:window);
