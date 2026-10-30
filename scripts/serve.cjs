// Dependency-free staging server. Serves only built public assets; accepts no writes.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../dist');
const allowed = new Set(fs.readdirSync(root));
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const server = http.createServer((req,res)=>{
  res.setHeader('Content-Security-Policy',csp);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  let name; try { name = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html'; } catch {res.writeHead(400);res.end();return;}
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
  if (!allowed.has(name)) {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','json':'application/json','txt':'text/plain'})[name.split('.').pop()]);
  res.writeHead(200);res.end(req.method==='HEAD'?undefined:fs.readFileSync(path.join(root,name)));
});
server.listen(Number(process.env.PORT || 4173),process.env.RENDER ? '0.0.0.0' : '127.0.0.1',()=>console.log('POSH Inquiry Navigator staging ready'));
process.on('SIGTERM',()=>server.close());
