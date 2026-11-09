
'use strict';
const { timingSafeEqual } = require('node:crypto');
const { stagingOrigin } = require('./plan-store.cjs');
const { createBrevoTransport } = require('./enquiry-mail.cjs');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const products = {
  checklist: ['IC / LC Inquiry Checklist', 'Use 43 checks to review the steps from complaint receipt to annual reporting. Preview six checks in the free PDF before choosing the 120-day online edition.', '/checklist-sample.pdf'],
  'compliance-checklist': ['Compliance Checklist', 'Review workplace compliance for one workplace or branch and one review year, with saved answers and a priority action list.'],
  aggrieved: ['Aggrieved Woman Advanced Guide', 'The guide brings together preparation steps, editable Word drafts and a private planner. Review the guidance and draft scope before choosing.'],
  respondent: ['Respondent Advanced Guide', 'The guide helps organise replies, documents and hearing preparation with editable Word drafts and a private planner. Review the scope before choosing.'],
  essential: ['Inquiry Essential', 'Guide up to two users through one inquiry with stage-specific drafts and timeline checks.'],
  professional: ['Inquiry Professional', 'Give up to five users a guided workflow with evidence-linked questions, working drafts and report preparation tools.'],
  advanced: ['Inquiry Advanced', 'Support up to eight users with tools for complex proceedings, evidence organisation and follow-up.'],
};
const plans = new Set(['essential', 'professional', 'advanced']);
const sender = { name:'The Cosmic Energizers', email:'training@thecosmicenergizers.com' };

function recoveryMessage(job, origin) {
  const [name, benefit, sample] = products[job.product];
  const resume = origin + (plans.has(job.product) ? '/checkout.html?plan=' : '/shop.html?product=') + job.product;
  const stop = origin + '/checkout-reminders.html#' + job.unsubscribe;
  const intro = job.step === 1
    ? (job.failed ? 'Your recent test checkout did not finish.' : 'You asked for a reminder about your unfinished test checkout.')
    : 'Here is your final reminder. If you have a question about access or delivery, reply and we can help.';
  const access = job.product==='checklist' ? 'The purchased edition stays open online for 120 days from verified payment capture. Ticks stay in the browser used to mark them.'
    : job.product==='compliance-checklist' ? 'Sign in to resume your assessment. Finalise it when the applicable checks are complete and download the report for internal review.'
    : plans.has(job.product) ? 'The plan page shows the included users, editing period and read-only period. You can review these details before starting again.'
    : 'The advanced guide provides 90 days of self-service access. Downloaded drafts remain available for your personal use.';
  return {
    sender, replyTo:sender, to:[{email:job.email}],
    subject:job.step === 1 ? 'Your Navigator checkout reminder' : 'Need help with your Navigator checkout?',
    tags:['navigator-checkout-staging'],
    textContent:[intro, name, job.step===1?benefit:access, sample && 'Free sample: ' + origin + sample,
      'Review and resume: ' + resume, 'This is a staging test. No real payment is taken.',
      'Stop these reminders: ' + stop, 'The Cosmic Energizers'].filter(Boolean).join('\n\n')
  };
}

function createRecovery({
  origin=process.env.RENDER_EXTERNAL_URL, identify, fetchImpl=fetch,
  url=process.env.NAVIGATOR_AUTH_URL, key=process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,
  storeToken=process.env.NAVIGATOR_CHECKLIST_STORE_TOKEN,
  workerToken=process.env.NAVIGATOR_CHECKOUT_RECOVERY_WORKER_TOKEN,
  mode=process.env.NAVIGATOR_CHECKOUT_RECOVERY_MAIL_MODE,
  allowEmail=process.env.NAVIGATOR_CHECKOUT_RECOVERY_TEST_INBOX,
  keyId=process.env.RAZORPAY_KEY_ID, gatewaySecret=process.env.RAZORPAY_KEY_SECRET,
  sendMail=createBrevoTransport()
}={}) {
  const enabled=origin===stagingOrigin && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'') &&
    key && /^[a-f0-9]{64}$/.test(storeToken||'') && /^[a-f0-9]{64}$/.test(workerToken||'') &&
    (mode==='preview'||(mode==='test-inbox'&&allowEmail));
  const send=(res,status,data)=>{
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'});
    res.end(JSON.stringify(data)); return true;
  };
  async function rpc(name, token, payload) {
    const response=await fetchImpl(url+'/rest/v1/rpc/'+name,{
      method:'POST',headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(6000)
    });
    if(!response.ok)throw Error('Checkout recovery store unavailable');
    return response.json();
  }
  const worker=(action,id,result)=>rpc('navigator_checkout_recovery_worker',null,{
    p_token:workerToken,p_action:action,p_id:id??null,p_result:result??null
  });
  async function gatewaySafe(orders) {
    if(!orders.length)return true;
    if(orders.length>8||!/^rzp_test_[A-Za-z0-9_]+$/.test(keyId||'')||!gatewaySecret)return false;
    const auth='Basic '+Buffer.from(keyId+':'+gatewaySecret).toString('base64');
    return (await Promise.all(orders.map(async id=>{
      if(!/^order_[A-Za-z0-9]{1,40}$/.test(id))return false;
      try{
        const r=await fetchImpl('https://api.razorpay.com/v1/orders/'+id+'/payments',{
          headers:{Authorization:auth},signal:AbortSignal.timeout(6000)
        });
        const data=r.ok?await r.json():null;
        return Array.isArray(data?.items) && data.items.every(p=>p.status==='failed');
      }catch{return false;}
    }))).every(Boolean);
  }
  async function dispatch() {
    const counts={};
    for(let i=0;i<3;i++){
      const next=await worker('claim');
      if(!next?.claim)break;
      let result='ineligible';
      try{
        let job=await worker('authorize',next.claim);
        if(job?.paid)result='paid';
        else if(job){
          if(!await gatewaySafe(job.orders))result='uncertain';
          else {
            // A buyer can opt out or finish while the provider is being checked.
            job=await worker('authorize',next.claim);
            if(job?.paid)result='paid';
            else if(job && Object.hasOwn(products,job.product) && uuid.test(job.unsubscribe)){
              const payload=recoveryMessage(job,origin);
              if(mode==='preview')result='preview';
              else if(job.email.toLowerCase()===allowEmail.toLowerCase()){
                const receipt=await sendMail(payload);
                result=({accepted:'accepted',uncertain:'uncertain',retry_later:'retry',rejected:'rejected'})[receipt.state]||'ineligible';
              }
            }
          }
        }
      }catch{result='uncertain';}
      await worker('finish',next.claim,result);
      counts[result]=(counts[result]||0)+1;
    }
    return counts;
  }
  return async(req,res,parsed)=>{
    const route=parsed.pathname;
    if(!route.startsWith('/api/checkout-recovery/'))return false;
    if(req.method==='GET'&&route==='/api/checkout-recovery/config')return send(res,200,{enabled:Boolean(enabled),preview:mode==='preview',livePaymentsEnabled:false});
    if(!enabled)return send(res,503,{error:'Checkout reminders are unavailable.'});
    if(req.method!=='POST')return send(res,405,{error:'Method not allowed.'});
    try{
      if(route==='/api/checkout-recovery/dispatch'){
        const supplied=req.headers.authorization||'';
        const expected='Bearer '+workerToken;
        const authorized=Buffer.byteLength(supplied)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));
        const ticket=req.headers['x-navigator-dispatch'];
        if(!authorized && (!uuid.test(ticket)||await rpc('navigator_claim_checkout_dispatch',null,{p_token:workerToken,p_ticket:ticket})!==true))
          return send(res,403,{error:'Not permitted.'});
        return send(res,200,{results:await dispatch()});
      }
      if(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return send(res,403,{error:'Not permitted.'});
      let body='';
      for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1024)return send(res,413,{error:'Request too large.'});}
      let data;
      try{data=JSON.parse(body);}catch{return send(res,400,{error:'Invalid request.'});}
      if(!data||Array.isArray(data)||typeof data!=='object')return send(res,400,{error:'Invalid request.'});
      const action=route.split('/').at(-1);
      if(action==='unsubscribe'){
        if(!uuid.test(data.token)||Object.keys(data).length!==1)return send(res,400,{error:'Use the link from your reminder.'});
        await worker('unsubscribe',data.token);
        return send(res,200,{stopped:true});
      }
      const keys={begin:['product','optIn'],failed:['product','attempt'],stop:['product']}[action];
      if(!keys||!Object.hasOwn(products,data.product)||Object.keys(data).some(k=>!keys.includes(k))||
        (action==='begin'&&typeof data.optIn!=='boolean')||(action==='failed'&&!uuid.test(data.attempt)))return send(res,400,{error:'Invalid checkout reminder request.'});
      const buyer=await identify(req,res);
      if(!buyer)return send(res,401,{error:'Sign in to save your test checkout.'});
      const result=await rpc('navigator_checkout_recovery',buyer.accessToken,{
        p_token:storeToken,p_product:data.product,p_action:action,p_opt_in:data.optIn??null,p_attempt:data.attempt??null
      });
      return send(res,200,result);
    }catch{return send(res,503,{error:'Checkout recovery is temporarily unavailable.'});}
  };
}
module.exports={createRecovery,recoveryMessage};

