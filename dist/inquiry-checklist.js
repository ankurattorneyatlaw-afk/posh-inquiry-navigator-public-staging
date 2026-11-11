
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const status=$('checklist-status');
  const content=$('checklist-content');
  const actions=$('checklist-actions');
  const query=new URLSearchParams(location.search);
  const requested=query.get('order');
  const endpoint='/api/checklist/content'+(requested===null?'':'?order='+encodeURIComponent(requested));
  const dayTime=new Intl.DateTimeFormat('en-IN',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Kolkata'});
  let order,completed=new Set(),pending=false,saving=false,revision=0,expiresAt=0,expiryTimer;

  function create(parent,tag,text){
    const node=document.createElement(tag);
    if(text)node.textContent=text;
    parent.append(node);
    return node;
  }
  function showCount(){
    $('checklist-progress').value=completed.size;
    $('checklist-count').textContent=completed.size+' of 43 checked';
  }
  function saveStatus(message){
    const node=$('checklist-save-status');
    node.textContent=message;
    node.hidden=!message;
  }
  function validTicks(ticks){
    return Array.isArray(ticks)?ticks.filter(n=>Number.isInteger(n)&&n>=1&&n<=43):[];
  }
  function applyProgress(ticks){
    completed=new Set(validTicks(ticks));
    for(const input of $('checklist-stages').querySelectorAll('input[type=checkbox]'))input.checked=completed.has(Number(input.value));
    showCount();
  }
  async function saveProgress(id,change){
    const response=await fetch('/api/checklist/progress?order='+encodeURIComponent(id),{
      method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(change),signal:AbortSignal.timeout(10000)
    });
    const data=await response.json();
    if(!response.ok)throw Object.assign(Error(data.error||'Checklist progress could not be saved.'),{status:response.status});
    return data.checked;
  }
  async function importBrowserTicks(data){
    const key='navigator-inquiry-checklist:'+data.orderId+':'+data.edition;
    let local;
    try{local=validTicks(JSON.parse(localStorage.getItem(key)||'[]'));}catch{return data.checked;}
    if(!local.length)return data.checked;
    try{
      const checked=await saveProgress(data.orderId,{importChecked:local});
      try{localStorage.removeItem(key);}catch{}
      saveStatus('Previous ticks from this browser were imported to your account.');
      return checked;
    }catch(error){
      if([401,403,410].includes(error.status))throw error;
      saveStatus('Previous ticks are still on this browser. We’ll retry importing them when access is checked again.');
      return data.checked;
    }
  }
  async function toggle(event){
    const input=event.target;
    if(input.type!=='checkbox'||input.disabled||content.hidden||saving)return;
    if(Date.now()>=expiresAt){lock('The 120-day online access period has ended.');return;}
    saving=true;
    revision++;
    const inputs=[...$('checklist-stages').querySelectorAll('input[type=checkbox]')];
    inputs.forEach(box=>box.disabled=true);
    saveStatus('Saving to your account…');
    try{
      const checked=await saveProgress(order,{number:Number(input.value),checked:input.checked});
      if(content.hidden)return;
      applyProgress(checked);
      saveStatus('Saved to your account.');
    }catch(error){
      if([401,403,410].includes(error.status)){lock(error.message);return;}
      if(!content.hidden){
        applyProgress([...completed]);
        saveStatus('This change could not be confirmed. Check your connection and try again.');
      }
    }finally{
      inputs.forEach(box=>box.disabled=false);
      saving=false;
    }
  }
  function render(data){
    order=data.orderId;
    $('checklist-edition').textContent='Edition '+data.edition;
    $('checklist-holder').textContent='Licensed organisation: '+data.organisation;
    const stages=$('checklist-stages');
    const nav=$('checklist-stage-links');
    stages.replaceChildren();
    nav.replaceChildren();
    for(const [index,stage] of data.stages.entries()){
      const panel=create(stages,'section');
      panel.className='panel checklist-stage';
      panel.id='checklist-stage-'+(index+1);
      const link=create(nav,'a','Stage '+(index+1));
      link.href='#'+panel.id;
      link.setAttribute('aria-label','Stage '+(index+1)+'. '+stage.title);
      const heading=create(panel,'h2',stage.title);
      heading.id=panel.id+'-title';
      panel.setAttribute('aria-labelledby',heading.id);
      if(stage.note)create(panel,'p',stage.note);
      const list=create(panel,'ul');
      for(const item of stage.items){
        const li=create(list,'li');
        const label=create(li,'label');
        const input=create(label,'input');
        input.type='checkbox';
        input.value=String(item.number);
        input.checked=completed.has(item.number);
        create(label,'span',String(item.number).padStart(2,'0')+'. '+item.text);
      }
    }
    const sourcePanel=$('checklist-sources');
    const list=sourcePanel.querySelector('ul');
    list.replaceChildren();
    for(const source of data.sources){
      if(!source.url.startsWith('https://'))continue;
      const link=create(create(list,'li'),'a',source.title);
      link.href=source.url;
      link.target='_blank';
      link.rel='noopener noreferrer';
    }
    sourcePanel.hidden=!list.children.length;
    if(data.legalAudit&&window.NavigatorDefensibilityV4)window.NavigatorDefensibilityV4.mount($('v4-inquiry-audit'),data.legalAudit,{id:'v4-inquiry-review'});
    showCount();
  }
  function lock(message){
    clearTimeout(expiryTimer);
    content.hidden=true;
    $('v4-inquiry-audit').replaceChildren();
    actions.hidden=false;
    status.textContent=message;
    if(order){
      $('checklist-stages').replaceChildren();
      $('checklist-stage-links').replaceChildren();
      $('checklist-sources').querySelector('ul').replaceChildren();
      $('checklist-holder').textContent='';
      order=null;
    }
  }
  async function check(){
    if(pending||saving)return;
    pending=true;
    const started=revision;
    try{
      const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
      const data=await response.json();
      if(started!==revision)return;
      if(!response.ok){
        lock(data.error||'Checklist access is temporarily unavailable.');
        return;
      }
      expiresAt=Date.parse(data.accessUntil);
      if(!Number.isFinite(expiresAt)||Date.now()>=expiresAt){lock('The 120-day online access period has ended.');return;}
      const checked=await importBrowserTicks(data);
      if(started!==revision)return;
      if(order!==data.orderId)render(data);
      applyProgress(checked);
      $('checklist-expiry').textContent='Online access until '+dayTime.format(expiresAt)+' IST.';
      actions.hidden=true;
      status.textContent='';
      content.hidden=false;
      clearTimeout(expiryTimer);
      if(expiresAt-Date.now()<86400000)expiryTimer=setTimeout(()=>lock('The 120-day online access period has ended.'),Math.max(0,expiresAt-Date.now()));
    }catch(error){if(started===revision)lock([401,403,410].includes(error.status)?error.message:'Checklist access could not be verified. Please try again.');}
    finally{pending=false;}
  }
  $('checklist-stages').addEventListener('change',toggle);
  $('checklist-retry').addEventListener('click',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
  setInterval(()=>{if(!document.hidden&&!content.hidden)void check();},60000);
  void check();
})();

