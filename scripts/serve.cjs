// Serves allowlisted public assets and validated community/test-payment API requests.
const http = require('node:http');
const community=require('./community-api.cjs').createCommunityHandler();
const payments=require('./payment-api.cjs').createPaymentHandler();
const enquiries=require('./enquiry-api.cjs').createEnquiryHandler();
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../dist');
const allowed = new Set(fs.readdirSync(root));
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
  if(await enquiries(req,res,parsed))return;
  if(await community(req,res,parsed))return;
  if(await payments(req,res,parsed))return;
  if(parsed.pathname==='/checkout.html')res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.razorpay.com; connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  const name=parsed.pathname.slice(1)||'index.html';
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
  if (!allowed.has(name)) {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','json':'application/json','txt':'text/plain'})[name.split('.').pop()]);
  res.writeHead(200);res.end(req.method==='HEAD'?undefined:fs.readFileSync(path.join(root,name)));
});
server.requestTimeout=15000;
server.headersTimeout=10000;
server.keepAliveTimeout=5000;
server.maxRequestsPerSocket=100;
server.listen(Number(process.env.PORT || 4173),process.env.RENDER ? '0.0.0.0' : '127.0.0.1',()=>console.log('POSH Inquiry Navigator staging ready'));
process.on('SIGTERM',()=>server.close());
