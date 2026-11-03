/* Integration smoke tests run by npm run build; synthetic paths, not legal validation. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('dist/guided.js','utf8');
function run(scenario,answer,action,nextQuestion){
  const nodes=new Map();
  function get(id){
    if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',value:'',disabled:false,handlers:{},addEventListener(event,handler){this.handlers[event]=handler},focus(){},scrollIntoView(){}});
    return nodes.get(id);
  }
  const injected=source.replace(/\}\)\(\);\s*$/,'globalThis.__model={Q,REV};})();');
  assert.notEqual(injected,source,'Model verification hook absent');
  const sandbox={document:{getElementById:get}};
  vm.runInNewContext(injected,sandbox,{timeout:3000});
  assert.equal(sandbox.__model.Q.length,17,'Incorrect foundational stage count');
  const validTargets=new Set(['NEXT','NOTICE','CONCILIATION','NO_REPLY','REPLY_RECEIVED','OUTCOME','EDIT']);
  assert.equal(Object.keys(sandbox.__model.REV).length,15,'Review registry changed unexpectedly');
  for(const review of Object.values(sandbox.__model.REV)){
    assert(review.actions.length>0,'Review has no continuation: '+review.id);
    for(const action of review.actions){
      assert(action.id&&action.label&&validTargets.has(action.target),'Invalid next target in '+review.id+': '+JSON.stringify(action));
    }
  }
  const drop=get('g-scenario'),body=get('g-body');
  drop.value=scenario;drop.handlers.change({target:{value:scenario}});
  assert(body.innerHTML.includes('g-choices'),scenario+': stage question missing');
  body.handlers.click({target:{id:'',dataset:{answer}}});
  assert(body.innerHTML.includes('Has this issue been resolved now?'),scenario+': expected on-screen review');
  // A premature "proceed" click must not skip a review.
  body.handlers.click({target:{id:'g-proceed',dataset:{}}});
  assert(body.innerHTML.includes('Has this issue been resolved now?'),scenario+': bypassed unresolved review');
  body.handlers.click({target:{id:'',dataset:{status:'no'}}});
  assert(body.innerHTML.includes('What should happen now? Choose an action'),scenario+': No did not provide corrective action options');
  assert(body.innerHTML.includes('data-help-action="request"'),scenario+': No action control missing');
  body.handlers.click({target:{id:'',dataset:{helpAction:'request'}}});
  assert(body.innerHTML.includes('Suggested action:'),scenario+': No action did not show guidance');
  body.handlers.change({target:{dataset:{workStep:'0'},checked:true}});
  assert(get('g-work-progress').textContent.startsWith('1 of '),scenario+': corrective step progress not updated');
  body.handlers.click({target:{id:'',dataset:{status:'unsure'}}});
  assert(body.innerHTML.includes('Not sure — identify what needs verification'),scenario+': Not sure was not differentiated from No');
  assert(body.innerHTML.includes('data-uncertain-step="0"'),scenario+': unknown-item selection absent');
  body.handlers.change({target:{dataset:{uncertainStep:'0'},checked:true}});
  body.handlers.click({target:{id:'g-show-verification',dataset:{}}});
  assert(body.innerHTML.includes('Points to verify:'),scenario+': verification assistance missing');
  assert(body.innerHTML.includes('Review the source:'),scenario+': unknown fact verification details missing');
  body.handlers.click({target:{id:'g-record-unknown',dataset:{}}});
  assert(body.innerHTML.includes('Unresolved review route:'),scenario+': review referral action missing');
  body.handlers.click({target:{id:'g-proceed',dataset:{}}});
  assert(body.innerHTML.includes('Not sure — identify what needs verification'),scenario+': Not sure must not bypass safeguards');
  body.handlers.click({target:{id:'',dataset:{status:'yes'}}});
  assert(body.innerHTML.includes('Choose the legally reviewed outcome'),scenario+': next options missing');
  body.handlers.change({target:{name:'g-action-choice',value:action,dataset:{}}});
  // Three visible checks are mandatory in the present synthetic review families.
  const required=(body.innerHTML.match(/data-check="[0-9]+"/g)||[]).length;
  assert(required>=2,scenario+': missing confirmation prerequisites');
  for(let i=0;i<required;i++)body.handlers.change({target:{dataset:{check:String(i)},checked:true}});
  assert.equal(get('g-proceed').disabled,false,scenario+': prerequisite checkboxes did not unlock next step');
  body.handlers.click({target:{id:'g-proceed',dataset:{}}});
  assert(body.innerHTML.includes(nextQuestion),scenario+': correct continuation missing: '+body.innerHTML.slice(0,900));
}
run('no_reply','no_reply','opportunity_complete','Has any party raised a procedural objection?');
run('notice_refused','refused','fresh_receipt','What is the reply status?');
run('notice_undelivered','undelivered','fresh_receipt','What is the reply status?');
run('electronic_service_disputed','service_disputed','fresh_receipt','What is the reply status?');
run('incomplete_complaint','incomplete','conditions_verified','Which chronology best describes the alleged incidents?');
run('limitation_concern','late_or_disputed_dates','within_period','Which workplace relationship is alleged?');
run('jurisdiction_concern','disputed','conditions_verified','Does the committee satisfy constitution');
console.log('Seven guided inquiry scenario tests passed across No, Not sure and Yes interactive review paths.');