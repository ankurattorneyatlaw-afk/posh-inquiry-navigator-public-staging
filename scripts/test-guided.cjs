/* Browser-equivalent synthetic interaction regression tests, never real case content. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('dist/guided.js','utf8');
const continuation=fs.readFileSync('dist/guided-continuation.js','utf8');
const injected=source.replace(/\}\)\(\);\s*$/,'globalThis.__model={Q,REV};})();');
assert.notEqual(injected,source,'Guided model inspection hook is unavailable');

function launch(scenario='manual',timeline=null){
 const nodes=new Map();let prints=0;
 function get(id){
  if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',value:'',disabled:false,handlers:{},
    addEventListener(name,handler){this.handlers[name]=handler},querySelector(){return null},focus(){},scrollIntoView(){}});
  return nodes.get(id);
 }
 const sandbox={document:{getElementById:get},window:{print(){prints++},addEventListener(){}}};
 if(timeline)sandbox.window.NavigatorTimelineUI={getResult:()=>timeline,render(){}};
 vm.runInNewContext(continuation,sandbox,{timeout:3000});
 vm.runInNewContext(injected,sandbox,{timeout:3000});
 const model=sandbox.__model,drop=get('g-scenario'),body=get('g-body');
 drop.value=scenario;drop.handlers.change({target:{value:scenario}});
 const click=(properties)=>body.handlers.click({target:{id:'',dataset:{},...properties}});
 const answer=(value)=>click({dataset:{answer:value}});
 const resolution=(value)=>click({dataset:{status:value}});
 const action=(value)=>body.handlers.change({target:{name:'g-action-choice',value,dataset:{}}});
 const check=()=>{
  const required=(body.innerHTML.match(/data-check="[0-9]+"/g)||[]).length;
  assert(required>=2,'No review prerequisites displayed');
  for(let i=0;i<required;i++)body.handlers.change({target:{dataset:{check:String(i)},checked:true}});
  assert.equal(get('g-proceed').disabled,false,'Reviewed prerequisites did not enable action');
 };
 return {get,model,body,answer,resolution,action,check,click,get printed(){return prints}};
}
const registry=launch().model;
assert.equal(registry.Q.length,51,'Expected P01-P47 plus conciliation information and C01-C03');
assert.equal(Object.keys(registry.REV).length,33,'All foundational and continuation review types required');
const validTargets=new Set(['NEXT','NOTICE','CONCILIATION','NO_REPLY','REPLY_RECEIVED','OUTCOME','EDIT','C01']);
const knownStages=new Set(registry.Q.map(q=>q.id).concat(['P48','C04']));
for(const q of registry.Q){
 assert(q.prompt&&q.law&&q.opts.length>0,'Invalid stage '+q.id);
 for(const opt of q.opts){
  assert(opt.value&&opt.label&&opt.next,'Incomplete option in '+q.id);
  assert(knownStages.has(opt.next)||registry.REV[opt.next],'Missing route '+q.id+' / '+opt.value+' → '+opt.next);
 }
}
for(const r of Object.values(registry.REV)){
 assert(r.actions.length>0&&r.checks.length>0,'Review without assistance: '+r.id);
 for(const a of r.actions)assert(a.id&&a.label&&validTargets.has(a.target),'Invalid reviewed continuation in '+r.id+': '+JSON.stringify(a));
}
assert.equal(registry.REV.SETTLEMENT_CLOSURE_REVIEW.actions[0].target,'C01','Settlement must enter documented closure route');
assert.equal(registry.REV.FINDINGS_APPROVAL_REVIEW.actions[0].target,'EDIT','Unapproved findings must not pass to recommendations');
assert(registry.REV.SETTLEMENT_BREACH_ROUTE.checks.some(c=>c.includes('aggrieved woman')),'A settlement breach cannot progress without statutory complainant notification check');

function reviewScenario(scenario,answerValue,reviewAction,expectedNext){
 const c=launch(scenario);
 assert(c.body.innerHTML.includes('g-choices'),scenario+' initial question absent');
 c.answer(answerValue);
 assert(c.body.innerHTML.includes('Has this issue been resolved now?'),scenario+' review not shown');
 c.click({id:'g-proceed'});
 assert(c.body.innerHTML.includes('Has this issue been resolved now?'),scenario+' bypassed pending review');
 c.resolution('no');
 assert(c.body.innerHTML.includes('What should happen now? Choose an action'),scenario+' No corrective actions missing');
 c.click({dataset:{helpAction:'request'}});
 assert(c.body.innerHTML.includes('Suggested action:'),scenario+' No guidance unavailable');
 c.body.handlers.change({target:{dataset:{workStep:'0'},checked:true}});
 assert(c.get('g-work-progress').textContent.startsWith('1 of '),scenario+' follow-up tracking not updated');
 c.resolution('unsure');
 assert(c.body.innerHTML.includes('Not sure — identify what needs verification'),scenario+' uncertainty pathway missing');
 c.body.handlers.change({target:{dataset:{uncertainStep:'0'},checked:true}});
 c.click({id:'g-show-verification'});
 assert(c.body.innerHTML.includes('Points to verify:'),scenario+' verification not actionable');
 c.click({id:'g-record-unknown'});
 assert(c.body.innerHTML.includes('Unresolved review route:'),scenario+' review escalation missing');
 c.click({id:'g-proceed'});
 assert(c.body.innerHTML.includes('Not sure — identify what needs verification'),scenario+' unknown review bypassed');
 c.resolution('yes');
 c.action(reviewAction);
 c.check();
 c.click({id:'g-proceed'});
 assert(c.body.innerHTML.includes(expectedNext),scenario+' next step missing: '+c.body.innerHTML.slice(0,800));
}
reviewScenario('no_reply','no_reply','opportunity_complete','Has any party raised a procedural objection?');
reviewScenario('notice_refused','refused','fresh_receipt','What is the reply status?');
reviewScenario('notice_undelivered','undelivered','fresh_receipt','What is the reply status?');
reviewScenario('electronic_service_disputed','service_disputed','fresh_receipt','What is the reply status?');
reviewScenario('incomplete_complaint','incomplete','conditions_verified','Which chronology best describes the alleged incidents?');
reviewScenario('limitation_concern','late_or_disputed_dates','within_period','Which workplace relationship is alleged?');
reviewScenario('jurisdiction_concern','disputed','conditions_verified','Does the committee satisfy constitution');

{const c=launch('conciliation_closure_demo');
 assert(c.body.innerHTML.includes('What occurred in the lawful conciliation route?'));
 c.answer('settlement_recorded');
 assert(c.body.innerHTML.includes('Conciliation settlement and follow-up'),'Settlement must be independently reviewed');
 c.resolution('yes');c.action('settlement_recorded');c.check();c.click({id:'g-proceed'});
 assert(c.body.innerHTML.includes('Has the voluntary Section 10 settlement'),'Did not reach settlement recording');
 c.answer('recorded');
 assert(c.body.innerHTML.includes('Has the settlement been forwarded'),'Did not reach distribution');
 c.answer('completed');
 assert(c.body.innerHTML.includes('What is the implementation status'),'Did not reach implementation');
 c.answer('implemented');
 assert(c.body.innerHTML.includes('Conciliation closure and implementation record'),'No genuine Section 10 closure destination');
 assert(!c.body.innerHTML.includes('P18 Handoff'),'Unexpected old handoff');
 c.click({id:'g-print-preview'});
 assert.equal(c.printed,1,'Print preview handler missing');
}

{const c=launch('inquiry_report_demo');
 assert(c.body.innerHTML.includes('Has the complete inquiry closure checklist'),'P47 scenario not reachable');
 c.answer('complete');
 assert(c.body.innerHTML.includes('Inquiry report and administrative closure'),'No P48 inquiry report destination');
 assert(c.body.innerHTML.includes('Allegation-wise evidence appreciation'),'Inquiry report outline missing');
 assert(c.body.innerHTML.includes('Not proved'),'Committee-selected synthetic finding missing');
 assert(!c.body.innerHTML.includes('P18 Handoff'),'Old development handoff remains');
}

{const c=launch('inquiry_from_p18');
 for(let p=18;p<=47;p++){
  const stage='P'+String(p).padStart(2,'0');
  const q=registry.Q.find(x=>x.id===stage);
  assert(c.body.innerHTML.includes(q.prompt),'Inquiry halted at '+stage);
  c.answer(q.opts[0].value);
 }
 assert(c.body.innerHTML.includes('Inquiry report and administrative closure'),'Full P18–P47 navigation does not complete');
}

{const c=launch('inquiry_from_p18');
 for(let p=18;p<35;p++){const q=registry.Q.find(x=>x.id==='P'+String(p).padStart(2,'0'));c.answer(q.opts[0].value)}
 assert(c.body.innerHTML.includes('What allegation-wise findings'));
 c.answer('pending');
 assert(c.body.innerHTML.includes('Committee findings required'));
 c.resolution('yes');c.action('approved');
 assert(c.body.innerHTML.includes('Change originating answer'),'Unapproved finding must require inline correction');
 // No direct advance with an undecided committee finding.
 assert(!c.body.innerHTML.includes('data-check="0"'),'Unapproved finding must not expose automatic safeguard checkboxes');
 c.click({id:'g-proceed'});
 assert(c.body.innerHTML.includes('Committee findings required'),'Unapproved finding bypassed');
}

{const c=launch('conciliation_closure_demo');
 c.answer('settlement_recorded');
 c.resolution('yes');c.action('settlement_recorded');c.check();c.click({id:'g-proceed'});
 c.answer('recorded');c.answer('completed');c.answer('breached');
 assert(c.body.innerHTML.includes('Conciliation non-compliance'),'Breach must be reviewed');
 c.resolution('yes');c.action('breach_and_inquiry');c.check();c.click({id:'g-proceed'});
 assert(c.body.innerHTML.includes('What is the status of forwarding the complaint'),'Breach did not route into inquiry');
}
console.log('Guided flow tests: 7 exception scenarios, 2 terminal outcomes, P18–P47, findings gate and settlement breach PASS.');

{const c=launch('inquiry_report_demo',{canClose:false,flow:'inquiry-report-pending'});c.answer('complete');assert(c.body.innerHTML.includes('Timeline review required before completion'));assert(!c.body.innerHTML.includes('id="g-print-preview"'));}
{const c=launch('inquiry_report_demo',{canClose:true,flow:'conciliation-complete'});c.answer('complete');assert(c.body.innerHTML.includes('Timeline review required before completion'));}
{const c=launch('inquiry_report_demo',{canClose:true,flow:'inquiry-report-complete'});c.answer('complete');assert(c.body.innerHTML.includes('Inquiry report and administrative closure'));}
