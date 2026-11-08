'use strict';
const {createHmac,timingSafeEqual,randomBytes}=require('node:crypto');
const catalogue=require(require('node:fs').existsSync(require('node:path').join(__dirname,'../plans.js'))?'../plans.js':'../dist/plans.js');
const plans=catalogue.checkoutPlans;
const {stagingOrigin}=require('./plan-store.cjs');
const validOrder=id=>/^order_[A-Za-z0-9]{1,40}$/.test(id||'');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
function createPaymentHandler({keyId=process.env.RAZORPAY_KEY_ID,secret=process.env.RAZORPAY_KEY_SECRET,origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',fetchImpl=fetch,now=Date.now,identify=async()=>null,store=null,requireDurable=false}={}){
 const configured=!!(/^rzp_test_[A-Za-z0-9_]+$/.test(keyId||'')&&secret&&(!requireDurable||store));let count=0,start=now();const sandbox=new Map(),payments=new Map();

 const sandboxTools=origin===stagingOrigin&&Boolean(store||configured);
 async function entitlement(req,res,orderId){
   if(!sandboxTools||!validOrder(orderId))return null;
   const buyer=await identify(req,res);
   if(!buyer)return null;
   if(store)return store(buyer,'get',{p_id:orderId});
   const order=sandbox.get(orderId);
   return buyer.id===order?.accountId&&Date.parse(order.ends_at)>now()?{plan:order.plan,state:'active'}:null;
 }
 async function toolsPlan(req,res,orderId){
   const access=await entitlement(req,res,orderId);
   return access?.state==='active'?access.plan:null;
 }
 async function editSeats(req,res,url){
   if(!sandboxTools||!store){send(res,503,{error:'Staging seat management is unavailable.'});return true;}
   if(!['GET','POST'].includes(req.method)){send(res,405,{error:'Method not allowed.'});return true;}
   if(req.method==='POST'&&(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))){
     send(res,403,{error:'Use the Navigator seat controls.'});return true;
   }
   const id=url.searchParams.get('order');
   if(!validOrder(id)){send(res,400,{error:'Check the order reference.'});return true;}
   const buyer=await identify(req,res);
   if(!buyer){send(res,401,{error:'Sign in to manage seats.'});return true;}
   let action='seats', params={p_id:id};
   if(req.method==='POST'){
     let raw='';
     for await(const chunk of req){
       raw+=chunk.toString();
       if(Buffer.byteLength(raw)>1024){send(res,413,{error:'Request too large.'});return true;}
     }
     let data;
     try{data=JSON.parse(raw);}catch{send(res,400,{error:'Invalid seat request.'});return true;}
     if(data?.action==='add'&&Object.keys(data).length===2&&typeof data.email==='string'&&data.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)){
       action='add';params.p_email=data.email;
     }else if(['remove','invite_cancel'].includes(data?.action)&&Object.keys(data).length===2&&typeof data.member==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.member)){
       action=data.action;params.p_member=data.member;
     }else{send(res,400,{error:'Enter a member email or select an existing seat or invitation.'});return true;}
   }
   let result=await store(buyer,action,params);
   if(action==='add'&&result?.inviteRequired){
     if(!store.invite){send(res,503,{error:'Email invitations are temporarily unavailable.'});return true;}
     result=await store.invite(buyer,id,params.p_email.trim().toLowerCase());
   }
   send(res,result?.error?409:result?200:403,result||{error:'Only the order owner can manage seats.'});
   return true;
 }
 const toolsLink=orderId=>sandboxTools?'/plan-tools.html?testOrder='+encodeURIComponent(orderId):undefined;
 const sign=s=>createHmac('sha256',secret).update(s).digest('hex');
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 async function gateway(path,body){const r=await fetchImpl('https://api.razorpay.com/v1/'+path,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(keyId+':'+secret).toString('base64'),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('gateway');return r.json()}
 const handle=async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/payments/'))return false;
  if(url.pathname==='/api/payments/seats'){
    try{return await editSeats(req,res,url);}
    catch{send(res,503,{error:'Seat management is temporarily unavailable.'});return true;}
  }
  if(url.pathname==='/api/payments/sandbox-access'&&req.method==='GET'){try{const buyer=await identify(req,res);if(!buyer){send(res,401,{error:'Sign in to see your test purchases.'});return true;}if(store&&sandboxTools){
      const access=await store(buyer,'list');
      send(res,200,{mode:'test',realAccessActivated:false,temporary:false,access:access.map(row=>({...row,tools:toolsLink(row.id)}))});
      return true;
    }
    send(res,200,{mode:'test',realAccessActivated:false,temporary:true,access:[...sandbox].filter(([,x])=>x.accountId===buyer.id&&Date.parse(x.ends_at)>now()).map(([id,{plan,starts_at,ends_at}])=>({plan,starts_at,ends_at,tools:toolsLink(id)}))});return true;}catch{send(res,503,{error:'Test purchase status is temporarily unavailable.'});return true;}}
  if(url.pathname==='/api/payments/config'&&req.method==='GET'){send(res,200,{mode:'test',configured,livePaymentsEnabled:false,sandboxRoleAssignment:true,catalogueVersion:catalogue.version,plans});return true;}
  if(req.method!=='POST'){send(res,405,{error:'Method not allowed.'});return true;}
  if(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){send(res,403,{error:'Use the staging checkout page.'});return true;}
  if(!configured){send(res,503,{error:'Test checkout has not been enabled yet. No payment has been taken.'});return true;}
  if(now()-start>900000){start=now();count=0}if(++count>30){send(res,429,{error:'Please try again later.'});return true;}
  try{
   const buyer=await identify(req,res);if(!buyer){send(res,401,{error:'Sign in before starting test checkout.'});return true;}
   let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>4096){send(res,413,{error:'Request too large.'});return true}}
   let data;try{data=JSON.parse(raw)}catch{send(res,400,{error:'Invalid request.'});return true;}
   if(!data||typeof data!=='object'||Array.isArray(data)){send(res,400,{error:'Invalid request.'});return true;}
   const accepted=url.pathname==='/api/payments/order'?['plan','testConsent']:['context','paymentId','orderId','signature'];if(Object.keys(data).some(k=>!accepted.includes(k))){send(res,400,{error:'Only checkout identifiers are accepted. Never send case information.'});return true;}
   if(url.pathname==='/api/payments/order'){
    const plan=Object.hasOwn(plans,data.plan)?plans[data.plan]:null;if(!plan||data.testConsent!==true){send(res,400,{error:'Choose an eligible plan and confirm test mode.'});return true;}
    const order=await gateway('orders',{amount:plan.amount,currency:'INR',receipt:'nav_test_'+randomBytes(10).toString('hex'),notes:{environment:'staging_test',plan:data.plan,no_service_activation:'true'}});
    if(!validOrder(order.id)||order.amount!==plan.amount||order.currency!=='INR')throw Error('gateway');
    if(store){
      const pending=await store(buyer,'create',{p_id:order.id,p_plan:data.plan});
      if(pending?.id!==order.id||pending.state!=='pending')throw Error('Order was not saved');
    }
    const context=Buffer.from(JSON.stringify({order:order.id,account:buyer.id,plan:data.plan,amount:plan.amount,expires:now()+1800000})).toString('base64url');
    send(res,200,{keyId,orderId:order.id,amount:plan.amount,currency:'INR',name:plan.name,mode:'test',context:context+'.'+sign(context)});return true;
   }
   if(url.pathname==='/api/payments/verify'){
    const pieces=typeof data.context==='string'?data.context.split('.'):[];
    if(pieces.length!==2||!equal(sign(pieces[0]),pieces[1])){send(res,400,{error:'Invalid checkout context.'});return true;}
    let ctx;try{ctx=JSON.parse(Buffer.from(pieces[0],'base64url').toString())}catch{send(res,400,{error:'Invalid checkout context.'});return true;}
    if(!ctx||ctx.account!==buyer.id||!Object.hasOwn(plans,ctx.plan)||!Number.isFinite(ctx.expires)||ctx.expires<now()||ctx.amount!==plans[ctx.plan].amount||!/^pay_[A-Za-z0-9]+$/.test(data.paymentId||'')||data.orderId!==ctx.order||!equal(sign(ctx.order+'|'+data.paymentId),data.signature)){send(res,400,{error:'Payment verification failed.'});return true;}
    const previous=store?null:sandbox.get(ctx.order);if(previous){if(previous.accountId!==buyer.id||previous.paymentId!==data.paymentId){send(res,400,{error:'This test order was already used.'});return true;}send(res,200,{mode:'test',status:'test_success',serviceActivated:false,sandboxRoleAssigned:true,plan:previous.plan,tools:toolsLink(ctx.order),message:'This test purchase is already verified. Its sandbox role is unchanged; no real paid access was activated.'});return true;}
    const payment=await gateway('payments/'+data.paymentId);
    if(payment.id!==data.paymentId||payment.live_mode===true||payment.order_id!==ctx.order||payment.amount!==ctx.amount||payment.currency!=='INR'||!['authorized','captured'].includes(payment.status)){send(res,400,{error:'The test payment could not be confirmed.'});return true;}
    if(payment.status!=='captured'){send(res,200,{mode:'test',status:'test_authorized',serviceActivated:false,sandboxRoleAssigned:false,message:'Test payment authorised; capture is pending. No sandbox role or real access assigned.'});return true;}
    if(store){
      const saved=await store(buyer,'capture',{p_id:ctx.order,p_plan:ctx.plan,p_payment:data.paymentId});
      if(!saved||saved.state!=='active')throw Error('Durable activation could not be confirmed');
      send(res,200,{mode:'test',status:'test_success',serviceActivated:false,sandboxRoleAssigned:true,
        plan:saved.plan,tools:toolsLink(saved.id),message:'Test payment captured. Navigator saved the activation and assigned the matching test plan.'});
      return true;
    }
    if(payments.has(data.paymentId)&&payments.get(data.paymentId)!==ctx.order){send(res,400,{error:'This test payment was already linked to another order.'});return true;}
    if(sandbox.size>=1000){send(res,503,{error:'Sandbox purchase capacity reached. No real payment or access is affected.'});return true;}
    const concurrent=sandbox.get(ctx.order);if(concurrent){if(concurrent.paymentId!==data.paymentId||concurrent.accountId!==buyer.id){send(res,400,{error:'This test order was already verified with another payment.'});return true;}send(res,200,{mode:'test',status:'test_success',serviceActivated:false,sandboxRoleAssigned:true,plan:concurrent.plan,tools:toolsLink(ctx.order),message:'Test purchase already verified. No duplicate sandbox assignment.'});return true;}
    const startDate=new Date(now()),endDate=new Date(now()),day=endDate.getUTCDate();endDate.setUTCDate(1);endDate.setUTCMonth(endDate.getUTCMonth()+plans[ctx.plan].months);const last=new Date(Date.UTC(endDate.getUTCFullYear(),endDate.getUTCMonth()+1,0)).getUTCDate();endDate.setUTCDate(Math.min(day,last));
    const assigned={accountId:buyer.id,paymentId:data.paymentId,plan:ctx.plan,starts_at:startDate.toISOString(),ends_at:endDate.toISOString()};sandbox.set(ctx.order,assigned);payments.set(data.paymentId,ctx.order);
    send(res,200,{mode:'test',status:'test_success',serviceActivated:false,sandboxRoleAssigned:true,plan:ctx.plan,tools:toolsLink(ctx.order),message:'Test payment captured and verified. The matching sandbox role was assigned automatically. No real paid access or invoice was created. Open your workspace to review it.'});return true;
   }
   send(res,404,{error:'Not found.'});return true;
  }catch{send(res,503,{error:'Test checkout could not be completed. Please retry or contact the owner.'});return true;}
 };
 return Object.assign(handle,{toolsPlan,entitlement});
}
module.exports={createPaymentHandler,plans};
