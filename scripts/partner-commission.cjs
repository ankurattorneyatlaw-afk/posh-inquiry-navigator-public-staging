'use strict';
/* Integer-paise, gross annual retroactive commission policy. No payment execution. */
const FIVE_LAKH=50000000n,TEN_LAKH=100000000n,MIN_PAYOUT=200000n;
const eligibleProducts=new Set(['checklist','compliance-checklist','aggrieved','respondent','essential','professional','advanced']);
function paise(value){const x=typeof value==='bigint'?value:BigInt(value);if(x<0n)throw Error('Negative amounts not allowed');return x;}
function tier(ytd){const v=paise(ytd);return v>=TEN_LAKH?30:v>=FIVE_LAKH?25:20;}
function annualCommission(annualNetPaise){const n=paise(annualNetPaise);return (n*BigInt(tier(n))+50n)/100n;}
function reconciliation(annualNetPaise,commissionCreditedPaise){const target=annualCommission(annualNetPaise),credited=paise(commissionCreditedPaise);return target-credited;}
function eligibleOrder(o){return !!(o&&eligibleProducts.has(o.product)&&o.currency==='INR'&&
 o.paymentCaptured===true&&o.paymentSignatureVerified===true&&o.uniqueGatewayOrder===true&&
 o.referralAcceptedBeforePurchase===true&&o.partnerApproved===true&&o.agreementActive===true&&
 o.newCustomer===true&&o.withinTwelveMonths===true&&o.refundWindowCleared===true&&
 o.noRefundOrChargeback===true&&o.noConflict===true&&o.notSelfReferral===true&&
 o.notGovernmentProcurement===true&&o.netExclusiveTaxPaise>0);
}
function payoutReady(p){return !!(p&&p.partnerActive===true&&p.agreementSigned===true&&p.kycVerified===true&&
 p.bankVerified===true&&p.taxReviewed===true&&p.invoiceReviewed===true&&p.financeApproverOne===true&&
 p.financeApproverTwo===true&&p.financeApproverOne!==p.financeApproverTwo&&
 p.noFraudHold===true&&p.saleMaturityVerified===true&&paise(p.availablePaise)>=MIN_PAYOUT);}
module.exports={tier,annualCommission,reconciliation,eligibleOrder,payoutReady,MIN_PAYOUT,eligibleProducts};
