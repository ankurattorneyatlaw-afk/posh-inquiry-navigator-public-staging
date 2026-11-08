'use strict';
const {createHmac, randomBytes, timingSafeEqual}=require('node:crypto');
const {generate, organisationName}=require('./buyer-checklist.cjs');
const amount=99900;
const currency='INR';
const orderPattern=/^order_[A-Za-z0-9]{1,40}$/;
const paymentPattern=/^pay_[A-Za-z0-9]{1,50}$/;
const stagingOrigin='https://posh-inquiry-navigator-staging.onrender.com';

function supabaseOrders({url,key,token,fetchImpl=fetch}) {
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'') || !key || !/^[a-f0-9]{64}$/.test(token||'')) return null;
  return async (buyer, action, gateway, values={}) => {
    const response=await fetchImpl(url+'/rest/v1/rpc/navigator_checklist_order',{
      method:'POST',headers:{apikey:key,Authorization:'Bearer '+buyer.accessToken,'Content-Type':'application/json'},
      body:JSON.stringify({p_token:token,p_action:action,p_gateway:gateway,...values}),signal:AbortSignal.timeout(8000)
    });
    if (!response.ok) throw Object.assign(Error('Order store unavailable'),{checkoutSource:'order-store',status:response.status});
    return response.json();
  };
}

function razorpayTest({keyId,secret,fetchImpl=fetch}) {
  if (!/^rzp_test_[A-Za-z0-9]+$/.test(keyId||'') || !secret) return null;
  async function call(path,body) {
    const response=await fetchImpl('https://api.razorpay.com/v1/'+path,{
      method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(keyId+':'+secret).toString('base64'),'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      let description='';
      try {description=String((await response.json()).error?.description||'');} catch {}
      const reason=/authenticat|invalid.{0,12}key|incorrect.{0,12}key/i.test(description)?'credentials':
        /activat|disabled|not enabled|not allowed|restricted|onboarding/i.test(description)?'account-restriction':'rejected';
      throw Object.assign(Error('Test payment provider unavailable'),{checkoutSource:'razorpay',status:response.status,reason});
    }
    return response.json();
  }
  return {
    name:'razorpay-test', keyId,
    create:()=>call('orders',{amount,currency,receipt:'navcheck_'+randomBytes(12).toString('hex'),notes:{product:'checklist',mode:'test'}}),
    verify:async (id,{paymentId,signature})=>{
      if (!paymentPattern.test(paymentId||'') || !/^[a-f0-9]{64}$/.test(signature||'')) return null;
      const expected=createHmac('sha256',secret).update(id+'|'+paymentId).digest();
      if (!timingSafeEqual(expected,Buffer.from(signature,'hex'))) return null;
      const result=await call('payments/'+paymentId);
      return result.id===paymentId?result:null;
    }
  };
}

function simulatedGateway() {
  return {
    name:'simulated',
    create:async()=>({id:'order_sim'+randomBytes(12).toString('hex'),amount,currency}),
    verify:async id=>({id:'pay_sim'+id.slice('order_sim'.length),order_id:id,amount,currency,status:'captured'})
  };
}

function createChecklistCheckout({identify,origin,store,gateway,readTemplate,now=Date.now}) {
  const orderLimits=new Map();
  let limitUntil=now()+600000;
  const send=(res,status,value)=>{
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie'});
    res.end(JSON.stringify(value));
    return true;
  };
  const delivery=id=>'/api/checklist/download?order='+encodeURIComponent(id);
  const summary=order=>order?{
    orderId:order.id,organisation:order.organisation,captured:order.captured,
    downloadUntil:order.downloadUntil??null,
    delivery:order.captured&&order.downloadAvailable===true?delivery(order.id):null
  }:null;
  return async (req,res,url)=>{
    if (!url.pathname.startsWith('/api/checklist/')) return false;
    const action=url.pathname.slice('/api/checklist/'.length);
    if (!['session','download','order','verify','cancel'].includes(action)) return send(res,404,{error:'Checkout action not found.'});
    if (req.method!==(['session','download'].includes(action)?'GET':'POST')) return send(res,405,{error:'Method not allowed.'});
    if (req.method==='POST'&&(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))) return send(res,403,{error:'Use the Navigator checkout page.'});
    let phase='session';
    try {
      const buyer=await identify(req,res);
      const available=!!(store&&gateway&&readTemplate);
      if (action==='session') {
        const latest=buyer&&available?await store(buyer,'latest',gateway.name):null;
        return send(res,200,{signedIn:!!buyer,available,mode:gateway?.name||'disabled',keyId:gateway?.keyId,livePaymentsEnabled:false,latest:summary(latest)});
      }
      if (!buyer) return send(res,401,{error:'Sign in to continue.'});
      if (!available) return send(res,503,{error:'Checklist test checkout is not configured.'});
      if (action==='download') {
        const id=url.searchParams.get('order');
        if (!orderPattern.test(id||'')) return send(res,400,{error:'Check the order reference.'});
        const order=await store(buyer,'get',gateway.name,{p_id:id});
        if (!order?.captured) return send(res,403,{error:'This captured order is unavailable for your account.'});
        if (order.downloadAvailable!==true) return send(res,410,{error:'The 90-day redownload period has ended.'});
        const file=generate(readTemplate(),order.organisation,order.id);
        res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition':`attachment; filename="POSH-Checklist-${order.id}.docx"`,'Cache-Control':'private, no-store','Vary':'Cookie'});
        res.end(file);return true;
      }
      let size=0;const chunks=[];
      for await (const chunk of req) {size+=chunk.length;if(size>2048)return send(res,413,{error:'Request is too large.'});chunks.push(chunk);}
      let data;
      try {data=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return send(res,400,{error:'Invalid checkout request.'});}
      const keys=action==='order'?['organisation','testConsent']:action==='cancel'?['orderId']:['orderId','paymentId','signature'];
      if (!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!keys.includes(key))) return send(res,400,{error:'Only checkout details are accepted.'});
      if (action==='order') {
        if (data.testConsent!==true) return send(res,400,{error:'Confirm that this is a test checkout.'});
        let organisation;
        try {organisation=organisationName(data.organisation);}catch(error){return send(res,400,{error:error.message});}
        if (now()>=limitUntil) {orderLimits.clear();limitUntil=now()+600000;}
        const count=(orderLimits.get(buyer.id)||0)+1;
        if (count>8||(!orderLimits.has(buyer.id)&&orderLimits.size>=500)) return send(res,429,{error:'Test order limit reached. Try again later.'});
        orderLimits.set(buyer.id,count);
        // Verify the protected asset can be generated before starting checkout.
        phase='prepare-template';
        generate(readTemplate(),organisation,'PREVIEW');
        phase='create-gateway-order';
        const order=await gateway.create();
        if (!orderPattern.test(order?.id||'')||order.amount!==amount||order.currency!==currency) throw Error('Invalid gateway order');
        phase='save-order';
        const saved=await store(buyer,'create',gateway.name,{p_id:order.id,p_organisation:organisation});
        if (saved?.id!==order.id) throw Error('Order not saved');
        return send(res,201,{...summary(saved),amount,currency,keyId:gateway.keyId,mode:gateway.name});
      }
      if (!orderPattern.test(data.orderId||'')) return send(res,400,{error:'Check the order reference.'});
      if (action==='cancel') {
        phase='cancel-order';
        const result=await store(buyer,'cancel',gateway.name,{p_id:data.orderId});
        if (!result) return send(res,403,{error:'This order is unavailable for your account.'});
        if (result.captured) return send(res,409,{error:'This order was already captured. Reload to view its download.'});
        if (!result.cancelled) throw Error('Cancellation not saved');
        const latest=await store(buyer,'latest',gateway.name);
        return send(res,200,{cancelled:true,latest:summary(latest),mode:gateway.name,keyId:gateway.keyId});
      }
      const order=await store(buyer,'get',gateway.name,{p_id:data.orderId});
      if (!order) return send(res,403,{error:'This order is unavailable for your account.'});
      if (order.cancelled) return send(res,409,{error:'This test order was cancelled. Start a new test order.'});
      if (order.captured) return send(res,200,summary(order));
      phase='verify-gateway-payment';
      const payment=await gateway.verify(order.id,data);
      if (!payment||!paymentPattern.test(payment.id||'')||payment.live_mode===true||payment.order_id!==order.id||payment.amount!==amount||payment.currency!==currency) return send(res,400,{error:'Payment verification failed.'});
      if (payment.status!=='captured') return send(res,409,{error:'Test payment is awaiting capture. Retry verification.'});
      phase='save-capture';
      const saved=await store(buyer,'capture',gateway.name,{p_id:order.id,p_payment:payment.id});
      if (!saved) {
        const current=await store(buyer,'get',gateway.name,{p_id:order.id});
        if (current?.cancelled) return send(res,409,{error:'This test order was cancelled before delivery.'});
      }
      if (!saved?.captured||saved.paymentId!==payment.id) throw Error('Capture not saved');
      return send(res,200,summary(saved));
    } catch(error) {
      console.warn('Checklist checkout failed', {action,phase,mode:gateway?.name,
        source:error.checkoutSource,status:error.status,reason:error.reason});
      const errorMessage=error.checkoutSource==='razorpay'?
        error.reason==='credentials'||error.status===401?'Razorpay rejected the staging test credentials. Check the test key pair in Render.':
        error.reason==='account-restriction'||error.status===403?'Razorpay restricted this test request. Check the merchant account in Test Mode.':
        'Razorpay did not accept the test request. No checklist was released.':
        'Checklist checkout is temporarily unavailable. Keep your order reference and retry.';
      return send(res,503,{error:errorMessage});
    }
  };
}

function fromEnvironment(identify) {
  const origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173';
  const mode=process.env.NAVIGATOR_CHECKLIST_TEST_MODE;
  const gateway=origin!==stagingOrigin?null:mode==='simulated'?simulatedGateway():mode==='razorpay-test'?razorpayTest({keyId:process.env.RAZORPAY_KEY_ID,secret:process.env.RAZORPAY_KEY_SECRET}):null;
  const store=supabaseOrders({url:process.env.NAVIGATOR_AUTH_URL,key:process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,token:process.env.NAVIGATOR_CHECKLIST_STORE_TOKEN});
  const assetKey=process.env.NAVIGATOR_CHECKLIST_ASSET_KEY;
  const reader=require('./product-assets.cjs').productReader({key:assetKey});
  return createChecklistCheckout({identify,origin,store,gateway,readTemplate:/^[a-f0-9]{64}$/.test(assetKey||'')?()=>JSON.parse(reader('buyer-checklist-template.json').toString('utf8')):null});
}
module.exports={createChecklistCheckout,fromEnvironment,razorpayTest,simulatedGateway,supabaseOrders};
