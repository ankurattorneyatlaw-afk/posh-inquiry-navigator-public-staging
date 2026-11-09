
(function(){
  'use strict';
  async function post(action,data){
    const r=await fetch('/api/checkout-recovery/'+action,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(data),signal:AbortSignal.timeout(10000)
    });
    const value=await r.json();
    if(!r.ok)throw Error(value.error||'Checkout reminders are unavailable.');
    return value;
  }
  function checkout(product){
    const panel=document.getElementById('checkout-recovery');
    const input=document.getElementById('checkout-recovery-opt-in');
    const status=document.getElementById('checkout-recovery-status');
    let attempt, savedOptIn;
    const config=fetch('/api/checkout-recovery/config',{signal:AbortSignal.timeout(7000)})
      .then(r=>r.ok?r.json():{}).catch(()=>({}));
    document.getElementById('checkout-recovery-stop').onclick=async()=>{
      try{
        await post('stop',{product});
        input.checked=false;
        savedOptIn=false;
        status.textContent='Checkout reminders stopped for this product.';
      }catch(error){status.textContent=error.message;}
    };
    return {
      async show(){
        const settings=await config;
        panel.hidden=!settings.enabled;
        if(settings.preview)status.textContent='Staging previews reminders without emailing buyers.';
      },
      async begin({resume=false}={}){
        if(!(await config).enabled || (resume && (attempt ? savedOptIn===input.checked : !input.checked)))return;
        const value=await post('begin',{product,optIn:input.checked});
        attempt=value.attempt;
        savedOptIn=input.checked;
        status.textContent=input.checked?'Reminder preference saved for this test checkout.':'Test checkout saved.';
      },
      async failed(){
        if(attempt)try{await post('failed',{product,attempt});}catch{}
      },
      hide(){panel.hidden=true;}
    };
  }
  const stop=document.getElementById('checkout-reminders-unsubscribe');
  if(stop){
    const token=location.hash.slice(1);
    const status=document.getElementById('checkout-reminders-status');
    history.replaceState(null,'',location.pathname);
    if(!/^[a-f0-9-]{36}$/i.test(token)){
      stop.disabled=true;
      status.textContent='Open the stop link from your checkout reminder.';
    }
    stop.onclick=async()=>{
      stop.disabled=true;
      try{await post('unsubscribe',{token});status.textContent='Checkout reminders stopped.';}
      catch(error){stop.disabled=false;status.textContent=error.message;}
    };
  }
  window.NavigatorCheckoutRecovery={checkout};
})();

