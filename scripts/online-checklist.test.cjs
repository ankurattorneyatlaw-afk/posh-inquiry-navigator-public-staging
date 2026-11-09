
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {readEdition,accessUntil,onlineFromEnvironment}=require('./online-checklist.cjs');
const {createChecklistCheckout,simulatedGateway}=require('./checklist-checkout.cjs');
const origin='https://navigator.example';
const orderId='order_testOnline';
const expiry='2027-03-09T12:00:00.000Z';
function edition(){
  const paragraph=text=>'<w:p><w:r><w:t>'+text+'</w:t></w:r></w:p>';
  const steps=Array.from({length:6},(_,i)=>{
    const items=Array.from({length:i===5?8:7},(_,j)=>{
      const n=String(i*7+j+1).padStart(2,'0');
      return '<w:p><w:sdt><w:tag w:val="check_'+n+'"/><w14:checkbox></w14:checkbox><w:t>☐</w:t></w:sdt><w:t>'+n+'</w:t><w:t>Sample &amp; check '+n+'</w:t></w:p>';
    }).join('');
    return '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:t>Stage '+i+'</w:t></w:p>'+paragraph('Stage note')+items;
  }).join('');
  return {
    'word/document.xml':paragraph('Excluded front matter')+steps+'<w:p><w:hyperlink r:id="source1"><w:r><w:t>Source</w:t></w:r></w:hyperlink></w:p>',
    'word/_rels/document.xml.rels':'<Relationship Id="source1" Target="https://example.org/path?a=1&amp;b=2"/>'
  };
}

test('the protected Word edition yields six numbered stages and 43 exact checkbox texts',()=>{
  const parts=edition();
  const {stages,sources}=readEdition(parts);
  assert.equal(stages.length,6);
  assert.equal(stages[0].note,'Stage note');
  assert.deepEqual(stages.flatMap(s=>s.items.map(x=>x.number)),Array.from({length:43},(_,i)=>i+1));
  assert.equal(stages[5].items.at(-1).text,'Sample & check 43');
  assert.deepEqual(sources,[{title:'Source',url:'https://example.org/path?a=1&b=2'}]);
  parts['word/document.xml']=parts['word/document.xml'].replace('check_43','check_44');
  assert.throws(()=>readEdition(parts),/order is invalid/);
});

test('access expiry is 120 days from capture, including orders created under Word delivery',()=>{
  assert.equal(accessUntil({captured:true,downloadUntil:'2027-02-07T12:00:00.000Z'}),expiry);
  assert.equal(accessUntil({captured:false,downloadUntil:'2027-02-07T12:00:00.000Z'}),null);
});

test('online entitlement uses the verified buyer token and the purchased edition',async()=>{
  const key='a'.repeat(64);
  const handler=onlineFromEnvironment({
    url:'https://synthetic.supabase.co',key:'publishable-fixture',token:key,
    readAsset:name=>{assert.equal(name,'buyer-checklist-template.json');return Buffer.from(JSON.stringify(edition()));},
    fetchImpl:async(url,req)=>{
      assert(url.endsWith('/rpc/navigator_inquiry_checklist_progress'));
      assert.equal(req.headers.Authorization,'Bearer buyer-token');
      assert.deepEqual(JSON.parse(req.body),{p_token:key,p_id:null});
      return Response.json({active:true,edition:'2.0'});
    }
  });
  assert.deepEqual(await handler.access({accessToken:'buyer-token'},null),{active:true,edition:'2.0'});
  assert.equal(handler.read('2.0').stages.length,6);
  assert.throws(()=>handler.read('3.0'),/edition unavailable/);
});

test('only the verified captured buyer can load content and expired access does not expose check text',async()=>{
  const stages=readEdition(edition()).stages;
  let expired=false, reads=0;
  const order={id:orderId,organisation:'Synthetic Committee',edition:'2.0',accessUntil:expiry};
  const online={access:async(buyer,id)=>buyer.id==='buyer-a'&&(id===null||id===orderId)?{...order,active:!expired}:null,read:()=>{reads++;return {stages,sources:[]};}};
  const handler=createChecklistCheckout({origin,online,identify:async req=>req.account?{id:req.account}:null});
  async function call(path,account){
    const req=Readable.from([]);req.account=account;req.method='GET';req.headers={};
    const result={};
    const res={writeHead(status,headers){Object.assign(result,{status,headers});},end(body){result.body=JSON.parse(body);}};
    await handler(req,res,new URL('/api/checklist/'+path,origin));return result;
  }
  assert.equal((await call('content')).status,401);
  assert.equal((await call('content?order='+orderId,'buyer-b')).status,403);
  assert.equal((await call('content?order=invalid','buyer-a')).status,400);
  assert.equal((await call('download?order='+orderId,'buyer-a')).status,410);
  assert.equal(reads,0);
  const success=await call('content','buyer-a');
  assert.equal(success.status,200);assert.equal(success.body.stages.length,6);
  assert.equal(success.headers['Cache-Control'],'private, no-store');
  expired=true;
  const denied=await call('content?order='+orderId,'buyer-a');
  assert.equal(denied.status,410);assert.equal(denied.body.stages,undefined);assert.equal(reads,1);
});

test('simulated verification saves the order and returns an online link with a 120-day deadline',async()=>{
  const gateway=simulatedGateway();
  const now=Date.parse('2026-11-09T12:00:00Z');
  let order;
  const handler=createChecklistCheckout({origin,gateway,now:()=>now,online:{read:()=>({}),access:async()=>null},
    identify:async()=>({id:'buyer-a'}),
    store:async(buyer,action,mode,data)=>{
      if(action==='create')order={id:data.p_id,organisation:data.p_organisation,captured:false};
      if(action==='capture')order={...order,captured:true,paymentId:data.p_payment,downloadUntil:new Date(now+90*86400000).toISOString()};
      return order;
    }});
  async function post(action,data){
    const req=Readable.from([Buffer.from(JSON.stringify(data))]);req.method='POST';req.headers={origin,'content-type':'application/json'};
    const result={};const res={writeHead(status){result.status=status;},end(body){result.body=JSON.parse(body);}};
    await handler(req,res,new URL('/api/checklist/'+action,origin));return result;
  }
  const created=await post('order',{organisation:'Example',testConsent:true});
  assert.equal(created.status,201);assert.equal(created.body.amount,99900);
  const verified=await post('verify',{orderId:created.body.orderId});
  assert.equal(verified.status,200);assert.equal(verified.body.accessUntil,expiry);
  assert.equal(verified.body.delivery,'/inquiry-checklist.html?order='+created.body.orderId);
  assert.equal(verified.body.downloadUntil,undefined);
});

test('checklist progress writes require a signed-in buyer, an explicit active order, and tick-only values',async()=>{
 const changes=[];
 const online={access:async(buyer,id,change)=>{
   if(buyer.id!=='buyer-a'||id!==orderId)return null;
   if(change)changes.push(change);
   return {id,organisation:'Synthetic Committee',edition:'2.0',active:!expired,accessUntil:expiry,checked:[2,5]};
 },read:()=>({stages:[],sources:[]})};
 let expired=false;
 const handler=createChecklistCheckout({origin,online,identify:async req=>req.account?{id:req.account}:null});
 async function call(path,data,account='buyer-a',from=origin){
   const req=Readable.from(data===undefined?[]:[Buffer.from(JSON.stringify(data))]);
   req.account=account;req.method=data===undefined?'GET':'POST';req.headers={origin:from,'content-type':'application/json'};
   const result={};const res={writeHead(status){result.status=status;},end(body){result.body=JSON.parse(body);}};
   await handler(req,res,new URL('/api/checklist/'+path,origin));return result;
 }
 const path='progress?order='+orderId;
 assert.equal((await call(path,{number:2,checked:true},'')).status,401);
 assert.equal((await call(path,{number:2,checked:true},'buyer-b')).status,403);
 assert.equal((await call(path,{number:2,checked:true},'buyer-a','https://elsewhere.invalid')).status,403);
 assert.equal((await call('progress',{number:2,checked:true})).status,400);
 assert.equal((await call(path,{number:44,checked:true})).status,400);
 assert.equal((await call(path,{number:2,checked:true,note:'case details'})).status,400);
 assert.deepEqual((await call(path,{number:2,checked:false})).body,{checked:[2,5]});
 assert.deepEqual((await call(path,{importChecked:[2,5,2]})).body,{checked:[2,5]});
 assert.deepEqual(changes,[{p_number:2,p_checked:false},{p_import:[2,5]}]);
 assert.deepEqual((await call('content?order='+orderId)).body.checked,[2,5]);
 expired=true;
 const denied=await call(path,{number:2,checked:true});
 assert.equal(denied.status,410);
 assert.equal(denied.body.checked,undefined);
});
