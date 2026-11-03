(function(root){
'use strict';
const DAY=86400000;
const fields=['receipt','commenced','firstMeeting','completed','reportSubmitted','partiesSupplied','recommendationsReceived','implemented','conciliationRequested','settled','settlementForwarded','settlementCopies','breachReported'];
function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))throw Error('Enter a valid calendar date.');const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s)throw Error('Invalid calendar date.');return d;}
const iso=d=>d.toISOString().slice(0,10);
function indiaDay(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));const part=type=>parts.find(x=>x.type===type).value;return `${part('year')}-${part('month')}-${part('day')}`;}
function add(s,n){const d=date(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);}
function working(s,n,calendar){if(!calendar?.verified)throw Error('Verify the applicable working calendar first.');const weekends=calendar.weekends||[0,6];if(!Array.isArray(weekends)||weekends.some(x=>!Number.isInteger(x)||x<0||x>6)||new Set(weekends).size===7)throw Error('Invalid working calendar.');let d=s;while(n){d=add(d,1);if(!weekends.includes(date(d).getUTCDay())&&!(calendar.holidays||[]).includes(d))n--;}return d;}
function create(){return {version:1,revision:0,dates:{},events:[],documents:[],audit:[],route:'inquiry',calendar:{verified:false,weekends:[0,6],holidays:[]},centralRules:false,commencementVerified:false,commencementBasis:'',procedure:'',conciliation:{},exception:null};}
// All accepted mutations append the previous and replacement values. Export retains the complete history.
function change(state,command,actor,reason,now=new Date().toISOString()){
 if(!actor?.trim()||!reason?.trim())throw Error('Record the responsible reviewer and reason.');
 const next=JSON.parse(JSON.stringify(state));
 if(command.type==='date'){if(!fields.includes(command.key))throw Error('Unknown milestone.');if(command.value){date(command.value);if(command.value>indiaDay(now))throw Error('Actual milestone dates cannot be in the future; use a planned event.');}next.dates[command.key]=command.value;}
 else if(command.type==='event'){
  const e=command.value;if(!['meeting','hearing','notice','response','evidence','witness','complaintSent','documentsReceived','reply','interimRelief','followup','exception'].includes(e.kind))throw Error('Unknown event.');date(e.date);if(!['planned','done','cancelled'].includes(e.status))throw Error('Select an event status.');if(e.status==='done'&&e.date>indiaDay(now))throw Error('Completed events cannot be future dated.');if(!e.reference?.trim())throw Error('A record reference is required.');if(e.followupDue)date(e.followupDue);if(e.status==='planned'&&(!e.owner||!e.followupDue))throw Error('Planned events need an owner and follow-up date.');const index=next.events.findIndex(x=>x.id===e.id);if(index<0)next.events.push({...e,id:String(next.revision+1)});else next.events[index]={...e};
 }
 else if(command.type==='document'){if(!/^[a-z-]{1,80}$/.test(command.id||''))throw Error('Invalid draft reference.');next.documents.push({id:command.id,action:'draft-download-requested',at:now,actor:actor.trim()});}
 else if(command.type==='settings'){for(const key of ['route','centralRules','calendar','commencementVerified','commencementBasis','procedure','conciliation','exception'])if(Object.hasOwn(command.value,key))next[key]=command.value[key];if(!['inquiry','conciliation'].includes(next.route))throw Error('Choose a principal route.');for(const holiday of next.calendar.holidays)date(holiday);}
 else throw Error('Unknown action.');
 const d=next.dates;
 for(const [a,b] of [['receipt','commenced'],['receipt','firstMeeting'],['commenced','completed'],['completed','reportSubmitted'],['reportSubmitted','recommendationsReceived'],['recommendationsReceived','implemented'],['conciliationRequested','settled'],['settled','settlementForwarded'],['settled','settlementCopies']])if(d[a]&&d[b]&&d[b]<d[a])throw Error(b+' cannot precede '+a+'. Correct the source record with a reason.');
 next.revision++;next.audit.push({revision:next.revision,at:now,actor:actor.trim(),reason:reason.trim(),command,before:command.type==='date'?state.dates[command.key]||null:command.type==='event'?state.events: {route:state.route,centralRules:state.centralRules,calendar:state.calendar,commencementVerified:state.commencementVerified,commencementBasis:state.commencementBasis,procedure:state.procedure,conciliation:state.conciliation,exception:state.exception}});return next;
}
function evaluate(s,today=indiaDay()){
 date(today);const d=s.dates,items=[];
 const issue=(id,message,action,owner='Committee')=>items.push({id,status:'verification-required',message,action,owner});
 function deadline(id,label,start,days,done,owner,work=false){if(!start)return;let due;try{due=work?working(start,days,s.calendar):add(start,days);}catch{issue(id,label+': working calendar is unverified.','Verify local working days and holidays; do not assume weekends alone.',owner);return;}const remaining=Math.round((+date(due)-date(today))/DAY),late=done&&done>due;items.push({id,label,due,done,remaining,status:done?(late?'completed-late':'completed'):remaining<0?'overdue':remaining===0?'due-today':remaining<= (days===90?30:days===60?15:3)?'alert':'scheduled',owner,escalation:!done&&remaining<0?'required':'none',action:done?(late?'Retain delay explanation and corrective review.':'Retain receipt / completion evidence.'):remaining<0?'Escalate to the responsible authority; record delay, recovery action and next review. No automatic extension or adverse decision.':'Confirm the owner and next action before the deadline.'});}
 if(!d.receipt)issue('receipt','Complaint receipt date is missing.','Verify actual Committee receipt and acknowledgement.');
 if(!s.procedure)issue('procedure','Applicable service / sector procedure is unverified.','Identify the applicable rules and record competent review before proceeding.');
 if(s.centralRules&&s.route!=='conciliation'){deadline('send','Forward complaint copy — Central Rule 7(2)',d.receipt,7,s.events.find(e=>e.kind==='complaintSent'&&e.status==='done')?.date,'Committee',true);const received=s.events.find(e=>e.kind==='documentsReceived'&&e.status==='done');if(received)deadline('reply','Reply — Central Rule 7(3)',received.date,10,s.events.find(e=>e.kind==='reply'&&e.status==='done')?.date,'Respondent',true);else issue('service','Actual receipt of prescribed documents is unverified.','Record service evidence; dispatch date does not trigger the reply period.');}
 if(s.route==='conciliation'){
  const c=s.conciliation,lawful=c.requestByWoman&&c.voluntary&&c.noMonetaryBasis&&d.conciliationRequested&&!d.commenced;
  if(!lawful)issue('conciliation','Section 10 safeguards are incomplete or inquiry has commenced.','Verify the woman’s pre-inquiry request, voluntariness and non-monetary basis; otherwise use the inquiry route after competent review.');
  const complete=lawful&&d.settled&&d.settlementForwarded&&d.settlementCopies;
  if(!complete)issue('settlement','Conciliation is not recorded as complete.','Record settlement, forwarding to employer / District Officer and copies to parties; if no settlement, return to inquiry.');
  if(d.breachReported)issue('breach','Settlement non-compliance has been reported by the aggrieved woman.','Committee to proceed under Section 11(1) proviso: inquiry or applicable police referral. Verify resumption basis; do not silently reset an existing clock.');
  if(!complete||d.breachReported)issue('next','Conciliation requires a next review.','Record an owned follow-up event and review date; unresolved conciliation is not a completed settlement.');
  for(const e of s.events)if(e.status==='planned'){deadline('event-'+e.id,e.kind+' / '+e.reference,e.date,0,null,e.owner||'Committee');if(e.followupDue)deadline('followup-'+e.id,'Review / '+e.reference,e.followupDue,0,null,e.owner||'Committee');}
  return {items,flow:complete&&!d.breachReported?'conciliation-complete':'conciliation-pending',canClose:!!complete&&!!d.receipt&&!!s.procedure&&!!d.implemented&&!d.breachReported&&!s.exception&&!s.events.some(e=>e.status==='planned')};
 }
 if(d.commenced&&s.commencementVerified&&s.commencementBasis)deadline('inquiry','Inquiry — Section 11(4)',d.commenced,90,d.completed,'IC / LC');else issue('commencement','Inquiry commencement is not verified.','Verify initiation from Committee records and applicable procedure. First meeting is a separate event, never an automatic trigger.');
 // Conservative receipt-based monitoring remains visible even when initiation is disputed or delayed.
 deadline('receipt-review','Receipt-based 90-day monitoring safeguard (not a substituted statutory trigger)',d.receipt,90,d.completed,'Committee reviewer');
 if(!d.firstMeeting)issue('first','First meeting date is missing.','Record the first meeting separately; schedule a hearing / verification follow-up.');
 deadline('report','Report to employer / District Officer — Section 13(1)',d.completed,10,d.reportSubmitted,'IC / LC');
 if(d.reportSubmitted&&!d.partiesSupplied)issue('parties','Report availability to concerned parties is unverified.','Record when the report was made available to parties under Section 13(1).');
 if(d.reportSubmitted&&!d.recommendationsReceived)issue('recommendations','Recipient’s actual receipt of recommendations is missing.','Obtain employer / District Officer acknowledgement; submission alone does not establish receipt.');
 deadline('implementation','Action on recommendations — Section 13(4)',d.recommendationsReceived,60,d.implemented,'Employer / District Officer');
 if(s.exception)issue('exception','Procedural exception: '+s.exception,'Record competent decision, legal basis, owner and review date. Adjournment, absence, referral or interim relief does not automatically pause, extend or close the inquiry.');
 for(const e of s.events)if(e.status==='planned'){deadline('event-'+e.id,e.kind+' / '+e.reference,e.date,0,null,e.owner||'Committee');if(e.followupDue)deadline('followup-'+e.id,'Review / '+e.reference,e.followupDue,0,null,e.owner||'Committee');}
 const canClose=!!(d.receipt&&d.commenced&&s.commencementVerified&&s.commencementBasis&&s.procedure&&d.firstMeeting&&d.completed&&d.reportSubmitted&&d.partiesSupplied&&d.recommendationsReceived&&d.implemented&&!s.exception&&!s.events.some(e=>e.status==='planned'));
 if(!canClose&&!s.events.some(e=>e.status==='planned'))issue('next','A next follow-up is needed.','Add an owned follow-up with a review date for the outstanding verification / milestone.');
 return {items,canClose,flow:canClose?'inquiry-report-complete':'inquiry-report-pending'};
}
const api={fields,date,add,indiaDay,working,create,change,evaluate};if(typeof module!=='undefined')module.exports=api;else root.NavigatorTimeline=api;
})(typeof window==='undefined'?globalThis:window);
