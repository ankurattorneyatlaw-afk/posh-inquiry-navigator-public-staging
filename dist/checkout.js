(async()=>{
'use strict';
const button=document.getElementById('test-pay');
const status=document.getElementById('checkout-status');
const content=document.getElementById('checkout-plan');
const consent=document.getElementById('test-consent');
const planId=new URLSearchParams(location.search).get('plan');
let proof=null,verifying=false,completed=false,modalOpen=false;

async function api(path,body){
  const response=await fetch('/api/payments/'+path,{
    ...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(25000)
  });
  let data;
  try{data=await response.json();}catch{throw Error('Test checkout is temporarily unavailable.');}
  if(!response.ok)throw Error(data.error||'Test checkout unavailable.');
  return data;
}
function updateButton(){
  button.disabled=completed||verifying||modalOpen||(!proof&&!consent.checked);
  button.textContent=proof&&!completed?'Retry verification for this order':'Open Razorpay test checkout';
}
async function verify(){
  if(!proof||verifying||completed)return;
  verifying=true;
  updateButton();
  status.textContent='Verifying test payment…';
  try{
    const result=await api('verify',proof);
    if(!result.sandboxRoleAssigned){
      status.textContent=result.message+' Retry verification for order '+proof.orderId+'.';
      return;
    }
    completed=true;
    status.textContent=result.message;
    const link=document.createElement('a');
    link.href=result.tools||'/workspace';
    link.className='btn btn-dark';
    link.textContent=result.tools?'Open the activated test plan':'Open workspace and test access';
    status.after(link);
  }catch(error){
    status.textContent=error.message+' Check My workspace or retry verification for order '+proof.orderId+'.';
  }finally{
    verifying=false;
    updateButton();
  }
}
try{
  const config=await api('config');
  const plan=Object.hasOwn(config.plans,planId)?config.plans[planId]:null;
  if(!plan){
    status.textContent='Choose Essential, Professional or Advanced from the plans page. Institutional plans require a proposal.';
    return;
  }
  document.getElementById('plan-checkout-signin').href='/account?plan='+encodeURIComponent(planId);
  const heading=document.createElement('h2');
  heading.textContent=plan.name;
  const details=document.createElement('p');
  const amount=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(plan.amount/100);
  details.textContent='Test amount '+amount+' · '+plan.months+' editing months · '+plan.users+' users including the buyer · '+plan.readOnlyMonths+' more months read-only. One authorised proceeding.';
  const scope=document.createElement('p');
  scope.textContent=plan.scope;
  const list=document.createElement('ul');
  for(const feature of plan.includes){
    const item=document.createElement('li');
    item.textContent=feature;
    list.append(item);
  }
  content.append(heading,details,scope,list);
  if(!config.configured){
    status.textContent='Test checkout is unavailable. No payment can be taken.';
    return;
  }
  updateButton();
  consent.addEventListener('change',updateButton);
  button.addEventListener('click',async()=>{
    if(proof){await verify();return;}
    if(modalOpen||completed||!consent.checked)return;
    modalOpen=true;
    updateButton();
    status.textContent='Creating a test order…';
    try{
      const order=await api('order',{plan:planId,testConsent:true});
      if(!window.Razorpay)await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src='https://checkout.razorpay.com/v1/checkout.js';
        script.onload=resolve;
        script.onerror=()=>reject(Error('Could not load Razorpay test checkout.'));
        document.head.append(script);
      });
      const checkout=new window.Razorpay({
        key:order.keyId,order_id:order.orderId,amount:order.amount,currency:'INR',
        name:'The Cosmic Energizers',description:order.name+' — staging test only',theme:{color:'#102039'},
        handler:async response=>{
          if(proof||completed)return;
          modalOpen=false;
          proof={context:order.context,orderId:response.razorpay_order_id,paymentId:response.razorpay_payment_id,signature:response.razorpay_signature};
          await verify();
        },
        modal:{ondismiss:()=>{
          modalOpen=false;
          if(!proof&&!completed)status.textContent='Test checkout closed. Check My workspace if you already completed a test payment.';
          updateButton();
        }}
      });
      checkout.on('payment.failed',()=>{
        status.textContent='The test payment failed. Retry within Razorpay or close checkout to return.';
      });
      status.textContent='Complete the simulated payment in Razorpay Test Mode.';
      checkout.open();
    }catch(error){
      modalOpen=false;
      status.textContent=error.message;
      updateButton();
    }
  });
}catch(error){status.textContent=error.message;}
})();
