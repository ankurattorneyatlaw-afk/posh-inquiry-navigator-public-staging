'use strict';
const {randomUUID,createHmac,randomBytes}=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const catalogue=require('../dist/products.js'),{clientNetwork}=require('./request-guards.cjs');
function createShopHandler({identify=async()=>null,origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',now=Date.now,folder=path.join(__dirname,'../products'),assetKey=process.env.NAVIGATOR_PRODUCT_ASSET_KEY,readAsset=require('./product-assets.cjs').productReader({folder,key:assetKey})}={}){
 const orders=new Map(),access=new Map(),rates=new Map(),salt=randomBytes(32);let reset=now()+3600000;
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const product=id=>catalogue.products.find(p=>p.id===id);
 const entry=(id,p)=>{const e=access.get(id+'|'+p);return e&&e.until>now()?e:null;};
 const destination=p=>p.kind==='download'?'/api/shop/download?product=checklist':'/individual-guide.html?product='+p.id;
 const fulfilment=(o,p)=>({mode:'test',status:'test_fulfilled',charged:0,realPaymentsEnabled:false,serviceActivated:false,coreInquiryAccessGranted:false,orderId:o.id,product:p.id,name:p.name,catalogueAmount:p.amount,currency:'INR',termsVersion:o.termsVersion,delivery:destination(p),testAccessUntil:new Date(o.until).toISOString(),message:'Test order complete. No charge, tax invoice or real subscription was created. Test access is temporary and may reset after a service restart.'});
 return async function(req,res,url){if(!url.pathname.startsWith('/api/shop/'))return false;
  const p=product(url.searchParams.get('product'));
  try{
   if(req.method==='GET'&&url.pathname==='/api/shop/catalogue'){send(res,200,catalogue);return true;}
   if(!['/api/shop/session','/api/shop/content','/api/shop/download','/api/shop/order','/api/shop/confirm'].includes(url.pathname)){send(res,404,{error:'This shop action is unavailable.'});return true;}
   if((['/api/shop/order','/api/shop/confirm'].includes(url.pathname)&&req.method!=='POST')||(!['/api/shop/order','/api/shop/confirm'].includes(url.pathname)&&req.method!=='GET')){send(res,405,{error:'Method not allowed.'});return true;}
   if(req.method==='POST'&&(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))){send(res,403,{error:'Use Navigator test checkout.'});return true;}
   const buyer=await identify(req,res);
   if(url.pathname==='/api/shop/session'){if(!p){send(res,400,{error:'Choose a listed product.'});return true;}const active=buyer&&entry(buyer.id,p.id);send(res,200,{signedIn:!!buyer,hasTestAccess:!!active,mode:'test',realPaymentsEnabled:false,delivery:active?destination(p):null,until:active?new Date(active.until).toISOString():null});return true;}
   if(!buyer){send(res,401,{error:'Sign in to continue. No payment has been taken.'});return true;}
   if(['/api/shop/content','/api/shop/download'].includes(url.pathname)){
    if(!p||!entry(buyer.id,p.id)){send(res,403,{error:'Complete test checkout for this product to open it. Your recovery file stays on your device.'});return true;}
    if(url.pathname==='/api/shop/content'){if(p.kind!=='guide'){send(res,400,{error:'This product is a PDF download.'});return true;}const content=JSON.parse(readAsset('individual-guides.json').toString('utf8'))[p.id];send(res,200,{product:p.id,edition:p.edition,...content});return true;}
    if(p.id!=='checklist'){send(res,400,{error:'Choose the checklist for PDF delivery.'});return true;}const pdf=readAsset('inquiry-checklist-v1.pdf');res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="POSH-Inquiry-Checklist-v1.pdf"','Cache-Control':'private, no-store'});res.end(pdf);return true;
   }
   if(now()>reset){rates.clear();reset=now()+3600000;}const network=createHmac('sha256',salt).update(clientNetwork(req)).digest('hex'),key=buyer.id+'|'+network;rates.set(key,(rates.get(key)||0)+1);if(rates.get(key)>40){res.setHeader('Retry-After','3600');send(res,429,{error:'Test checkout limit reached. Try again later.'});return true;}
   let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>2048){send(res,413,{error:'Request too large. Never send case details.'});return true;}chunks.push(c);}let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{send(res,400,{error:'Invalid test order.'});return true;}
   const keys=url.pathname==='/api/shop/order'?['product','testConsent','termsVersion']:['orderId','testConsent'];if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!keys.includes(k))||data.testConsent!==true){send(res,400,{error:'Confirm test mode and use only the listed checkout fields. No case information is accepted.'});return true;}
   for(const [id,o]of orders)if((o.expires<now()&&!o.until)||(o.until&&o.until<=now()))orders.delete(id);for(const [k,e]of access)if(e.until<now())access.delete(k);
   if(url.pathname==='/api/shop/order'){
    const chosen=product(data.product);if(!chosen||data.termsVersion!==catalogue.termsVersion){send(res,400,{error:'Review the current product scope and terms.'});return true;}if(orders.size>=1000||access.size>=1000){send(res,503,{error:'Test checkout capacity reached. No payment was taken.'});return true;}
    readAsset(chosen.kind==='download'?'inquiry-checklist-v1.pdf':'individual-guides.json');const id='NAVTEST-'+randomUUID(),o={id,account:buyer.id,product:chosen.id,amount:chosen.amount,termsVersion:catalogue.termsVersion,expires:now()+900000};orders.set(id,o);send(res,201,{mode:'test',charged:0,orderId:id,product:chosen.id,name:chosen.name,catalogueAmount:chosen.amount,currency:'INR',termsVersion:o.termsVersion,expires:new Date(o.expires).toISOString()});return true;
   }
   const o=orders.get(data.orderId);if(!o||o.account!==buyer.id||(!o.until&&o.expires<now())){send(res,400,{error:'This test order is unavailable or expired. Start test checkout again.'});return true;}const chosen=product(o.product);if(o.until&&o.until<=now()){send(res,400,{error:'Test access expired. Start test checkout again.'});return true;}if(!o.until){o.until=now()+chosen.accessDays*86400000;access.set(buyer.id+'|'+o.product,{until:o.until,order:o.id});}send(res,200,fulfilment(o,chosen));return true;
  }catch{send(res,503,{error:'Access or checkout could not be verified. Keep any guide tab open; save its local recovery file. No real payment is taken.'});return true;}
 };
}
module.exports={createShopHandler,catalogue};
