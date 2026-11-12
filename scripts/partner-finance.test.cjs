'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const F=require('./partner-finance.cjs');
const {demo,parseVerifiedWebhook,verifyWebhook,evaluateStatement,payoutGate,yn}=F;
const asOf='2026-11-12T00:00:00Z';
test('starter tier recognises rupee inputs as paise, not GST-inclusive revenue',()=>{
 const s=demo('starter');assert.equal(s.tierPercent,20);assert.equal(s.annualEligibleNetPaise,'30000000');assert.equal(s.targetCommissionPaise,'6000000');assert.equal(s.simulationOnly,true);assert.equal(s.mayPay,false);
});
test('growth at five lakhs retroactively reconciles all eligible sales',()=>{
 const s=demo('growth');assert.equal(s.tierPercent,25);assert.equal(s.annualEligibleNetPaise,'50000000');assert.equal(s.targetCommissionPaise,'12500000');assert.equal(s.trueUpPaise,'2500000');
});
test('elite at ten lakhs retroactively reconciles entire year',()=>{
 const s=demo('elite');assert.equal(s.tierPercent,30);assert.equal(s.annualEligibleNetPaise,'100000000');assert.equal(s.targetCommissionPaise,'30000000');assert.equal(s.trueUpPaise,'5000000');
});
test('partial verified refund causes downgrade and negative recoverable carry',()=>{
 const s=demo('refund_downgrade');assert.equal(s.annualEligibleNetPaise,'40000000');assert.equal(s.tierPercent,20);assert.equal(s.targetCommissionPaise,'8000000');assert.equal(s.trueUpPaise,'-7000000');assert.equal(s.negativeCarryForwardPaise,'7000000');
});
test('45 days from later of settlement or delivery holds sales',()=>{const s=demo('on_hold');assert.equal(s.annualEligibleNetPaise,'0');assert.equal(s.heldNetPaise,'20000000');assert.equal(s.targetCommissionPaise,'0');});
test('conflicted or excluded orders never count',()=>{const s=demo('fraud_blocked');assert.equal(s.annualEligibleNetPaise,'0');assert.equal(s.blockedOrderCount,1);});
test('India financial year uses April 1 IST, not UTC',()=>{assert.equal(yn(Date.parse('2027-03-31T17:00:00Z')),2026);assert.equal(yn(Date.parse('2027-03-31T19:00:00Z')),2027);});
test('year-boundary scenario keeps prior year sales out of next year',()=>{const s=demo('fiscal_year');assert.equal(s.financialYear,2027);assert.equal(s.annualEligibleNetPaise,'30000000');});
test('reject refund without independent gateway verification and impossible over-refunds',()=>{
 const fixture=F.scenarios.refund_downgrade();
 assert.throws(()=>evaluateStatement({...fixture,asOf,refunds:fixture.refunds.map(x=>({...x,gatewayRefundVerified:false}))}),/Unverified/);
 assert.throws(()=>evaluateStatement({...fixture,asOf,refunds:fixture.refunds.map(x=>({...x,netRefundExclusiveTaxPaise:70000000}))}),/Refund exceeds/);
});
test('duplicate event ids are idempotent and double-orders fail',()=>{
 const fixture=F.scenarios.starter();
 assert.equal(evaluateStatement({...fixture,asOf,orders:fixture.orders.concat(fixture.orders)}).eligibleOrderCount,1);
 assert.throws(()=>evaluateStatement({...fixture,asOf,orders:[fixture.orders[0],{...fixture.orders[0],eventId:'evt_demo_other'}]}),/Duplicate or invalid order/);
});
test('all approval, KYC, tax, independent preparer and beneficiary gates required',()=>{
 const base={preparedBy:'finance-preparer',firstApprover:'finance-reviewer-1',secondApprover:'finance-reviewer-2',partnerKyc:true,bankVerified:true,taxSignoff:true,invoiceVerified:true,holdCleared:true,noDisputes:true,availablePaise:200000,settlementMatched:true};
 assert.equal(payoutGate(base),true);
 for(const update of [
  {firstApprover:'finance-preparer'},{secondApprover:'finance-reviewer-1'},
  {partnerKyc:false},{bankVerified:false},{taxSignoff:false},{invoiceVerified:false},
  {holdCleared:false},{noDisputes:false},{settlementMatched:false},{availablePaise:199999}
 ])assert.equal(payoutGate({...base,...update}),false,JSON.stringify(update));
});
test('webhook HMAC authenticates raw bytes only and rejects tampering',()=>{
 const raw=Buffer.from(JSON.stringify({entity:'event',event:'payment.captured',payload:{payment:{entity:{id:'pay_12345678',amount:50000,currency:'INR'}}}}));
 const secret='long-staging-synthetic-webhook-secret';
 const signature=createHmac('sha256',secret).update(raw).digest('hex');
 assert.equal(verifyWebhook(raw,signature,secret),true);
 assert.equal(verifyWebhook(Buffer.from(raw.toString()+' '),signature,secret),false);
 assert.equal(verifyWebhook(raw,'0'.repeat(64),secret),false);
 assert.equal(verifyWebhook(raw,signature,'wrong-secret'),false);
 const x=parseVerifiedWebhook(raw,signature,secret,'evt_real_format_123');
 assert.equal(x.eventId,'evt_real_format_123');assert.equal(x.commissionPosted,false);assert.equal(x.requiresIndependentSettlementCheck,true);
 assert.throws(()=>parseVerifiedWebhook(raw,signature,secret,'short'),/event id/);
});
test('unknown or forged payment event rejected even when signed with a test secret',()=>{
 const secret='long-staging-synthetic-webhook-secret';
 const payload=Buffer.from(JSON.stringify({entity:'event',event:'payment.authorized',payload:{payment:{entity:{id:'pay_12345678',amount:50000,currency:'INR'}}}}));
 const sig=createHmac('sha256',secret).update(payload).digest('hex');
 assert.throws(()=>parseVerifiedWebhook(payload,sig,secret,'evt_1234567'),/Unsupported/);
});
test('invalid monetary inputs or impossible dates cannot be simulated',()=>{
 assert.throws(()=>F.money(-1),/Invalid/);assert.throws(()=>F.money(1.1),/Invalid/);assert.throws(()=>F.money(Number.MAX_SAFE_INTEGER),/Invalid/);
 assert.throws(()=>evaluateStatement({asOf:'2026-02-30T00:00:00Z'}),/Invalid/);
 assert.throws(()=>demo('unknown'),/Unknown/);
});
