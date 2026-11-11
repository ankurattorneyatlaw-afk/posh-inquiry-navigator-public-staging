'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {tier,annualCommission,reconciliation,eligibleOrder,payoutReady}=require('./partner-commission.cjs');
const {validate}=require('./partner-api.cjs');
test('20/25/30 retroactive yearly commission uses integer paise',()=>{
 assert.equal(tier(49999999n),20);assert.equal(tier(50000000n),25);
 assert.equal(tier(99999999n),25);assert.equal(tier(100000000n),30);
 assert.equal(annualCommission(50000000n),12500000n);
 assert.equal(annualCommission(100000000n),30000000n);
 assert.equal(reconciliation(50000000n,10000000n),2500000n);
 assert.equal(reconciliation(100000000n,30000000n),0n);
 assert.equal(reconciliation(40000000n,10000000n),-2000000n);
});
test('no commission on unverified purchases, legal services, self referrals or public procurement',()=>{
 const base={product:'checklist',currency:'INR',paymentCaptured:true,paymentSignatureVerified:true,uniqueGatewayOrder:true,referralAcceptedBeforePurchase:true,partnerApproved:true,agreementActive:true,newCustomer:true,withinTwelveMonths:true,refundWindowCleared:true,noRefundOrChargeback:true,noConflict:true,notSelfReferral:true,notGovernmentProcurement:true,netExclusiveTaxPaise:100000};
 assert.equal(eligibleOrder(base),true);
 for(const patch of [{product:'legal_consultation'},{paymentSignatureVerified:false},{notSelfReferral:false},{noConflict:false},{notGovernmentProcurement:false},{noRefundOrChargeback:false},{referralAcceptedBeforePurchase:false}])assert.equal(eligibleOrder({...base,...patch}),false);
});
test('payout requires independent dual review, KYC and >= Rs 2000',()=>{
 const base={partnerActive:true,agreementSigned:true,kycVerified:true,bankVerified:true,taxReviewed:true,invoiceReviewed:true,financeApproverOne:'finance-a',financeApproverTwo:'finance-b',noFraudHold:true,saleMaturityVerified:true,availablePaise:200000n};
 assert.equal(payoutReady(base),true);
 for(const patch of [{availablePaise:199999n},{financeApproverTwo:'finance-a'},{kycVerified:false},{bankVerified:false},{saleMaturityVerified:false},{noFraudHold:false}])assert.equal(payoutReady({...base,...patch}),false);
});
test('partner applications accept only small business data with explicit opt-in',()=>{
 const valid={contact_name:'Sample Partner',email:'p@example.invalid',organisation:'Example',role:'Corporate trainer / educator',region:'Haryana',channel:'Professional network',experience:'Exploring',consent:true,independence_confirmed:true,website:'',challenge:'demo'};
 assert.equal(validate(valid).email,'p@example.invalid');
 assert.throws(()=>validate({...valid,website:'spambot.test'}));
 assert.throws(()=>validate({...valid,consent:false}));
 assert.throws(()=>validate({...valid,caseDetails:'Sensitive'}));
});
