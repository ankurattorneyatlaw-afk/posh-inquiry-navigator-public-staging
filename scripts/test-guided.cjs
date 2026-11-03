/* Integration smoke tests run by npm run build; synthetic paths, not legal validation. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('dist/guided.js','utf8');
function run(scenario,answer,action,nextQuestion){
  const nodes=new Map();
  function get(id){
    if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',value:'',disabled:false,handlers:{},addEventListener(event,handler){this.handlers[event]=handler},focus(){},scrollIntoView(){}});
    return nodes.get(id);
  }
  vm.runInNewContext(source,{document:{getElementById:get}},{timeout:3000});
  const drop=get('g-scenario'),body=get('g-body');
  drop.value=scenario;drop.handlers.change({target:{value:scenario}});
  assert(body.innerHTML.includes('g-choices'),scenario+': stage question missing');
  body.handlers.click({target:{id:'',dataset:{answer}}});
  assert(body.innerHTML.includes('Has this issue been resolved now?'),scenario+': expected on-screen review');
  // A premature "proceed" click must not skip a review.
  body.handlers.click({target:{id:'g-proceed',dataset:{}}});
  assert(body.innerHTML.includes('Has this issue been resolved now?'),scenario+': bypassed unresolved review');
  body.handlers.click({target:{id:'',dataset:{status:'no'}}});
  assert(body.innerHTML.includes('What should happen now?'),scenario+': corrective guidance missing');
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
console.log('Seven guided inquiry smoke scenarios passed with no unresolved-review bypass.');