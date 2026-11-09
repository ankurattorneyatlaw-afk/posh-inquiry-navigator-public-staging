'use strict';

const {stagingOrigin}=require('./plan-store.cjs');
const {products}=require('../dist/products.js');
const stagingAuth='https://rcupqoxtclrzbiveozah.supabase.co';
const publicPages=new Map([['/','/'],['/index.html','/'],['/institutions','/institutions'],['/institutions/','/institutions']]);

function launchFromEnvironment(env=process.env){
  if(env.NAVIGATOR_DEPLOYMENT_MODE!=='production')return null;
  let publicUrl;
  try{publicUrl=new URL(env.NAVIGATOR_PUBLIC_ORIGIN);}catch{}
  if(!publicUrl||publicUrl.protocol!=='https:'||publicUrl.origin!==env.NAVIGATOR_PUBLIC_ORIGIN||
    publicUrl.origin===stagingOrigin||env.RENDER_EXTERNAL_URL===stagingOrigin){
    throw Error('Production requires a separate HTTPS NAVIGATOR_PUBLIC_ORIGIN.');
  }
  if(env.NAVIGATOR_ACCOUNT_ACCESS_ENABLED!=='true'||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.NAVIGATOR_AUTH_URL||'')||
    [env.NAVIGATOR_AUTH_URL,env.ENQUIRY_SUPABASE_URL,env.COMMUNITY_SUPABASE_URL].includes(stagingAuth)||
    !/^sb_publishable_[\w-]+$/.test(env.NAVIGATOR_AUTH_PUBLISHABLE_KEY||'')||
    !/^[a-f0-9]{64}$/i.test(env.NAVIGATOR_SESSION_KEY||'')){
    throw Error('Production requires separate, enabled account configuration and a new session key.');
  }
  return {origin:publicUrl.origin,indexable:env.NAVIGATOR_PUBLIC_INDEXING==='true'};
}

function launchApi(req,res,route){
  if(!/^\/api\/(payments|shop|checklist|compliance-checklist|compliance-assessment|checkout-recovery)(\/|$)/.test(route))return false;
  const config={
    '/api/payments/config':{mode:'disabled',configured:false},
    '/api/shop/catalogue':{mode:'disabled',products},
    '/api/checklist/session':{mode:'disabled',available:false},
    '/api/compliance-checklist/session':{mode:'disabled',available:false},
    '/api/checkout-recovery/config':{enabled:false,preview:true},
  };
  const status=req.method==='GET'&&Object.hasOwn(config,route)?200:403;
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify({livePaymentsEnabled:false,...(status===200?config[route]:{error:'Online checkout and checkout reminders are unavailable.'})}));
  return true;
}

function launchHtml(html,{origin,indexable},route,name,query){
  const canonical=publicPages.get(route);
  if(canonical&&indexable)html=html.replace(/<meta name="robots" content="noindex,nofollow,noarchive"\s*\/>/,'');
  html=html.replaceAll(stagingOrigin,origin);
  if(name==='index.html')html=html
    .replace('Navigator staging · Free guidance and FAQs · Inquiry access for approved accounts','Free guidance and FAQs · Inquiry access for approved accounts')
    .replace('Test checkout is open at ₹0; real payments remain disabled.','Online checkout is currently closed.')
    .replace('Both checklists are available for test checkout. Real payments are disabled.','Online checkout is currently closed. You can view the free Inquiry Checklist sample.');
  if(name==='workspace.html')html=html.replace(/<details id="account-sandbox"[^>]*>[\s\S]*?<\/details>/,'');
  if(name==='checkout.html'||name==='shop.html'){
    const product=products.find(item=>item.id===query.get('product'));
    const title=product?.name||'Online checkout';
    const scope=product?`<p>${product.scope}</p>`:'';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | POSH Inquiry Navigator</title><link rel="stylesheet" href="/digital.css"></head><body><main class="digital-main"><h1>${title}</h1>${scope}<p>Online purchases are currently closed. For institutional access or product enquiries, contact the team.</p><p><a href="/contact.html">Contact the team</a></p><p><a href="/checklist-sample.pdf">View the free Inquiry Checklist sample</a></p><p><a href="/">Return to the homepage</a></p></main></body></html>`;
  }
  return html;
}

module.exports={launchFromEnvironment,launchApi,launchHtml,publicPages};
