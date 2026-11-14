(function(){
'use strict';
const queue=document.getElementById('editorial-queue');
const status=document.getElementById('editorial-status');
const endpoint='/api/knowledge/admin/reactions';
const reasons={outdated:'Possibly outdated',citation:'Citation issue',unclear:'Unclear wording',context:'Missing context'};
const states={open:'Open','under-review':'Under review',reviewed:'Reviewed',updated:'Updated'};
function element(parent,tag,text){
 const node=document.createElement(tag);
 if(text!==undefined)node.textContent=text;
 parent.append(node);
 return node;
}
async function load(){
 status.textContent='Loading review suggestions…';
 try{
  const response=await fetch(endpoint);
  if(!response.ok)throw Error('Review queue unavailable');
  const rows=await response.json();
  queue.replaceChildren();
  status.textContent=rows.length?rows.length+' question records':'No review suggestions yet.';
  for(const row of rows){
   const section=element(queue,'section');
   section.className='editorial-entry';
   const link=element(section,'a',row.title||row.question);
   link.href='/#faq/'+encodeURIComponent(row.question);
   const tally=Object.entries(row.reasons||{}).filter(([,n])=>n>0).map(([key,n])=>reasons[key]+' '+n);
   element(section,'p',states[row.status]+' · '+row.total+' review suggestions'+(row.latest?' · Latest '+new Date(row.latest).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'}):'')+(tally.length?' · '+tally.join(' · '):''));
   const label=element(section,'label','Editorial status ');
   const select=element(label,'select');
   for(const [key,value] of Object.entries(states)){
    if(key==='open'&&row.status!=='open')continue;
    select.add(new Option(value,key));
   }
   select.value=row.status;
   const noteLabel=element(section,'label','Public update note ');
   const note=element(noteLabel,'textarea');
   note.maxLength=500;
   noteLabel.hidden=true;
   const save=element(section,'button','Save editorial status');
   save.type='button';
   save.className='btn btn-light';
   save.disabled=true;
   select.onchange=()=>{
    noteLabel.hidden=select.value!=='updated';
    save.disabled=select.value==='open';
   };
   save.onclick=async()=>{
    if(select.value==='updated'&&!note.value.trim()){status.textContent='Enter a public update note before saving.';note.focus();return;}
    save.disabled=true;
    try{
     const response=await fetch(endpoint+'?question='+encodeURIComponent(row.question),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:select.value,...(select.value==='updated'?{note:note.value.trim()}:{})})});
     if(!response.ok)throw Error('Could not save the editorial status.');
     await load();
    }catch(error){status.textContent=error.message;save.disabled=false;}
   };
  }
 }catch(error){status.textContent=error.message;}
}
load();
})();
