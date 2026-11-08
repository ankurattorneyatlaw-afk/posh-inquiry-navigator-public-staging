// Serves allowlisted public assets and validated community/test-payment API requests.
const http = require('node:http');
const {createAccountAccess,PROTECTED}=require('./account-access.cjs');
const accounts=createAccountAccess();
const testInquiryAssets=new Set([...PROTECTED].filter(name=>!['workspace.html','admin.html'].includes(name)));
const community=require('./community-api.cjs').createCommunityHandler();
const payments=require('./payment-api.cjs').createPaymentHandler({identify:accounts.purchaseIdentity});
const shop=require('./shop-api.cjs').createShopHandler({identify:accounts.purchaseIdentity,allowLegacyChecklist:false});
const checklist=require('./checklist-checkout.cjs').fromEnvironment(accounts.checkoutIdentity);
const {getPlanTools}=require('./plan-tools.cjs');
const analytics=require('./analytics-api.cjs').createAnalytics();
const enquiryMailer=require('./enquiry-mail.cjs').createEnquiryMailer();
const enquiries=require('./enquiry-api.cjs').createEnquiryHandler({onSaved:analytics.savedEnquiry,notify:enquiryMailer});
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../dist');
const allowed = new Set(fs.readdirSync(root));
const release=JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8'));
const crypto=require('node:crypto');
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const server = http.createServer(async(req,res)=>{
  res.setHeader('Content-Security-Policy',csp);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  if(process.env.RENDER)res.setHeader('Strict-Transport-Security','max-age=31536000');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  let parsed; try {parsed=new URL(req.url,'http://localhost');} catch {res.writeHead(400);res.end();return;}
  if(parsed.pathname==='/health'){
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(req.method==='HEAD'?undefined:JSON.stringify({status:'ok',product:release.product,version:release.version}));return;
  }
  if(parsed.pathname==='/institutions.html'||parsed.pathname==='/institutions/'){res.writeHead(301,{Location:'/institutions'});res.end();return;}
  if(parsed.pathname==='/api/plan-tools'){
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Vary','Cookie');
    if(req.method!=='GET'){res.writeHead(405,{'Allow':'GET'});res.end(JSON.stringify({error:'Use the plan tools page.'}));return;}
    try{
      const test=parsed.searchParams.has('testOrder');
      const plan=test?await payments.toolsPlan(req,res,parsed.searchParams.get('testOrder')):await accounts.activeToolsPlan(req,res);
      const tools=getPlanTools(plan);
      res.writeHead(tools?200:403);
      res.end(JSON.stringify(tools?{...tools,test}:{error:'Verified plan access is required. Open your workspace or return to your captured staging order.'}));
    }catch{res.writeHead(503);res.end(JSON.stringify({error:'Plan access is temporarily unavailable.'}));}
    return;
  }
  if(await accounts.handle(req,res,parsed))return;
  if(await analytics.handle(req,res,parsed))return;
  if(await enquiries(req,res,parsed))return;
  if(await community(req,res,parsed))return;
  if(await payments(req,res,parsed))return;
  if(await checklist(req,res,parsed))return;
  if(await shop(req,res,parsed))return;
  if(parsed.pathname==='/checkout.html'||parsed.pathname==='/shop.html')res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.razorpay.com; connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  const name=({'/institutions':'institutions.html','/institutions/':'institutions.html','/request-demonstration':'index.html','/account':'account.html','/account/':'account.html','/workspace':'workspace.html','/workspace/':'workspace.html','/admin':'admin.html','/admin/':'admin.html','/preview':'preview.html','/guided':'guided.html','/guided/':'guided.html'}[parsed.pathname])||parsed.pathname.slice(1)||'index.html';
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
  const testOrder=parsed.searchParams.get('testOrder');
  const testAsset=testOrder!==null&&testInquiryAssets.has(name);
  if(testAsset){
    let verified;
    try{verified=await payments.toolsPlan(req,res,testOrder);}catch{
      res.writeHead(503);res.end('Staging access check unavailable.');return;
    }
    if(!verified){res.writeHead(403);res.end('Verified staging order required.');return;}
  }else if(await accounts.protect(req,res,name))return;
  if (!allowed.has(name)) {
    const page=(req.headers.accept||'').includes('text/html')||!path.extname(name)||name.endsWith('.html');
    res.writeHead(404,{'Content-Type':page?'text/html; charset=utf-8':'text/plain; charset=utf-8'});
    res.end(req.method==='HEAD'?undefined:page?'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | POSH Inquiry Navigator</title><body><main><h1>Page not found</h1><p>This address is unavailable. Choose where to continue.</p><p><a href="/">Homepage</a> · <a href="/guided">Guided IC/LC Inquiry</a> · <a href="/#faq">FAQs and legal sources</a></p></main></body></html>':'Not found');return;
  }
  if(release.search?.indexable&&['/','/index.html','/institutions','/institutions/','/institutions.html'].includes(parsed.pathname))res.setHeader('X-Robots-Tag','index, follow');
  if(name.endsWith('.html')){const html=fs.readFileSync(path.join(root,name),'utf8'),hashes=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>"'sha256-"+crypto.createHash('sha256').update(m[1]).digest('base64')+"'");if(hashes.length)res.setHeader('Content-Security-Policy',csp.replace("script-src 'self'","script-src 'self' "+hashes.join(' ')));}
  res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','json':'application/json','txt':'text/plain','xml':'application/xml; charset=utf-8','svg':'image/svg+xml','png':'image/png','pdf':'application/pdf'})[name.split('.').pop()]);
  // Surface the integrated workflow in the existing site without modifying the signed static release assets.
  let payload=fs.readFileSync(path.join(root,name));
  if(name==='guided.html'&&accounts.enabled){payload=Buffer.from(payload.toString('utf8').replace('<body>','<body data-account-required>').replace('CURRENT RENDER STAGING','ACCOUNT ACCESS').replace('FICTIONAL DEMONSTRATION · DO NOT ENTER ACTUAL CASE INFORMATION','PRIVATE BROWSER SESSION · USE CODES ONLY · NO CASE DATA IS STORED').replace('Structured IC/LC workflow · Staging','Structured IC/LC procedural guide').replace('Follow the fictional inquiry','Follow the procedural inquiry').replace('Complaint intake to completion · Procedural preview','Complaint intake to completion · Committee decisions remain human').replace('No real cases or identities.','Keep identities and source records in your institution’s own secure records.').replace('Existing POSH Inquiry Navigator staging · Not approved for confidential or operational use · Human decisions always required','POSH Inquiry Navigator · No case data is transmitted or stored · Human decisions always required').replace('Fictional test scenario','Learning scenario (synthetic examples only)'),'utf8');}
  if(testOrder!==null&&/^order_[A-Za-z0-9]+$/.test(testOrder)&&(name==='guided.html'||name==='plan-tools.html')){
    const query='?testOrder='+encodeURIComponent(testOrder);
    const body=payload.toString('utf8').replace(/src="\/([^"]+)"/g,(match,asset)=>
      testInquiryAssets.has(asset)?'src="/'+asset+query+'"':match
    ).replace(/<body(?: data-account-required)?>/,name==='guided.html'?'<body data-account-required data-test-inquiry>':'<body>');
    payload=Buffer.from(body,'utf8');
  }
  res.writeHead(200);res.end(req.method==='HEAD'?undefined:payload);
});
server.requestTimeout=15000;
server.headersTimeout=10000;
server.keepAliveTimeout=5000;
server.maxRequestsPerSocket=100;
server.listen(Number(process.env.PORT || 4173),process.env.RENDER ? '0.0.0.0' : '127.0.0.1',()=>console.log('POSH Inquiry Navigator staging ready'));
process.on('SIGTERM',()=>server.close());
