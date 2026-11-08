'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {Readable}=require('node:stream');
const {createHmac}=require('node:crypto');
const {createPaymentHandler,plans}=require('./payment-api.cjs');
const {getPlanTools}=require('./plan-tools.cjs');
const origin='https://posh-inquiry-navigator-staging.onrender.com';

test('each captured staging payment grants only its own tier to the paying account',async()=>{
  const secret='test-fixture';
  let account='buyer-one';
  let status='authorized';
  let counter=0;
  let payment;
  const handler=createPaymentHandler({
    keyId:'rzp_test_fixture',secret,origin,identify:async()=>account?{id:account}:null,
    fetchImpl:async(url,options)=>{
      if(url.endsWith('/orders')){
        const {amount,currency}=JSON.parse(options.body);
        payment={order_id:'order_Test'+(++counter),amount,currency};
        return {ok:true,json:async()=>({id:payment.order_id,amount,currency})};
      }
      return {ok:true,json:async()=>({...payment,id:url.split('/').at(-1),status})};
    }
  });
  async function call(route,data){
    const req=Readable.from([Buffer.from(JSON.stringify(data))]);
    Object.assign(req,{method:'POST',headers:{origin,'content-type':'application/json'}});
    let body;
    await handler(req,{writeHead(){},end(value){body=JSON.parse(value);}},new URL('/api/payments/'+route,origin));
    return body;
  }
  for(const [plan,offer] of Object.entries(plans)){
    status='authorized';
    const {orderId,context,amount}=await call('order',{plan,testConsent:true});
    assert.equal(amount,offer.amount);
    const paymentId='pay_Test'+counter;
    const signature=createHmac('sha256',secret).update(orderId+'|'+paymentId).digest('hex');
    const proof={orderId,context,paymentId,signature};
    assert.equal((await call('verify',proof)).sandboxRoleAssigned,false);
    assert.equal(await handler.toolsPlan({}, {},orderId),null);
    status='captured';
    const confirmation=await call('verify',proof);
    assert.equal(confirmation.serviceActivated,false);
    assert.equal(confirmation.tools,'/plan-tools.html?testOrder='+orderId);
    assert.equal(await handler.toolsPlan({}, {},orderId),plan);
    const tools=getPlanTools(plan);
    assert.ok(tools.toolkit.length);
    assert.equal(tools.reportSections?.length,plan==='essential'?undefined:44);
    assert.equal(tools.readiness?.length,plan==='essential'?undefined:3);
    assert.equal(Boolean(tools.advanced),plan==='advanced');
    account='buyer-two';
    assert.equal(await handler.toolsPlan({}, {},orderId),null);
    account='buyer-one';
  }
});

