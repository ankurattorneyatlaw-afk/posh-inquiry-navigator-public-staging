'use strict';
// Financial-control engine. Staging simulation only; does not create credits or transfer money.
const {createHmac,timingSafeEqual}=require('node:crypto');
const {eligibleProducts}=require('./partner-commission.cjs');
const DAY=86400000,MIN_HOLD_DAYS=45,MAX=1000000000000n;
function money(value,label='amount'){
 if((typeof value!=='bigint'&&(!Number.isSafeInteger(value)||value<0))||typeof value==='boolean')
   throw Error('Invalid '+label);
 const n=BigInt(value);
 if(n<0n||n>MAX)throw Error('Invalid '+label);
 return n;
}
function stamp(value,label){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value))throw Error('Invalid '+label);
 const d=Date.parse(value);if(!Number.isFinite(d)||new Date(d).toISOString().slice(0,19)!==value.slice(0,19))throw Error('Invalid '+label);return d;
}
const yn=(timestamp)=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit'}).formatToParts(new Date(timestamp)).map(x=>[x.type,x.value]));return Number(p.year)-(Number(p.month)<4?1:0)};
const tier=n=>n>=100000000n?30:n>=50000000n?25:20;
const roundRate=(amount,percent)=>(money(amount)*BigInt(percent)+50n)/100n;
function eligible(o){
 return !!(o&&eligibleProducts.has(o.product)&&o.gatewayMode==='live'&&o.currency==='INR'&&o.paymentSignatureVerified===true&&o.gatewayCaptureVerified===true&&o.gatewaySettlementVerified===true&&o.deliveryVerified===true&&o.partnerApprovedAtSale===true&&o.agreementActiveAtSale===true&&o.buyerConfirmedReferralBeforePurchase===true&&o.firstTwelveMonths===true&&o.notSelfReferral===true&&o.noConflict===true&&o.notGovernmentProcurement===true&&o.uniqueOrder===true);
}
function evaluateStatement({orders=[],refunds=[],asOf='2026-11-12T00:00:00Z',financialYear,priorCreditedPaise=0}={}){
 if(!Array.isArray(orders)||!Array.isArray(refunds)||orders.length>250||refunds.length>250)throw Error('Invalid transaction batch');
 const cutoff=stamp(asOf,'as-of date'),year=financialYear===undefined?yn(cutoff):financialYear;
 if(!Number.isSafeInteger(year)||year<2026||year>2100)throw Error('Invalid financial year');
 const credited=money(priorCreditedPaise,'previous credits');
 const seenEvents=new Map(),seenOrders=new Set(),indexed=new Map();
 function unique(id,description){if(typeof id!=='string'||!/^[_A-Za-z0-9:-]{6,120}$/.test(id))throw Error('Invalid '+description);if(seenEvents.has(id))return false;seenEvents.set(id,description);return true}
 let blocked=0,held=0n,matured=0n,refundTotal=0n,eligibleOrderCount=0,heldOrderCount=0;
 for(const o of orders){
  if(!o||typeof o!=='object'||Array.isArray(o))throw Error('Invalid order');
  if(!unique(o.eventId,'order event'))continue;
  if(typeof o.orderId!=='string'||!/^[_A-Za-z0-9:-]{6,120}$/.test(o.orderId)||seenOrders.has(o.orderId))throw Error('Duplicate or invalid order');
  seenOrders.add(o.orderId);
  const amount=money(o.netExclusiveTaxPaise,'tax-exclusive sale');
  const capture=stamp(o.capturedAt,'capture timestamp'),settlement=stamp(o.settledAt,'settlement timestamp'),delivery=stamp(o.deliveredAt,'delivery timestamp');
  if(settlement<capture||settlement>cutoff||delivery>cutoff)throw Error('Unverified transaction timing');
  indexed.set(o.orderId,{o,amount,capture,settlement,delivery,year:yn(capture),refund:0n});
 }
 for(const r of refunds){
  if(!r||typeof r!=='object'||Array.isArray(r))throw Error('Invalid refund');
  if(!unique(r.eventId,'refund event'))continue;
  if(!indexed.has(r.orderId))throw Error('Refund lacks a matched sale');
  const record=indexed.get(r.orderId);
  if(r.gatewayRefundVerified!==true)throw Error('Unverified refund event');
  const at=stamp(r.refundedAt,'refund date');if(at<record.capture||at>cutoff)throw Error('Invalid refund timing');
  const amount=money(r.netRefundExclusiveTaxPaise,'tax-exclusive refund');
  record.refund+=amount;
  if(record.refund>record.amount)throw Error('Refund exceeds original eligible sale');
 }
 for(const entry of indexed.values()){
  if(entry.year!==year)continue;
  if(!eligible(entry.o)||entry.amount===0n){blocked++;continue}
  const net=entry.amount-entry.refund;
  refundTotal+=entry.refund;
  if(cutoff<Math.max(entry.settlement,entry.delivery)+MIN_HOLD_DAYS*DAY){held+=net;heldOrderCount++;continue}
  matured+=net;eligibleOrderCount++;
 }
 const rate=tier(matured);
 const target=roundRate(matured,rate);
 const adjustment=target-credited;
 const amountForRelease=adjustment>0n?adjustment:0n;
 return {
  financialYear:year,annualEligibleNetPaise:matured.toString(),heldNetPaise:held.toString(),
  verifiedRefundNetPaise:refundTotal.toString(),eligibleOrderCount,heldOrderCount,blockedOrderCount:blocked,
  tierPercent:rate,targetCommissionPaise:target.toString(),
  priorCreditedPaise:credited.toString(),trueUpPaise:adjustment.toString(),
  additionalCreditPaise:amountForRelease.toString(),negativeCarryForwardPaise:(adjustment<0n?-adjustment:0n).toString(),
  minimumHoldDays:MIN_HOLD_DAYS,simulationOnly:true,mayPay:false
 };
}
function payoutGate({preparedBy,firstApprover,secondApprover,partnerKyc,bankVerified,taxSignoff,invoiceVerified,holdCleared,noDisputes,availablePaise,settlementMatched}={}){
 const ids=[preparedBy,firstApprover,secondApprover];
 return ids.every(x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{3,64}$/.test(x))&&
 new Set(ids).size===3&&partnerKyc===true&&bankVerified===true&&taxSignoff===true&&invoiceVerified===true&&holdCleared===true&&noDisputes===true&&settlementMatched===true&&money(availablePaise||0)>=200000n;
}
function verifyWebhook(raw,signature,secret){
 if(!Buffer.isBuffer(raw)||raw.length<2||raw.length>131072||typeof secret!=='string'||secret.length<20||typeof signature!=='string'||!/^[0-9a-f]{64}$/i.test(signature))return false;
 const computed=createHmac('sha256',secret).update(raw).digest();
 const provided=Buffer.from(signature,'hex');
 return provided.length===computed.length&&timingSafeEqual(computed,provided);
}
function parseVerifiedWebhook(raw,signature,secret,eventId){
 if(!verifyWebhook(raw,signature,secret))throw Error('Webhook authentication failed');
 if(typeof eventId!=='string'||!/^[_A-Za-z0-9:-]{6,120}$/.test(eventId))throw Error('Invalid webhook event id');
 const d=JSON.parse(raw.toString('utf8'));
 if(d.entity!=='event'||!['payment.captured','payment.refunded','refund.processed','settlement.processed'].includes(d.event))throw Error('Unsupported webhook event');
 const e=d.payload?.payment?.entity||d.payload?.refund?.entity||d.payload?.settlement?.entity;
 if(!e||typeof e!=='object'||typeof e.id!=='string')throw Error('Invalid webhook content');
 return {eventId,type:d.event,entityId:e.id,currency:e.currency||null,
   receivedAmountPaise:Number.isSafeInteger(e.amount)&&e.amount>=0?e.amount:null,
   requiresIndependentSettlementCheck:true,commissionPosted:false};
}
// Fixed synthetic inputs: no customer or partner identifiers, no real event ingestion.
function sampleOrder(suffix,rupees,capturedAt,settledAt=capturedAt,deliveredAt=capturedAt,extra={}){
 return {eventId:'evt_demo_'+suffix,orderId:'order_demo_'+suffix,product:'checklist',currency:'INR',
  gatewayMode:'live',netExclusiveTaxPaise:rupees*100,capturedAt,settledAt,deliveredAt,
  paymentSignatureVerified:true,gatewayCaptureVerified:true,gatewaySettlementVerified:true,
  deliveryVerified:true,partnerApprovedAtSale:true,agreementActiveAtSale:true,
  buyerConfirmedReferralBeforePurchase:true,firstTwelveMonths:true,notSelfReferral:true,
  noConflict:true,notGovernmentProcurement:true,uniqueOrder:true,...extra};
}
const date='2026-05-01T10:00:00Z',asOf='2026-11-12T00:00:00Z';
const scenarios={
 starter:()=>({orders:[sampleOrder('starter',300000,date)],priorCreditedPaise:0}),
 growth:()=>({orders:[sampleOrder('growth_a',300000,date),sampleOrder('growth_b',200000,'2026-06-01T10:00:00Z')],priorCreditedPaise:10000000}),
 elite:()=>({orders:[sampleOrder('elite_a',600000,date),sampleOrder('elite_b',400000,'2026-06-01T10:00:00Z')],priorCreditedPaise:25000000}),
 refund_downgrade:()=>({orders:[sampleOrder('refunded',600000,date)],refunds:[{eventId:'evt_refund_001',orderId:'order_demo_refunded',netRefundExclusiveTaxPaise:20000000,refundedAt:'2026-08-01T10:00:00Z',gatewayRefundVerified:true}],priorCreditedPaise:15000000}),
 on_hold:()=>({orders:[sampleOrder('recent',200000,'2026-11-02T10:00:00Z')]}),
 fraud_blocked:()=>({orders:[sampleOrder('conflicted',300000,date, date,date,{noConflict:false})]}),
 fiscal_year:()=>({orders:[sampleOrder('march',300000,'2027-03-31T20:00:00Z'),sampleOrder('april',300000,'2027-04-01T20:00:00Z')],asOf:'2027-08-01T00:00:00Z',financialYear:2027})
};
function demo(name){if(typeof name!=='string'||!Object.hasOwn(scenarios,name))throw Error('Unknown demonstration scenario');
 return {scenario:name,...evaluateStatement({asOf,...scenarios[name]()})};
}
module.exports={money,tier,roundRate,eligible,yn,evaluateStatement,payoutGate,verifyWebhook,parseVerifiedWebhook,demo,scenarios};
