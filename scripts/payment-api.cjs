'use strict';
const {createHmac,timingSafeEqual,randomBytes}=require('node:crypto');
const plans={essential:{name:'Inquiry Essential',amount:2499900,months:6,users:2},professional:{name:'Inquiry Professional',amount:4999900,months:9,users:5},advanced:{name:'Inquiry Advanced',amount:8999900,months:12,users:8}};
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
function createPaymentHandler({keyId=process.env.RAZORPAY_KEY_ID,secret=process.env.RAZORPAY_KEY_SECRET,origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',fetchImpl=fetch,now=Date.now}={}){
 const configured=!!(keyId?.startsWith('rzp_test_')&&secret);let count=0,start=now();
 const sign=s=>createHmac('sha256',secret).update(s).digest('hex');
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 async function gateway(path,body){const r=await fetchImpl('https://api.razorpay.com/v1/'+path,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(keyId+':'+secret).toString('base64'),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('gateway');return r.json()}
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/payments/'))return false;
  if(url.pathname==='/api/payments/config'&&req.method==='GET'){send(res,200,{mode:'test',configured,livePaymentsEnabled:false,plans});return true;}
  if(req.method!=='POST'){send(res,405,{error:'Method not allowed.'});return true;}
  if(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){send(res,403,{error:'Use the staging checkout page.'});return true;}
  if(!configured){send(res,503,{error:'Test checkout has not been enabled yet. No payment has been taken.'});return true;}
  if(now()-start>900000){start=now();count=0}if(++count>30){send(res,429,{error:'Please try again later.'});return true;}
  try{
   let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>4096){send(res,413,{error:'Request too large.'});return true}}
   let data;try{data=JSON.parse(raw)}catch{send(res,400,{error:'Invalid request.'});return true;}
   if(!data||typeof data!=='object'||Array.isArray(data)){send(res,400,{error:'Invalid request.'});return true;}
   if(url.pathname==='/api/payments/order'){
    const plan=Object.hasOwn(plans,data.plan)?plans[data.plan]:null;if(!plan||data.testConsent!==true){send(res,400,{error:'Choose an eligible plan and confirm test mode.'});return true;}
    const order=await gateway('orders',{amount:plan.amount,currency:'INR',receipt:'nav_test_'+randomBytes(10).toString('hex'),notes:{environment:'staging_test',plan:data.plan,no_service_activation:'true'}});
    if(!/^order_[A-Za-z0-9]+$/.test(order.id)||order.amount!==plan.amount||order.currency!=='INR')throw Error('gateway');
    const context=Buffer.from(JSON.stringify({order:order.id,plan:data.plan,amount:plan.amount,expires:now()+1800000})).toString('base64url');
    send(res,200,{keyId,orderId:order.id,amount:plan.amount,currency:'INR',name:plan.name,mode:'test',context:context+'.'+sign(context)});return true;
   }
   if(url.pathname==='/api/payments/verify'){
    const pieces=typeof data.context==='string'?data.context.split('.'):[];
    if(pieces.length!==2||!equal(sign(pieces[0]),pieces[1])){send(res,400,{error:'Invalid checkout context.'});return true;}
    let ctx;try{ctx=JSON.parse(Buffer.from(pieces[0],'base64url').toString())}catch{send(res,400,{error:'Invalid checkout context.'});return true;}
    if(!ctx||!Object.hasOwn(plans,ctx.plan)||!Number.isFinite(ctx.expires)||ctx.expires<now()||ctx.amount!==plans[ctx.plan].amount||!/^pay_[A-Za-z0-9]+$/.test(data.paymentId||'')||data.orderId!==ctx.order||!equal(sign(ctx.order+'|'+data.paymentId),data.signature)){send(res,400,{error:'Payment verification failed.'});return true;}
    const payment=await gateway('payments/'+data.paymentId);
    if(payment.order_id!==ctx.order||payment.amount!==ctx.amount||payment.currency!=='INR'||!['authorized','captured'].includes(payment.status)){send(res,400,{error:'The test payment could not be confirmed.'});return true;}
    send(res,200,{mode:'test',status:payment.status==='captured'?'test_success':'test_authorized',serviceActivated:false,message:payment.status==='captured'?'Test payment verified. No real charge, invoice or service activation.':'Test payment authorized; capture is still pending. No service activated.'});return true;
   }
   send(res,404,{error:'Not found.'});return true;
  }catch{send(res,503,{error:'Test checkout could not be completed. Please retry or contact the owner.'});return true;}
 };
}
module.exports={createPaymentHandler,plans};
