'use strict';
const {isIP}=require('node:net');
// Only consume a forwarding hop behind the configured Render reverse proxy.
// Ignore caller-controlled prefixes; callers persist only a salted fingerprint.
function clientNetwork(req,{trustProxy=!!process.env.RENDER}={}){
 const forwarded=String(req.headers['x-forwarded-for']||'').split(',').pop().trim();
 return trustProxy&&isIP(forwarded)?forwarded:String(req.socket?.remoteAddress||'unknown');
}
module.exports={clientNetwork};
