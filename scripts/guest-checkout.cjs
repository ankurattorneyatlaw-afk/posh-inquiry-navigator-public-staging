'use strict';

const {createHmac,randomUUID}=require('node:crypto');
const {seal,unseal}=require('./account-access.cjs');
const {clientNetwork}=require('./request-guards.cjs');
const {stagingOrigin}=require('./plan-store.cjs');

const products=new Set(['checklist','compliance-checklist']);
const testRecipients=new Set([
  'ankur.attorneyatlaw+navigator-hosted-owner@gmail.com',
  'ankur.attorneyatlaw+navigator-hosted-customer@gmail.com',
]);
const orderPattern=/^order_[A-Za-z0-9]{1,40}$/;
const sessionSeconds=12*60*60;

function guestCheckout({
  origin=process.env.RENDER_EXTERNAL_URL,url=process.env.NAVIGATOR_AUTH_URL,
  key=process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,token=process.env.NAVIGATOR_CHECKLIST_STORE_TOKEN,
  mode=process.env.NAVIGATOR_CHECKLIST_TEST_MODE,fetchImpl=fetch,now=Date.now,
}={}){
  const enabled=origin===stagingOrigin && ['simulated','razorpay-test'].includes(mode) &&
    /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'') && !!key && /^[a-f0-9]{64}$/.test(token||'');
  const secret=enabled?createHmac('sha256',token).update('navigator staging guest checkout cookie').digest():null;
  const cookieName=product=>'__Host-navigator-guest-'+product;
  const rates=new Map();
  let resetAt=0;
  function write(res,product,buyer){
    const value=seal({...buyer,expires:now()+sessionSeconds*1000},secret);
    const line=cookieName(product)+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+sessionSeconds;
    const prior=res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie',prior?[].concat(prior,line):line);
  }
  function read(req,product,order){
    if(!enabled||!products.has(product))return null;
    const prefix=cookieName(product)+'=';
    const value=String(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith(prefix));
    const session=value&&unseal(value.slice(prefix.length),secret);
    if(!session||session.expires<=now()||session.product!==product||
      (order&&session.order&&session.order!==order))return null;
    return {id:session.id,guest:true,email:session.email,order:session.order};
  }
  function bind(req,res,product,buyer,order){
    if(buyer.guest)write(res,product,{...buyer,product,order});
  }
  async function rpc(action,product,guest,order,data={}){
    const result=await fetchImpl(url+'/rest/v1/rpc/navigator_guest_checklist',{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({p_token:token,p_action:action,p_product:product,p_gateway:mode,p_guest:guest,p_order:order,p_data:data}),
      signal:AbortSignal.timeout(8000),
    });
    if(!result.ok)throw Object.assign(Error('Guest checkout store unavailable'),{checkoutSource:'guest-store',status:result.status});
    return result.json();
  }
  function orders(product,buyer,action,values){
    const order=values?.p_id??buyer.order??null;
    if(buyer.order&&(action==='create'||buyer.order!==order))return null;
    return rpc(action,product,buyer.id,order,{organisation:values?.p_organisation,payment:values?.p_payment,email:buyer.email});
  }
  function progress(buyer,id,change={}){
    return rpc('progress','checklist',buyer.id,id??buyer.order??null,
      {import:change.p_import,number:change.p_number,checked:change.p_checked});
  }
  function assessment(buyer,order,action,payload,revision){
    return rpc('assessment-'+action,'compliance-checklist',buyer.id,order,{payload,revision});
  }
  function identify(accountIdentity,product){
    return async (req,res)=>{
      const order=new URL(req.url,'http://localhost').searchParams.get('order');
      return read(req,product,order)||accountIdentity(req,res);
    };
  }
  async function handle(req,res,parsed){
    if(!parsed.pathname.startsWith('/api/guest-checkout/'))return false;
    function send(status,body){
      res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie'});
      res.end(JSON.stringify(body));
      return true;
    }
    if(!enabled)return send(404,{error:'Guest checkout is unavailable.'});
    if(req.method!=='POST'||req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))
      return send(403,{error:'Open the staging checkout or the link in your receipt.'});
    const action=parsed.pathname.slice('/api/guest-checkout/'.length);
    if(!['start','resume'].includes(action))return send(404,{error:'Guest checkout action not found.'});
    if(now()>=resetAt){rates.clear();resetAt=now()+600000;}
    const network=clientNetwork(req);
    const rateKey=action+'|'+network;
    if(rates.size>=2000&&!rates.has(rateKey))return send(429,{error:'Please retry in a few minutes.'});
    const count=(rates.get(rateKey)||0)+1;
    rates.set(rateKey,count);
    if(count>(action==='start'?12:30))return send(429,{error:'Please retry in a few minutes.'});
    let size=0;const chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>1024)return send(413,{error:'Request is too large.'});chunks.push(chunk);}
    let data;
    try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Invalid guest checkout request.'});}
    if(!data||typeof data!=='object'||Array.isArray(data))return send(400,{error:'Invalid guest checkout request.'});
    if(action==='start'){
      if(Object.keys(data).length!==2||!products.has(data.product)||typeof data.email!=='string')
        return send(400,{error:'Enter a receipt email address.'});
      const email=data.email.trim().toLowerCase();
      if(!testRecipients.has(email))return send(403,{error:'Staging receipts can be sent only to approved test addresses.'});
      write(res,data.product,{id:randomUUID(),product:data.product,email});
      return send(200,{ready:true});
    }
    if(Object.keys(data).length!==1||typeof data.token!=='string'||!/^[a-f0-9]{64}$/.test(data.token))
      return send(400,{error:'This receipt link is invalid or expired.'});
    try{
      const purchase=await rpc('resume',null,null,null,{resume:data.token});
      if(!purchase||!products.has(purchase.product)||!orderPattern.test(purchase.id))
        return send(403,{error:'This receipt link is invalid or expired.'});
      write(res,purchase.product,{id:purchase.guest,product:purchase.product,order:purchase.id});
      const page=purchase.product==='checklist'?'inquiry-checklist.html':'compliance-assessment.html';
      return send(200,{delivery:'/'+page+'?order='+encodeURIComponent(purchase.id)});
    }catch{
      return send(503,{error:'Your purchase could not be opened. Try the link again in a moment.'});
    }
  }
  return {enabled,identify,orders,progress,assessment,bind,handle};
}

module.exports={guestCheckout};
