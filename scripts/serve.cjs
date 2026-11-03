// Serves allowlisted public assets and validated community/test-payment API requests.
const http = require('node:http');
const community=require('./community-api.cjs').createCommunityHandler();
const payments=require('./payment-api.cjs').createPaymentHandler();
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
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  let parsed; try {parsed=new URL(req.url,'http://localhost');} catch {res.writeHead(400);res.end();return;}
  if(parsed.pathname==='/institutions.html'||parsed.pathname==='/institutions/'){res.writeHead(301,{Location:'/institutions'});res.end();return;}
  if(await analytics.handle(req,res,parsed))return;
  if(await enquiries(req,res,parsed))return;
  if(await community(req,res,parsed))return;
  if(await payments(req,res,parsed))return;
  if(parsed.pathname==='/checkout.html')res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.razorpay.com; connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  const name=({'/institutions':'institutions.html','/institutions/':'institutions.html','/request-demonstration':'index.html','/guided':'guided.html','/guided/':'guided.html'}[parsed.pathname])||parsed.pathname.slice(1)||'index.html';
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
  if (!allowed.has(name)) {res.writeHead(404);res.end();return;}
  if(release.search?.indexable&&['/','/index.html','/institutions','/institutions/','/institutions.html'].includes(parsed.pathname))res.setHeader('X-Robots-Tag','index, follow');
  if(name.endsWith('.html')){const html=fs.readFileSync(path.join(root,name),'utf8'),hashes=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>"'sha256-"+crypto.createHash('sha256').update(m[1]).digest('base64')+"'");if(hashes.length)res.setHeader('Content-Security-Policy',csp.replace("script-src 'self'","script-src 'self' "+hashes.join(' ')));}
  res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','json':'application/json','txt':'text/plain','xml':'application/xml; charset=utf-8','svg':'image/svg+xml','png':'image/png'})[name.split('.').pop()]);
  // Surface the integrated workflow in the existing site without modifying the signed static release assets.
  let payload=fs.readFileSync(path.join(root,name));
  if(name==='index.html'){
    let document=payload.toString('utf8');
    document=document.replace('<nav aria-label="Main navigation" class="desktop-nav">','<nav aria-label="Main navigation" class="desktop-nav"><a href="/guided">Guided IC/LC Inquiry</a>');
    document=document.replace('<nav aria-label="Mobile navigation">','<nav aria-label="Mobile navigation"><a href="/guided">Guided IC/LC Inquiry</a>');
    payload=Buffer.from(document,'utf8');
  }
  res.writeHead(200);res.end(req.method==='HEAD'?undefined:payload);
});
server.requestTimeout=15000;
server.headersTimeout=10000;
server.keepAliveTimeout=5000;
server.maxRequestsPerSocket=100;
server.listen(Number(process.env.PORT || 4173),process.env.RENDER ? '0.0.0.0' : '127.0.0.1',()=>console.log('POSH Inquiry Navigator staging ready'));
process.on('SIGTERM',()=>server.close());
