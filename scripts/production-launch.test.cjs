'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');
const {launchFromEnvironment,launchApi,launchHtml}=require('./production-launch.cjs');

const origin='https://navigator.example.test';
const env={
  NAVIGATOR_DEPLOYMENT_MODE:'production',
  NAVIGATOR_PUBLIC_ORIGIN:origin,
  NAVIGATOR_ACCOUNT_ACCESS_ENABLED:'true',
  NAVIGATOR_AUTH_URL:'https://synthetic.supabase.co',
  NAVIGATOR_AUTH_PUBLISHABLE_KEY:'sb_publishable_synthetic',
  NAVIGATOR_SESSION_KEY:'1'.repeat(64),
};

test('launch is opt-in and refuses the staging service, staging data and invalid credentials',()=>{
  assert.equal(launchFromEnvironment({}),null);
  assert.deepEqual(launchFromEnvironment(env),{origin,indexable:false});
  for(const overrides of [
    {NAVIGATOR_PUBLIC_ORIGIN:'http://navigator.example.test'},
    {NAVIGATOR_PUBLIC_ORIGIN:origin+'/wrong'},
    {NAVIGATOR_PUBLIC_ORIGIN:'https://posh-inquiry-navigator-staging.onrender.com'},
    {RENDER_EXTERNAL_URL:'https://posh-inquiry-navigator-staging.onrender.com'},
    {NAVIGATOR_AUTH_URL:'https://rcupqoxtclrzbiveozah.supabase.co'},
    {ENQUIRY_SUPABASE_URL:'https://rcupqoxtclrzbiveozah.supabase.co'},
    {NAVIGATOR_ACCOUNT_ACCESS_ENABLED:'false'},
    {NAVIGATOR_AUTH_PUBLISHABLE_KEY:'sb_secret_synthetic'},
    {NAVIGATOR_SESSION_KEY:'invalid'},
  ])assert.throws(()=>launchFromEnvironment({...env,...overrides}));
});

test('production checkout and reminder routes reject writes and expose only disabled status',()=>{
  function request(route,method){
    let status,body;
    const handled=launchApi({method},{writeHead(code){status=code;},end(data){body=JSON.parse(data);}},route);
    return {handled,status,body};
  }
  for(const route of ['/api/payments/order','/api/shop/order','/api/shop/confirm','/api/checklist/order',
    '/api/compliance-checklist/order','/api/compliance-assessment','/api/checkout-recovery/dispatch']){
    const {handled,status,body}=request(route,'POST');
    assert.equal(handled,true);
    assert.equal(status,403);
    assert.equal(body.livePaymentsEnabled,false);
  }
  assert.deepEqual(request('/api/checkout-recovery/config','GET').body,{livePaymentsEnabled:false,enabled:false,preview:true});
  assert.equal(request('/api/account/session','GET').handled,false);
});

test('production uses its own canonical URL and preserves distinct product and sample links',()=>{
  const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');
  const preview=launchHtml(html,launchFromEnvironment(env),'/','index.html',new URLSearchParams());
  assert(preview.includes('content="noindex,nofollow,noarchive"'));
  assert(!preview.includes('https://posh-inquiry-navigator-staging.onrender.com'));
  assert(preview.includes(`href="${origin}/"`));
  const indexed=launchHtml(html,launchFromEnvironment({...env,NAVIGATOR_PUBLIC_INDEXING:'true'}),'/','index.html',new URLSearchParams());
  assert(!indexed.includes('name="robots"'));
  const shop=product=>launchHtml('',launchFromEnvironment(env),'/shop.html','shop.html',new URLSearchParams({product}));
  assert(shop('checklist').includes('<h1>IC / LC Inquiry Checklist</h1>'));
  assert(shop('compliance-checklist').includes('<h1>Compliance Checklist</h1>'));
  assert(shop('checklist').includes('href="/checklist-sample.pdf"'));
  assert(!shop('<script>').includes('<script>'));
});
