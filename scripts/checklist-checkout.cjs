'use strict';
const {createHmac, randomBytes, timingSafeEqual}=require('node:crypto');
const {generate, organisationName}=require('./buyer-checklist.cjs');
const {existsSync}=require('node:fs');
const path=require('node:path');
const {products}=require('../dist/products.js');
const {buildDocx}=require('../dist/personal-docx.js');
const {onlineFromEnvironment,accessUntil}=require('./online-checklist.cjs');
const legacyProduct='checklist';
const complianceProduct='compliance-checklist';
const price=product=>products.find(item=>item.id===product).amount;
const currency='INR';
const orderPattern=/^order_[A-Za-z0-9]{1,40}$/;
const paymentPattern=/^pay_[A-Za-z0-9]{1,50}$/;
const stagingOrigin='https://posh-inquiry-navigator-staging.onrender.com';

function supabaseOrders({url,key,token,product=legacyProduct,fetchImpl=fetch}) {
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'') || !key || !/^[a-f0-9]{64}$/.test(token||'')) return null;
  const rpc=product===complianceProduct?'navigator_compliance_checklist_order':'navigator_checklist_order';
  return async (buyer, action, gateway, values={}) => {
    const response=await fetchImpl(url+'/rest/v1/rpc/'+rpc,{
      method:'POST',headers:{apikey:key,Authorization:'Bearer '+buyer.accessToken,'Content-Type':'application/json'},
      body:JSON.stringify({p_token:token,p_action:action,p_gateway:gateway,...values}),signal:AbortSignal.timeout(8000)
    });
    if (!response.ok) throw Object.assign(Error('Order store unavailable'),{checkoutSource:'order-store',status:response.status});
    return response.json();
  };
}

function razorpayTest({keyId,secret,product=legacyProduct,fetchImpl=fetch}) {
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
    create:()=>call('orders',{amount:price(product),currency,receipt:'navcheck_'+randomBytes(12).toString('hex'),notes:{product,mode:'test'}}),
    verify:async (id,{paymentId,signature})=>{
      if (!paymentPattern.test(paymentId||'') || !/^[a-f0-9]{64}$/.test(signature||'')) return null;
      const expected=createHmac('sha256',secret).update(id+'|'+paymentId).digest();
      if (!timingSafeEqual(expected,Buffer.from(signature,'hex'))) return null;
      const result=await call('payments/'+paymentId);
      return result.id===paymentId?result:null;
    }
  };
}

function simulatedGateway(product=legacyProduct) {
  const amount=price(product);
  return {
    name:'simulated',
    create:async()=>({id:'order_sim'+randomBytes(12).toString('hex'),amount,currency}),
    verify:async id=>({id:'pay_sim'+id.slice('order_sim'.length),order_id:id,amount,currency,status:'captured'})
  };
}

function createChecklistCheckout({identify,origin,store,gateway,readTemplate,renderDocument,online,product=legacyProduct,assessment=false,guest,now=Date.now}) {
  const amount=price(product);
  const prefix='/api/'+product+'/';
  const filename=product===complianceProduct?'POSH-Compliance-Checklist':'POSH-Checklist';
  const createFile=renderDocument||(readTemplate&&((organisation,id)=>generate(readTemplate(),organisation,id)));
  const orderLimits=new Map();
  let limitUntil=now()+600000;
  const send=(res,status,value)=>{
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie'});
    res.end(JSON.stringify(value));
    return true;
  };
  const delivery=id=>(assessment?'/compliance-assessment.html?order=':prefix+'download?order=')+encodeURIComponent(id);
  const summary=order=>{
    if(!order)return null;
    if(online){
      const until=accessUntil(order);
      return {orderId:order.id,organisation:order.organisation,captured:order.captured,accessUntil:until,receiptStatus:order.receiptStatus,
        delivery:until&&now()<Date.parse(until)?'/inquiry-checklist.html?order='+encodeURIComponent(order.id):null};
    }
    return {
    orderId:order.id,organisation:order.organisation,captured:order.captured,receiptStatus:order.receiptStatus,
    downloadUntil:assessment?null:order.downloadUntil??null,
    delivery:order.captured&&(assessment||order.downloadAvailable===true)?delivery(order.id):null
    };
  };
  return async (req,res,url)=>{
    if (!url.pathname.startsWith(prefix)) return false;
    const action=url.pathname.slice(prefix.length);
    if (!['session','download','content','progress','order','verify','cancel'].includes(action)) return send(res,404,{error:'Checkout action not found.'});
    if (req.method!==(['session','download','content'].includes(action)?'GET':'POST')) return send(res,405,{error:'Method not allowed.'});
    if (req.method==='POST'&&(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))) return send(res,403,{error:'Use the Navigator checkout page.'});
    let phase='session';
    try {
      const buyer=await identify(req,res);
      const available=!!(store&&gateway&&(online||assessment||createFile));
      if (action==='session') {
        const latest=buyer&&available?await store(buyer,'latest',gateway.name):null;
        return send(res,200,{signedIn:!!buyer&&!buyer.guest,guestCheckout:!!guest?.enabled,guestOrder:!!buyer?.guest,
          available,mode:gateway?.name||'disabled',keyId:gateway?.keyId,livePaymentsEnabled:false,latest:summary(latest)});
      }
      if (!buyer) return send(res,401,{error:'Start guest checkout or use the link in your receipt.'});
      if (action==='content'||action==='progress') {
        if (!online) return send(res,404,{error:'Checklist action not found.'});
        const id=url.searchParams.get('order');
        if ((id!==null||action==='progress')&&!orderPattern.test(id||'')) return send(res,400,{error:'Check the order reference.'});
        let change;
        if(action==='progress'){
          let size=0;const chunks=[];
          for await(const chunk of req){size+=chunk.length;if(size>1024)return send(res,413,{error:'Progress update is too large.'});chunks.push(chunk);}
          let data;
          try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(res,400,{error:'Invalid progress update.'});}
          if(!data||typeof data!=='object'||Array.isArray(data))return send(res,400,{error:'Invalid progress update.'});
          const fields=Object.keys(data);
          const itemNumber=n=>Number.isInteger(n)&&n>=1&&n<=43;
          if(fields.length===1&&Array.isArray(data.importChecked)&&data.importChecked.length<=43&&data.importChecked.every(itemNumber)){
            change={p_import:[...new Set(data.importChecked)]};
          }else if(fields.length===2&&itemNumber(data.number)&&typeof data.checked==='boolean'){
            change={p_number:data.number,p_checked:data.checked};
          }else return send(res,400,{error:'Use a checklist number and checked state.'});
        }
        const entitlement=await online.access(buyer,id,change);
        if (!entitlement) return send(res,403,{error:'Open this IC / LC Inquiry Checklist from its receipt link or original buyer account.'});
        if (!entitlement.active) return send(res,410,{error:'The 120-day online access period has ended.',accessUntil:entitlement.accessUntil});
        const checked=entitlement.checked??[];
        if(action==='progress')return send(res,200,{checked});
        const {stages,sources}=online.read(entitlement.edition);
        return send(res,200,{orderId:entitlement.id,organisation:entitlement.organisation,edition:entitlement.edition,accessUntil:entitlement.accessUntil,checked,stages,sources});
      }
      if (online&&action==='download') return send(res,410,{error:'This checklist is now online. Open it from your workspace.'});
      if (!available) return send(res,503,{error:'Checklist test checkout is not configured.'});
      if (action==='download') {
        if (assessment) return send(res,410,{error:'Open your online assessment to download its final report.'});
        const id=url.searchParams.get('order');
        if (!orderPattern.test(id||'')) return send(res,400,{error:'Check the order reference.'});
        const order=await store(buyer,'get',gateway.name,{p_id:id});
        if (!order?.captured) return send(res,403,{error:'This captured order is unavailable for your account.'});
        if (order.downloadAvailable!==true) return send(res,410,{error:'The 90-day redownload period has ended.'});
        const file=createFile(order.organisation,order.id);
        res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition':`attachment; filename="${filename}-${order.id}.docx"`,'Cache-Control':'private, no-store','Vary':'Cookie'});
        res.end(file);return true;
      }
      let size=0;const chunks=[];
      for await (const chunk of req) {size+=chunk.length;if(size>2048)return send(res,413,{error:'Request is too large.'});chunks.push(chunk);}
      let data;
      try {data=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return send(res,400,{error:'Invalid checkout request.'});}
      const keys=action==='order'?['organisation','testConsent']:action==='cancel'?['orderId']:['orderId','paymentId','signature'];
      if (!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!keys.includes(key))) return send(res,400,{error:'Only checkout details are accepted.'});
      if (action==='order') {
        if (buyer.guest&&buyer.order) return send(res,409,{error:'Start a new guest checkout for another order.'});
        if (data.testConsent!==true) return send(res,400,{error:'Confirm that this is a test checkout.'});
        let organisation;
        try {organisation=organisationName(data.organisation);}catch(error){return send(res,400,{error:error.message});}
        if (now()>=limitUntil) {orderLimits.clear();limitUntil=now()+600000;}
        const count=(orderLimits.get(buyer.id)||0)+1;
        if (count>8||(!orderLimits.has(buyer.id)&&orderLimits.size>=500)) return send(res,429,{error:'Test order limit reached. Try again later.'});
        orderLimits.set(buyer.id,count);
        // Verify the protected asset can be generated before starting checkout.
        phase='prepare-template';
        if(online)online.read('2.0');
        else if(!assessment)createFile(organisation,'PREVIEW');
        phase='create-gateway-order';
        const order=await gateway.create();
        if (!orderPattern.test(order?.id||'')||order.amount!==amount||order.currency!==currency) throw Error('Invalid gateway order');
        phase='save-order';
        const saved=await store(buyer,'create',gateway.name,{p_id:order.id,p_organisation:organisation});
        if (saved?.id!==order.id) throw Error('Order not saved');
        guest?.bind(req,res,product,buyer,order.id);
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
      console.warn('Checklist checkout failed', {product,action,phase,mode:gateway?.name,
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

function compliancePreview(organisation,orderId) {
  const title='Compliance Checklist';
  return Buffer.from(buildDocx(title,[
    {type:'title',text:title},
    {type:'heading',text:'Staging test file'},
    {type:'p',text:'This file verifies delivery. The final Compliance Checklist is being prepared.'},
    {type:'meta',text:'Organisation: '+organisation},
    {type:'meta',text:'Test order: '+orderId}
  ]));
}

function fromEnvironment(identify,product=legacyProduct,guest) {
  const origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173';
  const mode=process.env.NAVIGATOR_CHECKLIST_TEST_MODE;
  const gateway=origin!==stagingOrigin?null:mode==='simulated'?simulatedGateway(product):mode==='razorpay-test'?razorpayTest({product,keyId:process.env.RAZORPAY_KEY_ID,secret:process.env.RAZORPAY_KEY_SECRET}):null;
  const accountStore=supabaseOrders({product,url:process.env.NAVIGATOR_AUTH_URL,key:process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,token:process.env.NAVIGATOR_CHECKLIST_STORE_TOKEN});
  const store=accountStore&&(async (buyer,action,gatewayName,values)=>
    buyer.guest?guest.orders(product,buyer,action,values):accountStore(buyer,action,gatewayName,values));
  const assetKey=process.env.NAVIGATOR_CHECKLIST_ASSET_KEY;
  const reader=require('./product-assets.cjs').productReader({key:assetKey});
  const template=product===complianceProduct?'compliance-checklist-template.json':'buyer-checklist-template.json';
  const preview=product===complianceProduct&&origin===stagingOrigin&&!existsSync(path.join(__dirname,'../products',template+'.enc'));
  const readTemplate=/^[a-f0-9]{64}$/.test(assetKey||'')?()=>JSON.parse(reader(template).toString('utf8')):null;
  const accountOnline=product===legacyProduct?onlineFromEnvironment():null;
  const online=accountOnline&&{...accountOnline,access:(buyer,order,change)=>
    buyer.guest?guest.progress(buyer,order,change):accountOnline.access(buyer,order,change)};
  return createChecklistCheckout({identify:guest?.identify(identify,product)||identify,origin,store,gateway,product,
    readTemplate,renderDocument:preview?compliancePreview:null,online,assessment:product===complianceProduct,guest});
}
module.exports={createChecklistCheckout,fromEnvironment,razorpayTest,simulatedGateway,supabaseOrders};
