(function(){'use strict';const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n/100);let catalogue,selected,order,receipt,busy=false;
async function api(path,data,base='shop'){const r=await fetch('/api/'+base+'/'+path,{credentials:'same-origin',...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(20000)});let d;try{d=await r.json()}catch{throw Error('The service is temporarily unavailable. No real payment has been taken.');}if(!r.ok)throw Error(d.error||'The test request could not be completed.');return d;}
function status(s,error=false){$('shop-status').textContent=s;$('shop-status').className=error?'error':'status';}
async function run(fn){if(busy)return;busy=true;for(const b of document.querySelectorAll('button'))b.disabled=true;try{await fn()}catch(e){status(e.message,true)}finally{busy=false;for(const b of document.querySelectorAll('button'))b.disabled=false;}}
const checklist=(path,data)=>api(path,data,selected.id);
function appendOrderReference(element, reference){
  const segments=String(reference).match(/^[^_]*_|.{1,10}/gu)||[];
  segments.forEach((segment,index)=>{
    if(index)element.append(document.createElement('wbr'));
    element.append(segment);
  });
}
function complete(d){receipt=d;$('shop-order').hidden=true;$('order-review').hidden=true;$('order-complete').hidden=false;$('test-another-checklist').hidden=selected.kind!=='download';const summary=$('complete-summary');summary.replaceChildren();if(d.orderId){summary.append('Test reference ');appendOrderReference(summary,d.orderId);summary.append('. ');}summary.append('Test access is confirmed for '+selected.name+'.');const delivery=$('product-delivery');delivery.hidden=!d.delivery;if(d.delivery)delivery.href=d.delivery;else delivery.removeAttribute('href');$('product-delivery').textContent=selected.kind==='download'?(selected.id==='checklist'?'Download your protected Word checklist':'Download your Word checklist'):'Open your advanced guide';const expiry=$('checklist-download-window');
  expiry.hidden=selected.kind!=='download'||!d.downloadUntil;
  if (!expiry.hidden) {
    const date=new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(d.downloadUntil));
    expiry.textContent=d.delivery?'Redownload before '+date+' IST. Keep your saved Word copy.':'The 90-day redownload period ended on '+date+' IST. Use your saved Word copy.';
  }
  status(d.delivery?'Test access ready. No real payment was taken.':'The Word redownload period has ended.');}
async function downloadChecklist(result){
  const url=new URL(result.delivery,location.origin);
  if(url.origin!==location.origin||url.pathname!=='/api/'+selected.id+'/download'||!/^order_[A-Za-z0-9]{1,40}$/.test(result.orderId||'')||url.searchParams.get('order')!==result.orderId)throw Error('The saved order has an invalid download reference.');
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(response.status===410){complete({...result,delivery:null});return false;}
  if(!response.ok||!response.headers.get('Content-Type')?.includes('wordprocessingml.document'))throw Error('Your test order is saved. If the file did not download, sign in again and use the download link.');
  const file=URL.createObjectURL(await response.blob());
  const link=document.createElement('a');
  link.href=file;link.download=(selected.id==='checklist'?'POSH-Checklist-':'POSH-Compliance-Checklist-')+result.orderId+'.docx';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(file),30000);
  return true;
}
async function verifyChecklist(proof){
  order.proof=proof;
  const result=await checklist('verify',proof);
  complete(result);
  status('Test payment verified and order saved. Preparing your download.');
  if(!result.delivery){status('The 90-day redownload period has ended.');return;}
  if(!await downloadChecklist(result))return;
  status('Test payment verified and order saved. Your Word download has started.');
}
async function launchChecklist(){
  if(order.proof){await verifyChecklist(order.proof);return;}
  if(order.mode==='simulated'){await verifyChecklist({orderId:order.orderId});return;}
  if(!window.Razorpay)await new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';
    script.onload=resolve;script.onerror=()=>reject(Error('Could not open the Razorpay test window.'));document.head.append(script);
  });
  new window.Razorpay({key:order.keyId,order_id:order.orderId,amount:selected.amount,currency:'INR',name:'The Cosmic Energizers',description:selected.name+' · test mode',
    handler:response=>run(()=>verifyChecklist({orderId:response.razorpay_order_id,paymentId:response.razorpay_payment_id,signature:response.razorpay_signature})),
    modal:{ondismiss:()=>status('Test checkout closed. You can resume the saved order.')}}).open();
}
function reviewChecklist(value){
  order=value;$('shop-order').hidden=true;$('order-review').hidden=false;
  const summary=$('order-summary');summary.textContent=money(selected.amount)+' test payment · '+value.organisation+' · ';appendOrderReference(summary,value.orderId);summary.append('. No real charge.');
  $('order-confirm').textContent=value.mode==='simulated'?'Simulate '+money(selected.amount)+' test payment':'Open Razorpay test checkout';
  status('Test order saved. Continue with the test payment.');
}
$('product-delivery').onclick=event=>{if(selected?.kind!=='download')return;event.preventDefault();run(async()=>{if(await downloadChecklist(receipt))status('Your Word download has started.');});};
$('test-another-checklist').onclick=()=>{order=null;receipt=null;$('order-complete').hidden=true;$('shop-order').reset();$('shop-order').hidden=false;status('Enter the organisation for a new test order.');};
$('shop-order').onsubmit=e=>{e.preventDefault();run(async()=>{if(!$('shop-consent').checked)throw Error('Confirm test mode before continuing.');if(selected.kind==='download'){reviewChecklist(await checklist('order',{organisation:$('buyer-organisation').value,testConsent:true}));return;}order=await api('order',{product:selected.id,testConsent:true,termsVersion:catalogue.termsVersion});$('shop-order').hidden=true;$('order-review').hidden=false;$('order-summary').innerHTML='<p><strong>'+esc(order.name)+'</strong></p>'+(order.organisation?'<p>Licence holder: '+esc(order.organisation)+'</p>':'')+'<p>Catalogue price: '+money(order.catalogueAmount)+'</p><p><strong>Due now: ₹0 · simulation only</strong></p><p class="small">No real access plan, payment or invoice is activated.</p>';$('order-title').tabIndex=-1;$('order-title').focus();});};
$('order-confirm').onclick=()=>run(async()=>{if(!order)throw Error('Start test checkout again.');if(selected.kind==='download'){await launchChecklist();return;}complete(await api('confirm',{orderId:order.orderId,testConsent:true}));});
$('order-cancel').onclick=()=>run(async()=>{
  if(selected.kind==='download'){
    if(!order)throw Error('This test order is no longer open.');
    const result=await checklist('cancel',{orderId:order.orderId});
    order=null;
    $('shop-order').reset();
    if(result.latest?.captured)complete(result.latest);
    else if(result.latest)reviewChecklist({...result.latest,keyId:result.keyId,mode:result.mode});
    else{$('order-review').hidden=true;$('shop-order').hidden=false;}
    status('Test order cancelled. No money was taken.');
    return;
  }
  order=null;$('order-review').hidden=true;$('shop-order').hidden=false;
  status('Test order closed. No money was taken.');
});
$('save-test-receipt').onclick=()=>{if(!receipt)return;const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'}));a.href=url;a.download='Navigator-Test-Order-'+selected.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);};
function productDetails(product){
  const checklist=product.id==='checklist';
  const download=product.kind==='download';
  const offer=download?'Catalogue price · one organisation, this edition':'Catalogue price · 90-day single-account access · ₹0 charged in this test';
  const features=product.includes.map(item=>'<li>'+esc(item)+'</li>').join('');
  const limits=product.excludes.map(item=>'<li>'+esc(item)+'</li>').join('');
  const preview=checklist?`
    <div class="checklist-preview">
      <h3>See six checks before signing in</h3>
      <p>Read one example from each stage, including check 43 on annual reporting. The full Word edition contains all 43 checks.</p>
      <a class="button" href="${esc(product.sample)}" target="_blank" rel="noopener">Preview the sample PDF</a>
    </div>`:'';
  const contents=checklist?`
    <h3>What you get for ${money(product.amount)}</h3>
    <ul>
      <li><strong>All 43 checks in a two-page Word file.</strong> Tick the applicable boxes and save your progress in desktop Word.</li>
      <li><strong>Personalised to your organisation.</strong> Your organisation name and order reference appear on both pages. The wording is protected and the tick boxes can be edited.</li>
      <li><strong>Linked legal sources and an internal-use licence.</strong> Use and print this edition within one organisation.</li>
    </ul>
    <h3>Six stages covered</h3>
    <ol>${features}</ol>
    <p class="small">The guided inquiry workspace, advice and case review are separate. <a href="/#plan-tested">Compare the inquiry plans</a>.</p>`:`
    <h3>What you receive</h3>
    <ul>${features}</ul>
    <details><summary>What is outside this product</summary><ul>${limits}</ul></details>`;
  const freeGuide=download?'':'<a href="'+(product.id==='aggrieved'?'/#woman':'/#respondent')+'">Use the free guidance first</a>';
  return `
    <p class="kicker">${download?'Personalised Word download':'Advanced self-service guide'}</p>
    <h2>${esc(product.name)}</h2>
    <p class="price">${money(product.amount)}</p>
    <p class="small">${offer}</p>
    <p>${esc(product.scope)}</p>
    ${preview}
    ${contents}
    <p class="small">Edition ${esc(product.edition)}</p>
    ${freeGuide}`;
}
(async()=>{try{catalogue=await api('catalogue');const id=new URLSearchParams(location.search).get('product')||'checklist';$('product-tabs').innerHTML=catalogue.products.map(p=>'<a href="/shop.html?product='+esc(p.id)+'" '+(p.id===id?'aria-current="page"':'')+'>'+esc(p.name)+'</a>').join('');selected=catalogue.products.find(p=>p.id===id);if(!selected)throw Error('This product is unavailable. Choose one of the listed products above.');$('organisation-row').hidden=selected.kind!=='download';$('buyer-organisation').required=selected.kind==='download';$('product-detail').innerHTML=productDetails(selected);$('product-licence').textContent=selected.licence;$('shop-content').hidden=false;const session=selected.kind==='download'?await checklist('session'):await api('session?product='+id);if(selected.kind==='download'&&session.signedIn){if(!session.available){status('Checklist test checkout is currently unavailable.');return;}if(session.latest?.captured){complete(session.latest);return;}if(session.latest){reviewChecklist({...session.latest,keyId:session.keyId,mode:session.mode});return;}}if(session.hasTestAccess)complete(session);else if(session.signedIn){$('shop-order').hidden=false;status('Review the scope, then start test checkout.');}else{$('shop-signin').hidden=false;$('shop-signin-link').href='/account?product='+id;status('Choose your product, then sign in for test checkout.');}}catch(e){status(e.message,true);}})();
})();
