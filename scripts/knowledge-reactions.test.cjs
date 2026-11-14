'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {createKnowledgeReactions}=require('./knowledge-reactions.cjs');
const question=require('../dist/finder.js').records[0].id;
test('one browser can replace or remove its reaction while the public tally includes other browsers',async()=>{
 const votes=new Map();
 const origin='https://staging.example.test';
 const handle=createKnowledgeReactions({connectionString:null,enabled:true,url:'https://demo.supabase.co',key:'fixture',origin,fetchImpl:async(url,options)=>{
  const data=options.body&&JSON.parse(options.body);
  if(url.includes('/rpc/')){
   const counts={useful:0,loved:0,review:0,selected:votes.get(data.p_browser_hash)||null};
   for(const reaction of votes.values())counts[reaction]++;
   return {ok:true,json:async()=>counts};
  }
  if(options.method==='DELETE')votes.delete(new URL(url).searchParams.get('browser_hash').slice(3));
  else votes.set(data.browser_hash,data.reaction);
  return {ok:true};
 }});
 async function call(method,cookie,body,from=origin){
  const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);
  Object.assign(req,{method,headers:{cookie,origin:from,'content-type':'application/json'},socket:{}});
  const response={headers:{},setHeader(k,v){this.headers[k]=v},writeHead(status){this.status=status},end(value){this.data=JSON.parse(value)}};
  await handle(req,response,new URL(origin+'/api/knowledge/reactions?question='+question));
  return response;
 }
 const first=await call('GET');
 const a=first.headers['Set-Cookie'].split(';')[0];
 const b=(await call('GET')).headers['Set-Cookie'].split(';')[0];
 assert.notEqual(a,b);
 assert.equal((await call('POST',a,{reaction:'useful'},'https://elsewhere.test')).status,403);
 assert.equal((await call('POST',a,{reaction:'useful'})).data.useful,1);
 assert.equal((await call('POST',a,{reaction:'useful'})).data.useful,1);
 assert.equal((await call('POST',b,{reaction:'review'})).data.review,1);
 assert.deepEqual((await call('POST',a,{reaction:'loved'})).data,{useful:0,loved:1,review:1,selected:'loved'});
 assert.deepEqual((await call('POST',a,{reaction:null})).data,{useful:0,loved:0,review:1,selected:null});
 assert.equal((await call('GET',b)).data.selected,'review');
});

test('review reasons are private and editor routes require operator verification',async()=>{
 const q=question;
 const origin='https://staging.example.test';
 const writes=[];
 const handler=createKnowledgeReactions({connectionString:null,enabled:true,url:'https://demo.supabase.co',key:'fixture',origin,fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body||'null');
  writes.push([url,body]);
  return {ok:true,json:async()=>url.includes('queue')?[{question:q,total:2,reasons:{citation:1}}]:{useful:0,loved:0,review:1,selected:null,reason:null}};
 }});
 async function call(admin,method,body,operator=false){
  const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);
  Object.assign(req,{method,headers:{cookie:'navigator-question-reactions='+'a'.repeat(64),origin,'content-type':'application/json'},socket:{}});
  const res={setHeader(){},writeHead(status){this.status=status;},end(value){this.data=JSON.parse(value);}};
  await handler(req,res,new URL(origin+(admin?'/api/knowledge/admin/reactions':'/api/knowledge/reactions')+'?question='+q),{operator});
  return res;
 }
 assert.equal((await call(true,'GET')).status,403);
 assert.equal((await call(true,'POST',{status:'reviewed'})).status,403);
 assert.equal(writes.length,0);
 assert.equal((await call(false,'POST',{reaction:'loved',reason:'citation'})).status,400);
 assert.equal((await call(false,'POST',{reaction:'review',reason:'My case details'})).status,400);
 assert.equal((await call(false,'POST',{reaction:'review',reason:'citation'})).status,200);
 assert.equal(writes[0][1].reason,'citation');
 assert.equal((await call(true,'GET',undefined,true)).data[0].reasons.citation,1);
 assert.equal((await call(true,'POST',{status:'updated',note:' '},true)).status,400);
 assert.equal((await call(true,'POST',{status:'updated',note:' Updated citation '},true)).status,200);
 assert.equal(writes.at(-1)[1].note,'Updated citation');
});
