'use strict';
// UI checks use synthetic responses. No email or account is created here.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const base=process.env.BASE_URL||'http://127.0.0.1:4203';if(!process.env.BASE_URL){process.env.PORT='4203';require('./serve.cjs')}
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[];
 try{for(const width of [1440,390]){
  const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];let signedIn=false,failed=true,requests=0;
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/api/account/**',route=>{const action=new URL(route.request().url()).pathname.split('/api/account/')[1];let json,status=200;
   if(action==='config')json={enabled:true,configured:true,emailOtp:true};
   else if(action==='session')json={signedIn,operator:signedIn,email:'synthetic@example.invalid',accountId:'10000000-0000-4000-8000-000000000001',access:[{plan:'enterprise',guided:true,ends_at:'2027-01-01'}],factors:[]};
   else if(action==='otp/request'){requests++;assert.deepEqual(JSON.parse(route.request().postData()),{email:'synthetic@example.invalid'});json={pending:true,retryAfter:60,message:'Check your email for a sign-in code.'}}
   else if(action==='otp/verify'){assert.deepEqual(JSON.parse(route.request().postData()),{code:'123456'});if(failed){status=401;json={error:'The email code is invalid, expired or already used.'}}else{signedIn=true;json={signedIn:true}}}
   else json={};return route.fulfill({status,json})});
  await p.goto(base+'/account');await p.locator('#account-otp-request button:not([disabled])').waitFor();
  assert(await p.locator('#account-form [name=password]').isHidden());
  await p.locator('#account-otp-request [name=email]').fill('synthetic@example.invalid');await p.getByRole('button',{name:'Send email code',exact:true}).click();
  await p.locator('#account-otp-pending:not([hidden])').waitFor();assert(await p.locator('#account-otp-resend').isDisabled());assert.equal(requests,1);
  await p.getByRole('button',{name:'Use another email',exact:true}).click();assert(await p.locator('#account-otp-request').isVisible());
  await p.getByRole('button',{name:'Send email code',exact:true}).click();await p.locator('#account-otp-verify [name=code]').fill('123456');await p.getByRole('button',{name:'Verify email code',exact:true}).click();
  await p.locator('#account-status').filter({hasText:'invalid, expired'}).waitFor();assert(await p.locator('#account-otp-verify').isVisible());
  failed=false;await p.getByRole('button',{name:'Verify email code',exact:true}).click();await p.locator('#account-admin:not([hidden])').waitFor();assert(await p.locator('#account-open').isVisible());assert.equal(await p.locator('#account-otp-verify [name=code]').inputValue(),'');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  results.push({width,emailCodePrimary:true,passwordHidden:true,resendCooldown:true,changeEmail:true,errorRecovery:true,ownerControlsAfterVerification:true,noOverflow:true,errors});await p.close();
 }}finally{await browser.close()}
 fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/email-otp-ui-results.json',JSON.stringify({base,results},null,2));console.log(JSON.stringify(results));process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1)});
