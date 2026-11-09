(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const order=new URLSearchParams(location.search).get('order')||'';
  const endpoint='/api/compliance-assessment?order='+encodeURIComponent(order);
  const form=$('scope'), fields=form.elements;
  let current=null,busy=false;
  const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  function notice(text){$('notice').textContent=text;}
  async function api(body) {
    const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(20000),
      ...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    const data=await response.json();
    if(response.status===401)$('signin').hidden=false;
    if(!response.ok)throw Error(data.error||'The request could not be completed.');
    return data;
  }
  async function run(work) {
    if(busy)return;
    busy=true;
    try{await work();}catch(e){notice(e.message);}finally{busy=false;}
  }
  function refreshScope() {
    const branch=fields.siteType.value!=='standalone';
    $('site-workers').hidden=!branch; fields.siteWorkers.required=branch;
    const company=fields.employer.value==='company';
    for(const node of document.querySelectorAll('[data-company]'))node.hidden=!company;
    fields.mca.required=fields.listed.required=company;
    fields.sebi.required=company&&fields.listed.value==='Yes';$('sebi').hidden=!fields.sebi.required;
    $('route-preview').textContent=fields.workers.value===''?'':Number(fields.workers.value)>=10?
      'IC route. A complaint against the employer uses the district LC route.':
      'LC route. IC-only checks are excluded.';
  }
  form.addEventListener('input',refreshScope);
  form.onsubmit=e=>{
    e.preventDefault();
    run(async()=>{
      const yes=name=>fields[name].value==='Yes';
      const scope={workplace:fields.workplace.value,district:fields.district.value,year:Number(fields.year.value),workers:Number(fields.workers.value),
        siteType:fields.siteType.value,siteWorkers:fields.siteWorkers.value===''?null:Number(fields.siteWorkers.value),
        complaints:yes('complaints'),employer:fields.employer.value,listed:yes('listed'),mca:yes('mca'),sebi:yes('sebi')};
      render(await api({action:'start',scope}));notice('Assessment started. Save each answer before moving on.');
    });
  };
  function input(label,type,value,max) {
    const wrap=el('label',label),node=el(type==='textarea'?'textarea':'input');
    if(type!=='textarea')node.type=type;
    if(max)node.maxLength=max;
    node.value=value||'';wrap.append(node);return {wrap,node};
  }
  function renderChecks() {
    const selected=$('topic').value;
    const list=$('checks');list.replaceChildren();
    for(const q of current.review.applicable) {
      const card=el('article');card.className='assessment-card';
      card.id='check-'+q.id;
      card.hidden=!!selected&&selected!==q.topic;
      const title=el('h3','P'+String(q.id).padStart(2,'0')+' · '+q.question);
      const meta=el('p',q.topic+' · '+q.priority+' · '+q.authority);meta.className='check-meta';
      card.append(title,meta,el('p','What to look for: '+q.proof));
      const next=el('p',q.next);next.className='next';card.append(next);
      if(current.final) {
        const a=q.answer;
        card.append(el('p',a.value+(a.evidence?' · '+a.evidence:'')));
        if(a.owner||a.due)card.append(el('p','Owner: '+(a.owner||'Unassigned')+' · Target: '+(a.due||'Unset')));
      }else{
        const entry=el('form'),grid=el('div');grid.className='assessment-grid';
        const label=el('label','Answer'), answer=el('select');answer.required=true;
        answer.append(new Option('Choose',''));
        for(const option of ['Yes','Partly','No','Not sure',...(q.conditional?['Not triggered']:[])])answer.append(new Option(option,option));
        answer.value=q.answer?.value||'';label.append(answer);
        const proof=input('Record reference or reason','textarea',q.answer?.evidence,300);
        const reviewer=input('Exclusion reviewer role','text',q.answer?.reviewer,80);
        const owner=input('Action owner or role','text',q.answer?.owner,80), due=input('Target date','date',q.answer?.due);
        grid.append(label,proof.wrap,reviewer.wrap,owner.wrap,due.wrap);
        function guidance(){
          const value=answer.value, excluded=value==='Not triggered', issue=['Partly','No','Not sure'].includes(value);
          reviewer.wrap.hidden=!excluded;reviewer.node.required=excluded;proof.node.required=excluded||value==='Yes';
          owner.wrap.hidden=due.wrap.hidden=!issue;
          const latest=current.review.applicable.find(item=>item.id===q.id);
          next.textContent=latest.blocked&&value!=='Not triggered'?latest.next:issue?(value==='Not sure'?'Verify the facts and collect evidence. ':'')+q.action:
            value==='Yes'?'Enter a short reference to the record you checked.':
            excluded?'Record why the condition did not arise and who reviewed it.':q.next;
        }
        answer.onchange=guidance;guidance();
        const save=el('button','Save answer');save.className='button';save.type='submit';
        entry.append(grid,save);card.append(entry);
        entry.onsubmit=e=>{e.preventDefault();run(async()=>{
          const saved=await api({action:'save',id:q.id,revision:current.revision,answer:{value:answer.value,
            evidence:proof.node.value,reviewer:reviewer.node.value,owner:owner.wrap.hidden?'':owner.node.value,due:due.wrap.hidden?'':due.node.value}});
          // Preserve unsaved inputs on other cards. Only update the saved result and progress.
          current=saved;updateProgress();
          for(const item of saved.review.applicable) {
            if(item.id===q.id||item.id===62)$('check-'+item.id).querySelector('.next').textContent=item.next;
          }
          notice('Answer saved for P'+String(q.id).padStart(2,'0')+'.');
        });};
      }
      list.append(card);
    }
  }
  function updateProgress() {
    const v=current.review;
    $('progress').textContent=(v.applicable.length-v.remaining)+' of '+v.applicable.length+' answered · '+v.open+' open actions';
    $('finish').disabled=!!v.remaining;
  }
  function render(state) {
    current=state;form.hidden=!!state.scope;$('review').hidden=!state.scope;
    if(!state.scope){fields.year.value=new Date().getFullYear();refreshScope();return;}
    const s=state.scope;
    $('scope-label').textContent=state.organisation+' · '+s.workplace+' · '+s.district+' · '+s.year+' · '+s.route+' route';
    const topic=$('topic'),old=topic.value;
    topic.replaceChildren(new Option('All sections',''));
    for(const item of new Set(state.review.applicable.map(q=>q.topic)))topic.append(new Option(item,item));
    if(Array.from(topic.options).some(x=>x.value===old))topic.value=old;
    $('excluded-label').textContent='Excluded by setup ('+state.review.excluded.length+')';
    $('excluded').replaceChildren(...state.review.excluded.map(q=>el('li','P'+String(q.id).padStart(2,'0')+' · '+q.title+' — '+q.reason)));
    $('finish').hidden=state.final;$('report').hidden=!state.final;
    if(state.final){$('report').href='/api/compliance-assessment/report?order='+encodeURIComponent(order);$('final-note').textContent='This assessment is final. Download the same report from this order whenever you need it.';}
    updateProgress();renderChecks();
  }
  $('topic').onchange=()=>{
    for(const q of current.review.applicable)$('check-'+q.id).hidden=!!$('topic').value&&$('topic').value!==q.topic;
  };
  $('reload').onclick=()=>run(async()=>{if(!confirm('Reload saved answers? Unsaved edits on this page will be discarded.'))return;render(await api());notice('Saved assessment loaded.');});
  $('finish').onclick=()=>run(async()=>{
    if(!confirm('Finalise the saved answers and lock this assessment? Unsaved edits will be omitted.'))return;
    render(await api({action:'finish',revision:current.revision}));notice('Assessment finalised. Your PDF is ready.');
  });
  run(async()=>{render(await api());notice(current.scope?'Saved assessment loaded.':'Verify the scope before starting.');});
})();
