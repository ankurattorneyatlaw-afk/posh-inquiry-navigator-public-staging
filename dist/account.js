(function(){'use strict';const $=id=>document.getElementById(id),status=$('account-status');const page=document.body.dataset.accountPage||'login';const requestedProduct=new URLSearchParams(location.search).get('product'),productReturn=['checklist','aggrieved','respondent'].includes(requestedProduct)?'/shop.html?product='+requestedProduct:null;const requestedPlan=new URLSearchParams(location.search).get('plan'),planReturn=['essential','professional','advanced'].includes(requestedPlan)?'/checkout.html?plan='+requestedPlan:null;if(page==='login'&&productReturn){const individual=requestedProduct!=='checklist',respondent=requestedProduct==='respondent',name=individual?(respondent?'Respondent Advanced Guide':'Aggrieved Woman Advanced Guide'):'IC / LC Inquiry Checklist',box=document.querySelector('.login-value');document.querySelector('.account-intro').textContent='Continue to '+name+'.';document.querySelector('.login-purpose').textContent='Sign in to review your digital product and open its separate test delivery. No real payment is collected.';document.querySelector('.login-audience').textContent=individual?'For your own preparation. This product does not grant Committee access.':'For your organisation’s internal checklist use. This download does not grant Committee workspace access.';if(box){box.setAttribute('aria-label','What this digital product includes');box.innerHTML='<p class="eyebrow">'+(individual?'ADVANCED SELF-SERVICE PREPARATION':'PRACTICAL COMMITTEE REFERENCE')+'</p><h2>'+name+'</h2><p>'+(individual?'Follow eight role-specific stages, prepare nine editable drafts and keep your next actions clear.':'Review 43 procedural checks in a two-page personalised Word file. Tick and save in desktop Word.')+'</p><ul class="login-benefits"><li><strong>Know the scope before you choose</strong>Review the deliverables, licence and catalogue price. This release offers ₹0 test checkout only.</li><li><strong>Keep your preparation private</strong>'+(individual?'Choices stay in the open tab. Save and restore a local recovery file; complete names and case details offline.':'Download this edition for internal use. Keep your completed checklist and institutional records securely.')+'</li><li><strong>Return straight to your product</strong>After sign-in, continue to the product you selected. Committee and administrator permissions remain separate.</li></ul><p class="login-trust">Self-service material only. No calls, personal case review, filing, representation or outcome guarantee.</p><p><a href="/shop.html?product='+requestedProduct+'">Review product scope and price</a> · <a href="/#guidance">Free guidance</a></p>';}};const planNames={essential:'Inquiry Essential',professional:'Inquiry Professional',advanced:'Inquiry Advanced',institutional:'Institutional Plus',enterprise:'Government / Enterprise',knowledge:'Expert Knowledge'};
const accessDate=new Intl.DateTimeFormat('en-IN',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Kolkata'});
const otpForm=$('account-otp-verify');
const otpInput=otpForm.elements.code;
const otpError=$('account-otp-error');
function clearOtpError(){
  if(!otpError)return;
  otpError.hidden=true;
  otpError.textContent='';
  otpInput.removeAttribute('aria-invalid');
}
function showOtpError(message,invalid){
  otpError.hidden=false;
  otpError.textContent=message;
  if(invalid)otpInput.setAttribute('aria-invalid','true');
  otpInput.focus();
}
let factorId='',busy=false,otpEmail='',resendAt=0,ready=false;function resendState(){const seconds=Math.max(0,Math.ceil((resendAt-Date.now())/1000));$('account-otp-resend').disabled=busy||!ready||seconds>0;$('account-otp-resend').textContent=seconds?'Resend code in '+seconds+'s':'Resend code'}setInterval(resendState,1000);
async function api(action,data){const r=await fetch('/api/account/'+action,{credentials:'same-origin',...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(20000)});let result;try{result=await r.json()}catch{throw Error('Account access is temporarily unavailable. Please try again later.')}if(!r.ok)throw Object.assign(Error(result.error||'This action could not be completed.'),{status:r.status});return result}
async function load(){const entering=$('account-profile').hidden;let r;try{r=await api('session');}catch(e){for(const id of ['account-profile','account-admin','account-security'])$(id).hidden=true;$('account-login').hidden=true;$('account-guest').hidden=false;throw Error('Access could not be verified. Keep any inquiry tab open, then use Check access again. '+e.message);}r.access=Array.isArray(r.access)?r.access:[];if(r.signedIn&&page==='login'&&!r.mfaRequired){location.replace(productReturn||planReturn||(r.operator?'/admin':'/workspace'));return;}if(!r.signedIn&&page!=='login'){location.replace('/account');return;}if(r.signedIn&&page==='admin'&&!r.operator){location.replace('/workspace');return;}const adminLink=$('account-admin-link');if(adminLink)adminLink.hidden=!r.operator;const guided=r.operator||r.access.some(x=>x.guided);$('account-refresh').hidden=!r.signedIn;$('account-login').hidden=r.signedIn;$('account-profile').hidden=!r.signedIn;$('account-security').hidden=!r.signedIn;$('account-admin').hidden=!r.operator||page!=='admin';if(page==='admin'&&r.operator)$('account-admin').open=true;if(!r.signedIn){$('account-guest').hidden=false;status.textContent='';return}status.textContent='Signed in. Only account and plan information is stored.';$('account-identity').textContent=r.email;$('account-id').textContent=r.accountId;$('account-plans').textContent=r.operator?'Administrator · full Navigator access':r.access.length?'Active plans: '+r.access.map(x=>(planNames[x.plan]||x.plan)).join(', '):'No active verified plan is confirmed. Review access and renewal options below.';$('account-open').hidden=!guided;const planTools=document.getElementById('account-plan-tools');if(planTools)planTools.hidden=!r.operator&&!r.access.some(a=>['essential','professional','advanced'].includes(a.plan));if(r.operator&&!r.access.length){$('account-renewals').textContent='Administrator access is independent of customer subscriptions.';}else renderRenewals(r.access);$('account-getting-started').hidden=!guided;$('account-product-scope').textContent='Included now: guided questions, contextual editable drafts and browser-only timelines. Your plan does not create shared case storage or authorise the software to make Committee decisions.';$('account-pending-help').hidden=r.operator||r.access.length>0;$('account-guest').hidden=r.operator||r.access.length>0;$('account-access-title').textContent=guided?'Your inquiry workspace is ready':'Your account and access';factorId=(r.factors||[])[0]?.id||'';$('account-security').hidden=!r.mfaRequired;if(r.mfaRequired)$('account-security').open=true;$('account-enrol').hidden=!!factorId;$('account-mfa').hidden=false;$('account-otp-pending').hidden=true;$('account-otp-verify').reset();if(page!=='login'&&(r.operator||page==='workspace'))loadSandbox(r.operator,!guided&&!r.access.length,entering);else if($('account-sandbox'))$('account-sandbox').hidden=true;if(entering){$('account-access-title').tabIndex=-1;$('account-access-title').focus();}}
function renderRenewals(access){const list=$('account-renewals');list.replaceChildren();const names=planNames;if(!access.length){const p=document.createElement('p');p.textContent='No active access is confirmed. Contact support to check purchase verification, future start dates or renewal. This screen cannot distinguish those reasons.';list.append(p);const a=document.createElement('a');a.className='btn btn-light';a.href='mailto:training@thecosmicenergizers.com?subject=Navigator%20access%20or%20renewal%20enquiry';a.textContent='Ask about access or renewal';list.append(a);return;}for(const item of access){const end=new Date(item.ends_at);if(!Number.isFinite(end.getTime()))continue;const milliseconds=end-Date.now(),remaining=Math.ceil(milliseconds/86400000),alarm=milliseconds>7*86400000?'-P7D':milliseconds>86400000?'-P1D':milliseconds>3600000?'-PT1H':milliseconds>300000?'-PT5M':'PT0S',row=document.createElement('article'),title=document.createElement('h4'),p=document.createElement('p'),a=document.createElement('a'),button=document.createElement('button');row.className='account-renewal'+(remaining<=30?' renewal-due':'');title.textContent=names[item.plan]||item.plan;p.textContent='Access ends '+end.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'long',timeStyle:'short'})+' IST (exclusive). '+(remaining<=7?'Ends within seven days — arrange renewal now.':remaining<=30?'Ends within thirty days — plan your renewal.':'Active access.');a.href='mailto:training@thecosmicenergizers.com?subject='+encodeURIComponent('Navigator '+(names[item.plan]||item.plan)+' renewal enquiry');a.className='btn btn-light';a.textContent='Request renewal details';button.type='button';button.className='btn btn-light';button.textContent='Download expiry reminder';button.onclick=()=>{const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//POSH Navigator//Account renewal//EN','BEGIN:VEVENT','UID:navigator-'+item.plan+'-'+stamp(end)+'@navigator','DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(end),'SUMMARY:Navigator plan access ends','DESCRIPTION:Review plan renewal and save your local recovery file. No automatic renewal.','BEGIN:VALARM','TRIGGER:'+alarm,'ACTION:DISPLAY','DESCRIPTION:Review Navigator renewal','END:VALARM','END:VEVENT','END:VCALENDAR',''];const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/calendar'})),link=document.createElement('a');link.href=url;link.download='Navigator-plan-expiry.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};const reminder=document.createElement('p');reminder.className='g-mini';reminder.textContent='Calendar alert: '+({'-P7D':'seven days','-P1D':'one day','-PT1H':'one hour','-PT5M':'five minutes','PT0S':'at expiry'}[alarm])+(alarm==='PT0S'?'':' before access ends')+'. Import the file into your calendar; Navigator sends no automatic reminder.';row.append(title,p,a,button,reminder);if(!item.guided){const link=document.createElement('a');link.href='/#faq';link.className='btn btn-dark';link.textContent='Open knowledge resources';row.append(link);}list.append(row);}}
async function run(action){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await action()}catch(e){status.textContent=e.message;$('account-refresh').hidden=false;status.focus()}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=!ready&&b.id!=='account-refresh');resendState()}}
async function requestCode(){const email=$('account-otp-request').elements.email.value.trim();const r=await api('otp/request',{email});otpEmail=email;resendAt=Date.now()+r.retryAfter*1000;$('account-otp-request').hidden=true;$('account-otp-pending').hidden=false;$('account-otp-destination').textContent='Code requested for '+email;otpForm.reset();clearOtpError();status.textContent=r.message;otpInput.focus()}
$('account-otp-request').onsubmit=e=>{e.preventDefault();run(requestCode)};
$('account-otp-resend').onclick=()=>run(requestCode);
$('account-otp-change').onclick=()=>{$('account-otp-request').hidden=false;$('account-otp-pending').hidden=true;otpForm.reset();clearOtpError();otpEmail='';$('account-otp-request').elements.email.focus()};
otpInput.addEventListener('input',clearOtpError);
otpForm.onsubmit=e=>{
  e.preventDefault();
  run(async()=>{
    clearOtpError();
    const code=otpInput.value;
    if(otpError&&!/^\d{6}$/.test(code)){
      showOtpError('Enter the six-digit code from your email.',true);
      return;
    }
    try{
      await api('otp/verify',{code});
    }catch(error){
      if(!otpError)throw error;
      showOtpError(error.message,error.status===400||error.status===401);
      return;
    }
    otpForm.reset();
    $('account-otp-request').hidden=false;
    otpEmail='';
    await load();
  });
};
$('account-form').onsubmit=e=>{e.preventDefault();run(async()=>{const form=e.target;await api('login',{email:form.elements.email.value,password:form.elements.password.value});form.elements.password.value='';await load()})};
async function configure(){const c=await api('config');ready=!!(c.enabled&&c.configured);if(!ready){for(const id of ['account-login','account-profile','account-security','account-admin'])$(id).hidden=true;$('account-guest').hidden=false;throw Error('Account access is being configured. Public guidance remains available. Use Check access again to retry.');}await load();}
$('account-refresh').onclick=()=>run(configure);$('account-logout').onclick=()=>run(async()=>{try{await api('logout',{})}finally{$('account-secret').textContent='';$('account-secret-wrap').hidden=true;factorId='';$('account-otp-request').hidden=false;await load()}});
$('account-enrol').onclick=()=>run(async()=>{const r=await api('mfa/enrol',{});factorId=r.factorId;$('account-secret').textContent=r.secret;$('account-secret-wrap').hidden=false;status.textContent='Add the setup key in your authenticator app, then enter its code.'});
$('account-mfa').onsubmit=e=>{e.preventDefault();run(async()=>{if(!factorId)throw Error('Set up an authenticator first.');await api('mfa/verify',{factorId,code:e.target.elements.code.value});e.target.reset();$('account-secret').textContent='';$('account-secret-wrap').hidden=true;await load();status.textContent='Authenticator verified. Your active plan, if assigned, is shown above.'})};
async function adminList(){const id=$('admin-grant').elements.accountId.value;if(!id)return;const r=await api('admin/access',{accountId:id}),list=$('admin-access-list');list.replaceChildren();for(const item of r.result){const row=document.createElement('p'),text=document.createElement('span');text.textContent=item.plan+' · '+item.status+' · ends '+item.ends_at+' ';row.append(text);if(item.status==='active'){const button=document.createElement('button');button.type='button';button.className='btn btn-light';button.textContent='Revoke this access';button.onclick=()=>{if(!confirm('Revoke this customer’s '+item.plan+' access?'))return;run(async()=>{await api('admin/revoke',{accessId:item.access_id});await adminList();$('admin-result').textContent='Access revoked. Already downloaded documents remain on the customer’s device.'})};row.append(button)}list.append(row)}}
const lookupForm=$('admin-lookup'),grantForm=$('admin-grant');
const lookupResult=$('admin-lookup-result')||$('admin-result'),accountHelp=$('admin-account-help');
let planDates={};
function showPlanDates(){
  const f=grantForm.elements,dates=Object.hasOwn(planDates,f.plan.value)?planDates[f.plan.value]:null;
  f.startsAt.readOnly=f.endsAt.readOnly=!!dates;
  f.startsAt.value=dates?.startsOn||planDates.essential?.startsOn||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kolkata'}).format(new Date());
  f.endsAt.value=dates?.endsOn||'';
  const term=$('admin-plan-term');
  if(term)term.textContent=dates?dates.months+' calendar months. The dates are set automatically.':'Enter the start and end dates agreed for this role.';
}
grantForm.elements.plan.addEventListener('change',showPlanDates);
function clearAdminSelection(){
  const f=grantForm.elements;
  planDates={};
  f.accountId.value='';
  f.verificationReference.value='';
  f.verified.checked=false;
  if(page==='admin')grantForm.hidden=true;
  if(accountHelp)accountHelp.hidden=true;
  $('admin-access-list').replaceChildren();
  $('admin-result').textContent='';
  lookupResult.textContent='';
}
lookupForm.elements.email.addEventListener('input',clearAdminSelection);
lookupForm.onsubmit=e=>{
  e.preventDefault();
  run(async()=>{
    clearAdminSelection();
    const email=lookupForm.elements.email.value.trim();
    lookupResult.textContent='Checking the Navigator account…';
    try{
      const r=await api('admin/lookup',{email});
      if(email!==lookupForm.elements.email.value.trim())return;
      if(!r.result.length){
        lookupResult.textContent='No confirmed Navigator account was found for this email.';
        if(accountHelp)accountHelp.hidden=false;
        return;
      }
      const f=grantForm.elements;
      f.accountId.value=r.result[0].account_id;
      f.verificationReference.value=crypto.randomUUID();
      planDates=r.planDates||{};
      showPlanDates();
      grantForm.hidden=false;
      lookupResult.textContent='Confirmed account found. Select the agreed plan below.';
      await adminList();
    }catch(error){
      if(email===lookupForm.elements.email.value.trim())lookupResult.textContent=error.message;
    }
  });
};
grantForm.onsubmit=e=>{
  e.preventDefault();
  run(async()=>{
    const f=grantForm.elements,result=$('admin-result');
    if(!f.accountId.value||!f.verified.checked)return;
    if(f.endsAt.value<=f.startsAt.value){
      result.textContent='Choose an access end date after the start date. Access ends at midnight IST at the start of the end date.';
      f.endsAt.focus();
      return;
    }
    result.textContent='Assigning plan access…';
    lookupForm.elements.email.disabled=true;
    try{
      await api('admin/grant',{accountId:f.accountId.value,plan:f.plan.value,startsAt:f.startsAt.value+'T00:00:00+05:30',...(!f.endsAt.readOnly?{endsAt:f.endsAt.value+'T00:00:00+05:30'}:{}),verificationReference:f.verificationReference.value});
    }catch(error){
      result.textContent=error.message;
      return;
    }finally{
      lookupForm.elements.email.disabled=false;
    }
    f.verified.checked=false;
    f.verificationReference.value=crypto.randomUUID();
    result.textContent='Access assigned. The customer can sign in with an email code and open My workspace.';
    try{await adminList();}catch{result.textContent+=' Use Find confirmed account to refresh the access list.';}
  });
};
async function loadSandbox(operator,stagingOnly,entering){
  const section=$('account-sandbox');
  if(!section)return;
  const list=$('account-sandbox-list');
  try{
    const response=await fetch('/api/payments/sandbox-access',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Staging access is temporarily unavailable.');
    const {access}=await response.json();
    section.hidden=!operator&&!access.length;
    list.replaceChildren();
    if(!access.length){
      list.textContent='No verified staging order is available for this account.';
      return;
    }
    if(stagingOnly&&page==='workspace'&&access.some(item=>['active','read-only'].includes(item.state||'active'))){
      $('account-access-title').textContent='Your staging workspace';
      $('account-plans').textContent='Open your plan below to start an inquiry, continue from a saved file, or use the tools included in your plan.';
      $('account-pending-help').hidden=true;
      $('account-guest').hidden=true;
    }
    if(entering)section.open=true;
    for(const item of access){
      const state=item.state||'active';
      const card=document.createElement('article');
      card.className='workspace-plan-card';
      const title=document.createElement('h3');
      title.textContent=planNames[item.plan]||item.plan;
      const badge=document.createElement('span');
      badge.className='workspace-plan-status';
      badge.textContent=({active:'Editing access', 'read-only':'Read-only access', pending:'Access pending', expired:'Access ended'})[state]||'Status unavailable';
      card.append(title,badge);
      const dates=document.createElement('p');
      const date=value=>value&&Number.isFinite(Date.parse(value))?accessDate.format(new Date(value))+' IST':'';
      const editEnd=date(item.ends_at),readEnd=date(item.readOnlyUntil);
      dates.textContent=state==='active'&&editEnd?'Editing ends '+editEnd+'. ':'';
      if(readEnd&&['active','read-only'].includes(state))dates.textContent+='Read-only access ends '+readEnd+'.';
      if(state==='read-only')dates.textContent+=' Open a local recovery file to review your inquiry.';
      if(item.seatLimit)dates.textContent+=' '+item.seatLimit+' seats in total'+(item.owner?' · You manage seats':'')+'.';
      if(dates.textContent.trim())card.append(dates);
      if(item.tools&&['active','read-only'].includes(state)){
        const a=document.createElement('a');
        a.className='btn btn-dark';
        a.href=item.tools;
        a.textContent=state==='read-only'?'Review saved inquiry':'Open '+(planNames[item.plan]||item.plan).replace('Inquiry ','')+' plan';
        card.append(a);
      }
      list.append(card);
    }
  }catch{
    list.textContent='Staging access could not be checked. Select Check test purchase to try again.';
    section.hidden=!operator&&section.hidden;
  }
}
const sandboxRefresh=$('account-sandbox-refresh');if(sandboxRefresh)sandboxRefresh.onclick=()=>run(load); status.tabIndex=-1;run(configure);})();
