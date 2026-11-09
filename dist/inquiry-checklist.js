
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
  let order,storageKey,completed=new Set(),pending=false,expiresAt=0,expiryTimer;

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
  function storageIssue(){
    const message=$('checklist-local-status');
    message.textContent='This browser could not save ticks. They are available in this tab while it remains open.';
    message.hidden=false;
  }
  function toggle(event){
    const input=event.target;
    if(input.type!=='checkbox'||input.disabled||content.hidden)return;
    if(Date.now()>=expiresAt){lock('The 120-day online access period has ended.');return;}
    const number=Number(input.value);
    if(input.checked)completed.add(number);
    else completed.delete(number);
    showCount();
    try{localStorage.setItem(storageKey,JSON.stringify([...completed]));}
    catch{storageIssue();}
  }
  function render(data){
    order=data.orderId;
    storageKey='navigator-inquiry-checklist:'+order+':'+data.edition;
    completed=new Set();
    $('checklist-local-status').hidden=true;
    try{
      const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');
      if(Array.isArray(saved))completed=new Set(saved.filter(n=>Number.isInteger(n)&&n>=1&&n<=43));
    }catch{storageIssue();}
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
    showCount();
  }
  function lock(message){
    clearTimeout(expiryTimer);
    content.hidden=true;
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
    if(pending)return;
    pending=true;
    try{
      const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
      const data=await response.json();
      if(!response.ok){
        lock(data.error||'Checklist access is temporarily unavailable.');
        return;
      }
      expiresAt=Date.parse(data.accessUntil);
      if(!Number.isFinite(expiresAt)||Date.now()>=expiresAt){lock('The 120-day online access period has ended.');return;}
      if(order!==data.orderId)render(data);
      $('checklist-expiry').textContent='Online access until '+dayTime.format(expiresAt)+' IST.';
      actions.hidden=true;
      status.textContent='';
      content.hidden=false;
      clearTimeout(expiryTimer);
      if(expiresAt-Date.now()<86400000)expiryTimer=setTimeout(()=>lock('The 120-day online access period has ended.'),Math.max(0,expiresAt-Date.now()));
    }catch{lock('Checklist access could not be verified. Please try again.');}
    finally{pending=false;}
  }
  $('checklist-stages').addEventListener('change',toggle);
  $('checklist-retry').addEventListener('click',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
  setInterval(()=>{if(!document.hidden&&!content.hidden)void check();},60000);
  void check();
})();

