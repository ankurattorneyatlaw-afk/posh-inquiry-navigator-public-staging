'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createShopHandler,catalogue}=require('./shop-api.cjs'),{productReader}=require('./product-assets.cjs');
async function fixture(fn,options={}){let clock=1_800_000_000_000;const handler=createShopHandler({origin:'https://test.navigator',identify:async req=>req.headers['x-test-account']?{id:req.headers['x-test-account']}:null,now:()=>clock,readAsset:name=>name.endsWith('.pdf')?Buffer.from('%PDF-fixture'):Buffer.from(JSON.stringify({aggrieved:{title:'Woman fixture',steps:[],drafts:{}},respondent:{title:'Respondent fixture',steps:[],drafts:{}}})),...options});const s=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://test'))){res.writeHead(404);res.end();}});await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;const call=async(route,data,account='A',extra={})=>{const r=await fetch(url+'/api/shop/'+route,{method:data===undefined?'GET':'POST',headers:{'x-test-account':account,Origin:'https://test.navigator','Content-Type':'application/json',...extra},...(data!==undefined?{body:JSON.stringify(data)}:{})});return {status:r.status,body:r.headers.get('content-type')?.includes('json')?await r.json():await r.text(),headers:r.headers};};try{await fn(call,ms=>clock+=ms);}finally{s.closeAllConnections();await new Promise(r=>s.close(r));}}
const orderBody=product=>({product,testConsent:true,termsVersion:catalogue.termsVersion});

test('durable guide orders can be confirmed and opened after replacing the shop process', async()=>{
 const records=new Map();
 const store=async(buyer,action,params)=>{
  if(action==='create'){
   const order={id:params.p_id,product:params.p_product,termsVersion:params.p_terms_version,account:buyer.id,expires:1_800_000_900_000};
   records.set(order.id,order);
   return order;
  }
  if(action==='access')return [...records.values()].find(order=>order.account===buyer.id&&order.product===params.p_product&&order.until);
  const order=records.get(params.p_id);
  if(order?.account!==buyer.id)return null;
  order.until??=1_807_776_000_000;
  return order;
 };
 const options={store,requireDurable:true,allowLegacyChecklist:false};
 const orders={};
 await fixture(async call=>{
  for(const product of ['aggrieved','respondent']){
   const created=await call('order',orderBody(product));
   assert.equal(created.status,201);
   orders[product]=created.body.orderId;
  }
 },options);
 const receipts={};
 await fixture(async call=>{
  for(const [product,orderId] of Object.entries(orders)){
   const proof={orderId,testConsent:true};
   assert.equal((await call('confirm',proof,'B')).status,400);
   const receipt=await call('confirm',proof);
   assert.equal(receipt.status,200);
   assert.equal(receipt.body.product,product);
   assert.equal(receipt.body.charged,0);
   receipts[product]=receipt.body;
  }
 },options);
 await fixture(async call=>{
  for(const [product,orderId] of Object.entries(orders)){
   const session=await call('session?product='+product);
   assert.equal(session.body.until,receipts[product].testAccessUntil);
   assert.equal((await call('content?product='+product)).status,200);
   assert.equal((await call('content?product='+product,undefined,'B')).status,403);
   assert.deepEqual((await call('confirm',{orderId,testConsent:true})).body,receipts[product]);
  }
 },options);
});

test('staging requires its durable store and fails closed during a store outage',async()=>{
 for(const store of [null,async()=>{throw Error('fixture outage');}]){
  await fixture(async call=>{
   assert.equal((await call('catalogue')).body.livePaymentsEnabled,false);
   assert.equal((await call('order',orderBody('aggrieved'))).status,503);
   assert.equal((await call('session?product=aggrieved')).status,503);
   assert.equal((await call('content?product=aggrieved')).status,503);
  },{store,requireDurable:true});
 }
});
test('catalogue is test-only, prices are server-owned and account login is required',()=>fixture(async call=>{const c=await call('catalogue',undefined,'');assert.equal(c.body.livePaymentsEnabled,false);assert.deepEqual(c.body.products.map(x=>x.amount),[99900,199900,199900]);assert.equal((await call('order',orderBody('checklist'),'')).status,401);for(const extra of [{amount:1},{caseDetails:'private'},{role:'admin'}])assert.equal((await call('order',{...orderBody('checklist'),...extra})).status,400);assert.equal((await call('order',{...orderBody('checklist'),testConsent:false})).status,400);assert.equal((await call('order',{...orderBody('checklist'),termsVersion:'old'})).status,400);}));
test('orders are account/product bound, idempotent and cannot grant Committee access',()=>fixture(async call=>{for(const product of ['checklist','aggrieved','respondent']){const o=await call('order',orderBody(product));assert.equal(o.status,201);const confirm={orderId:o.body.orderId,testConsent:true};assert.equal((await call('confirm',confirm,'B')).status,400);const f=await call('confirm',confirm);assert.equal(f.status,200);assert.equal(f.body.charged,0);assert.equal(f.body.serviceActivated,false);assert.equal(f.body.coreInquiryAccessGranted,false);assert.deepEqual((await call('confirm',confirm)).body,f.body);assert.equal((await call('session?product='+product)).body.hasTestAccess,true);assert.equal((await call('session?product='+product,undefined,'B')).body.hasTestAccess,false);}assert.equal((await call('download?product=checklist')).body,'%PDF-fixture');assert.equal((await call('content?product=respondent')).body.title,'Respondent fixture');}));
test('matching product, verified account and correct content endpoint required',()=>fixture(async call=>{assert.equal((await call('content?product=respondent',undefined,'')).status,401);assert.equal((await call('download?product=checklist')).status,403);const o=await call('order',orderBody('aggrieved'));await call('confirm',{orderId:o.body.orderId,testConsent:true});assert.equal((await call('content?product=respondent')).status,403);assert.equal((await call('download?product=checklist')).status,403);assert.equal((await call('content?product=aggrieved',undefined,'B')).status,403);assert.equal((await call('download?product=aggrieved')).status,400);assert.match((await call('content?product=aggrieved')).headers.get('cache-control'),/no-store/);}));
test('expired orders and access fail closed; reactivation does not affect other products',()=>fixture(async(call,advance)=>{const o=await call('order',orderBody('checklist'));advance(900001);assert.equal((await call('confirm',{orderId:o.body.orderId,testConsent:true})).status,400);const a=await call('order',orderBody('respondent'));await call('confirm',{orderId:a.body.orderId,testConsent:true});advance(90*86400000+1);assert.equal((await call('session?product=respondent')).body.hasTestAccess,false);assert.equal((await call('content?product=respondent')).status,403);assert.equal((await call('confirm',{orderId:a.body.orderId,testConsent:true})).status,400);}));
test('cross-origin, wrong methods, oversized bodies and rate floods rejected',()=>fixture(async call=>{assert.equal((await call('order',orderBody('checklist'),'A',{Origin:'https://evil.example'})).status,403);assert.equal((await call('order')).status,405);assert.equal((await call('order',{...orderBody('checklist'),padding:'x'.repeat(2200)})).status,413);assert.equal((await call('unknown')).status,404);for(let i=0;i<41;i++){const r=await call('order',orderBody('checklist'),'R');if(i===40)assert.equal(r.status,429);}}));
test('missing delivery configuration cannot create a successful order',()=>fixture(async call=>{assert.equal((await call('order',orderBody('checklist'))).status,503);},{readAsset:()=>{throw Error('missing key');}}));
test('encrypted delivery checks key, file name, integrity and per-file binding',()=>{const folder=fs.mkdtempSync(path.join(os.tmpdir(),'navigator-products-')),key=crypto.randomBytes(32).toString('hex'),name='individual-guides.json',iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);cipher.setAAD(Buffer.from(name));const encrypted=Buffer.concat([cipher.update('secret fixture'),cipher.final()]),data=Buffer.concat([Buffer.from('NVP1'),iv,cipher.getAuthTag(),encrypted]);try{fs.writeFileSync(path.join(folder,name+'.enc'),data);const read=productReader({folder,key});assert.equal(read(name).toString(),'secret fixture');assert.throws(()=>read('../asset-key.secret'));assert.throws(()=>productReader({folder,key:'0'.repeat(64)})(name));data[data.length-1]^=1;fs.writeFileSync(path.join(folder,name+'.enc'),data);assert.throws(()=>read(name));}finally{fs.rmSync(folder,{recursive:true});}});
