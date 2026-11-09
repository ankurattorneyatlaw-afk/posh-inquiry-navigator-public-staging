'use strict';
const {stagingOrigin}=require('./plan-store.cjs');
const orderPattern=/^order_[A-Za-z0-9]{1,40}$/;
const choices=['Yes','Partly','No','Not sure'];
const followUps={
  1:'issuing or locating the signed IC constitution order',
  7:'displaying the current IC order',
  8:'confirming and displaying the district LC contact route',
  9:'approving or locating the POSH policy',
  11:'arranging the outstanding employee awareness sessions',
  12:'arranging the outstanding IC orientation',
  26:'submitting the annual report to the employer',
  27:'submitting the annual report to the District Officer',
  29:'completing the applicable employer disclosure or intimation',
  39:'verifying committee coverage for the workplace',
  44:'updating the website with the applicable complaint information',
  57:'completing the applicable MCA or listed-entity disclosures',
  60:'following up on Head Office registration and approval',
  61:'adding this branch under the approved Head Office login',
  62:'updating the IC after the portal prerequisite is verified',
  63:'updating applicable SHe-Box compliance records',
  64:'sending the current IC order through the applicable district channel'
};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const isoDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function problem(status,message){return Object.assign(Error(message),{status});}

const reviewYear=new Intl.DateTimeFormat('en-IN',{year:'numeric',timeZone:'Asia/Kolkata'});
function scopeFrom(input, now=Date.now()) {
  if (!object(input)) throw problem(400,'Complete the assessment scope.');
  const workplace=clean(input.workplace,100), district=clean(input.district,100);
  const {year,workers,siteWorkers,siteType,complaints,employer,listed,mca,sebi}=input;
  const maxYear=Number(reviewYear.format(now));
  if(!integer(year,2013,maxYear))throw problem(400,'Enter a review year from 2013 to '+maxYear+'.');
  if (!workplace||!district||!integer(workers,0,10000000)||
      !['standalone','head office','branch'].includes(siteType)||typeof complaints!=='boolean'||
      !['company','other'].includes(employer)) throw problem(400,'Enter workplace, district, review year, total headcount and the applicable setup choices.');
  if (siteType!=='standalone'&&!integer(siteWorkers,0,workers)) throw problem(400,'Enter the office headcount, up to the total establishment headcount.');
  if (employer==='company'&&(typeof listed!=='boolean'||typeof mca!=='boolean'||(listed&&typeof sebi!=='boolean'))) {
    throw problem(400,'Confirm the company filing rules before starting.');
  }
  return {workplace,district,year,workers,siteType,siteWorkers:siteType==='standalone'?null:siteWorkers,
    complaints,employer,listed:employer==='company'&&listed,mca:employer==='company'&&mca,
    sebi:employer==='company'&&listed&&sebi,route:workers>=10?'IC':'LC'};
}

function assessmentView(scope,answers,catalogue) {
  const applicable=[],excluded=[];
  for (const check of catalogue) {
    const reason=check.ic&&scope.route==='LC'?'IC-only check. This assessment follows the LC route.':
      check.case&&!scope.complaints?'No complaints were received, handled or carried forward in the review year.':
      check.id===57&&!scope.mca&&!scope.sebi?'Neither company filing check applies.':
      check.office==='branch'&&scope.siteType!=='branch'?'Applies to a branch review.':
      check.office==='head'&&scope.siteType==='branch'?'Applies to a Head Office or standalone review.':null;
    if (reason) {excluded.push({id:check.id,title:check.title,reason});continue;}
    const text=check[scope.route]||check;
    const answer=answers[check.id]||null;
    const blocked=check.id===62&&answer?.value!=='Not triggered'&&answers[scope.siteType==='branch'?61:60]?.value!=='Yes';
    const next=blocked?'SHe-Box IC update is blocked until Head Office approval or branch mapping is verified.':
      !answer?'Review the suggested evidence and choose an answer.':
      answer.value==='Yes'?'Evidence recorded.':
      answer.value==='Not triggered'?'Exclusion reason and reviewer recorded.':
      answer.value==='Not sure'?'Verify the facts and collect evidence. '+text.action:text.action;
    applicable.push({id:check.id,title:check.title,topic:check.topic,priority:check.priority,
      authority:check.authority,question:text.question,proof:text.proof,action:text.action,
      conditional:check.conditional,answer,next,blocked});
    const task=followUps[check.id];
    if(!task||!['No','Partly','Not sure'].includes(answer?.value))continue;
    const verification=answer.value==='Not sure';
    const id=1000+check.id*2+Number(verification);
    const branchKey=String(answer.sequence??0);
    const saved=answers[id]?.branchKey===branchKey?answers[id]:null;
    const action=(verification?'Assign someone to verify the facts and report back before ':'Assign a responsible role and target date for ')+task+'.';
    applicable.push({id,parentId:check.id,branchKey,title:verification?'Verification follow-up':'Corrective action follow-up',
      topic:check.topic,priority:check.priority,authority:'Management follow-up',
      question:verification?'Has a responsible person been assigned to verify the facts before '+task+'?':
        'Has management assigned a responsible person and target date for '+task+'?',
      proof:verification?'Verification request or task reference.':'Action assignment and target date reference.',
      action,conditional:false,answer:saved,next:saved?.value==='Yes'?'Follow-up assignment recorded.':action,blocked:false});
  }
  return {applicable,excluded,remaining:applicable.filter(q=>!q.answer).length,
    open:applicable.filter(q=>q.answer&&(q.blocked||!['Yes','Not triggered'].includes(q.answer.value))).length};
}

function answerFrom(input,check) {
  if (!object(input)||!check) throw problem(400,'Choose an applicable check.');
  const value=input.value, evidence=clean(input.evidence,300), reviewer=clean(input.reviewer,80);
  const owner=clean(input.owner,80), due=clean(input.due,10);
  if (!choices.includes(value)&&!(check.conditional&&value==='Not triggered')) throw problem(400,'Choose an available answer.');
  if (value==='Yes'&&check.blocked) throw problem(409,'Verify Head Office approval or branch mapping before marking the IC update Yes.');
  if (value==='Yes'&&!evidence) throw problem(400,'Add a record reference before marking Yes.');
  if (value==='Not triggered'&&(evidence.length<10||!reviewer)) throw problem(400,'Add the reason and the reviewer’s role before excluding this check.');
  if (due&&!isoDate(due)) throw problem(400,'Enter a valid target date.');
  return {value,evidence,reviewer:value==='Not triggered'?reviewer:'',owner,due,
    ...(check.branchKey===undefined?{}:{branchKey:check.branchKey})};
}

function pdf(snapshot) {
  const lines=[];
  function line(value='') {
    // WinAnsi standard fonts are available in PDF readers. Preserve unsupported characters as code points.
    const text=String(value).normalize('NFC').replace(/[‘’“”–—]/g,c=>({'‘':"'",'’':"'",'“':'"','”':'"','–':'-','—':'-'})[c])
      .replace(/[^\x20-\x7e\xa0-\xff]/gu,c=>'[U+'+c.codePointAt(0).toString(16).toUpperCase()+']');
    if (!text) {lines.push('');return;}
    for (let pos=0;pos<text.length;) {
      let end=Math.min(pos+94,text.length);
      if (end<text.length&&text[end]!==' ') {const space=text.lastIndexOf(' ',end);if(space>pos)end=space;}
      lines.push(text.slice(pos,end).trim());
      pos=end+(text[end]===' '?1:0);
    }
  }
  const {scope,review,organisation,order,finalisedAt}=snapshot;
  line('POSH COMPLIANCE ASSESSMENT | MANAGEMENT AND EMPLOYER REVIEW');
  line('STAGING TEST REPORT | SELF-ASSESSMENT');
  line('Organisation: '+organisation+' | Workplace: '+scope.workplace+' | '+scope.siteType);
  line('District: '+scope.district+' | Review year: '+scope.year+' | Route: '+scope.route);
  line('Establishment workers: '+scope.workers+(scope.siteWorkers===null?'':' | Office workers: '+scope.siteWorkers));
  line('Finalised: '+new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(finalisedAt))+' IST | '+order);
  line('Applicable: '+review.applicable.length+' | Open findings and follow-ups: '+review.open+' | Excluded by setup: '+review.excluded.length);
  line(); line('FINDINGS AND ACTIONS');
  const rank={Critical:0,High:1,Medium:2,Low:3};
  const open=q=>q.blocked||!['Yes','Not triggered'].includes(q.answer.value);
  const ordered=[...review.applicable].sort((a,b)=>Number(open(b))-Number(open(a))||(rank[a.priority]??4)-(rank[b.priority]??4));
  for (const q of ordered) {
    const parent=q.parentId&&review.applicable.find(item=>item.id===q.parentId);
    line((parent?parent.title+' | ':'')+q.title+' | '+q.priority+' | '+q.answer.value);
    if(q.parentId)line(q.question);
    if (q.authority) line('Basis: '+q.authority);
    if (q.answer.evidence) line('Reference / reason: '+q.answer.evidence);
    if (q.answer.reviewer) line('Reviewer: '+q.answer.reviewer);
    if (open(q)) {
      line('Action: '+q.next);
      line('Owner: '+(q.answer.owner||'Unassigned')+' | Target: '+(q.answer.due||'Unset'));
    }
    line();
  }
  line('CHECKS EXCLUDED BY SETUP');
  for (const q of review.excluded) line(q.title+' | '+q.reason);
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  const pages=[];
  const escape=t=>t.replace(/[\\()]/g,'\\$&');
  for (let at=0;at<lines.length;at+=52) {
    const page=objects.length+1;
    pages.push(page+' 0 R');
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+(page+1)+' 0 R >>');
    const stream='BT /F1 10 Tf 42 800 Td 14 TL '+lines.slice(at,at+52).map(t=>'('+escape(t)+') Tj T*').join('\n')+' ET';
    objects.push('<< /Length '+Buffer.byteLength(stream,'latin1')+' >>\nstream\n'+stream+'\nendstream');
  }
  objects[1]='<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.join(' ')+'] >>';
  let result='%PDF-1.4\n', offsets=[0];
  for (const [i,value] of objects.entries()) {offsets.push(Buffer.byteLength(result,'latin1'));result+=(i+1)+' 0 obj\n'+value+'\nendobj\n';}
  const xref=Buffer.byteLength(result,'latin1');
  result+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+
    'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return Buffer.from(result,'latin1');
}

function createAssessmentHandler({identify,store,origin,now=Date.now}) {
  return async (req,res,url)=>{
    if (url.pathname!=='/api/compliance-assessment'&&url.pathname!=='/api/compliance-assessment/report') return false;
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie'});res.end(JSON.stringify(data));return true;};
    const report=url.pathname.endsWith('/report'), order=url.searchParams.get('order');
    try {
      if (!['GET','POST'].includes(req.method)||(report&&req.method!=='GET')) return send(405,{error:'Method not allowed.'});
      if (req.method==='POST'&&(req.headers.origin!==origin||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))) return send(403,{error:'Use the Navigator assessment page.'});
      const buyer=await identify(req,res);
      if (!buyer) return send(401,{error:'Sign in to continue.'});
      if (!store) return send(503,{error:'Assessment staging is unavailable.'});
      if (!orderPattern.test(order||'')) return send(400,{error:'Open the assessment from a captured checklist order.'});
      const read=()=>store(buyer,order,'read');
      const current=await read();
      if (!current) return send(403,{error:'A captured compliance checklist order for this account is required.'});
      if (report) {
        if (!current.final) return send(409,{error:'Finalise the assessment before downloading the report.'});
        res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="POSH-Compliance-'+order+'.pdf"','Cache-Control':'private, no-store','Vary':'Cookie'});
        res.end(pdf(current.final));return true;
      }
      const response=value=>{
        const {catalogue,answers,...rest}=value;
        return send(200,{...rest,review:value.final?.review||(value.scope?assessmentView(value.scope,answers,catalogue):null),final:!!value.final});
      };
      if(req.method==='GET')return response(current);
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>4096)return send(413,{error:'Request is too large.'});chunks.push(chunk);}
      let data;
      try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Invalid assessment request.'});}
      if(!object(data))return send(400,{error:'Invalid assessment request.'});
      if(data.action==='start'){
        if(current.scope)return response(current);
        return response(await store(buyer,order,'start',scopeFrom(data.scope,now())));
      }
      if(current.final&&data.action==='finish')return response(current);
      if(!current.scope||current.final||data.revision!==current.revision)return send(409,{error:'The assessment changed. Reload it before continuing.'});
      const review=assessmentView(current.scope,current.answers,current.catalogue);
      let saved;
      if(data.action==='save'){
        const check=review.applicable.find(q=>q.id===data.id);
        saved=await store(buyer,order,'save',{id:data.id,answer:{...answerFrom(data.answer,check),sequence:data.revision+1}},data.revision);
      }else if(data.action==='finish'){
        if(review.remaining)return send(409,{error:'Answer all applicable checks before finalising.'});
        saved=await store(buyer,order,'finish',{scope:current.scope,review,organisation:current.organisation,order,finalisedAt:new Date(now()).toISOString()},data.revision);
      }else return send(400,{error:'Unknown assessment action.'});
      return saved?.conflict?send(409,{error:'The assessment changed. Reload it before continuing.'}):response(saved);
    }catch(error){return send(error.status||503,{error:error.status?error.message:'The assessment could not be opened or saved. Retry from your order.'});}
  };
}

function fromEnvironment(identify) {
  const {NAVIGATOR_AUTH_URL:url,NAVIGATOR_AUTH_PUBLISHABLE_KEY:key,NAVIGATOR_CHECKLIST_STORE_TOKEN:token,
    NAVIGATOR_CHECKLIST_TEST_MODE:mode,RENDER_EXTERNAL_URL:origin}=process.env;
  const configured=origin===stagingOrigin&&['simulated','razorpay-test'].includes(mode)&&/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')&&key&&/^[a-f0-9]{64}$/.test(token||'');
  const store=configured?async (buyer,order,action,payload=null,revision=null)=>{
    const res=await fetch(url+'/rest/v1/rpc/navigator_compliance_assessment',{
      method:'POST',headers:{apikey:key,Authorization:'Bearer '+buyer.accessToken,'Content-Type':'application/json'},
      body:JSON.stringify({p_token:token,p_gateway:mode,p_order:order,p_action:action,p_payload:payload,p_revision:revision}),
      signal:AbortSignal.timeout(8000)
    });
    if(!res.ok)throw Error('Assessment store unavailable.');
    return res.json();
  }:null;
  return createAssessmentHandler({identify,store,origin});
}
module.exports={fromEnvironment,createAssessmentHandler,scopeFrom,assessmentView,pdf};
