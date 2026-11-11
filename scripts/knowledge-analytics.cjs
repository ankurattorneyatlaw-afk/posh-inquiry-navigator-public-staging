'use strict';
const {randomBytes,createHmac}=require('node:crypto');
const {clientNetwork}=require('./request-guards.cjs');
const finder=require('../dist/finder.js');
const topics=new Set(finder.topics);
const questions=new Set(finder.records.map(x=>x.id));
const questionTitles=new Map(finder.records.map(x=>[x.id,x.question]));
const actions=new Set(['checklist','compliance','inquiry','training','consultation']);
const events=new Set(['library_open','question_open','search_topic','search_no_results','topic_select','action_click']);
const countries=new Set(['IN','US','GB','CA','AU','AE','SG','NZ','DE','FR','IE','ZA','ZZ']);
function validate(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['event','item','country'].includes(k)))throw Error('Invalid metric');
 const event=body.event,item=body.item,country=body.country;
 if(!events.has(event)||typeof item!=='string'||item.length>80||!countries.has(country))throw Error('Invalid metric');
 if(event==='library_open'||event==='search_no_results'){if(item!=='all'&&item!=='none')throw Error('Invalid metric');}
 if(event==='question_open'&&!questions.has(item))throw Error('Unknown question');
 if(['search_topic','topic_select'].includes(event)&&!topics.has(item))throw Error('Unknown topic');
 if(event==='action_click'&&!actions.has(item))throw Error('Unknown action');
 return {event,item,country};
}
function createKnowledgeAnalytics({enabled=process.env.KNOWLEDGE_ANALYTICS_ENABLED==='true',url=process.env.ENQUIRY_SUPABASE_URL||process.env.COMMUNITY_SUPABASE_URL,key=process.env.ENQUIRY_SUPABASE_KEY||process.env.COMMUNITY_SUPABASE_KEY,origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',fetchImpl=fetch,now=Date.now}={}){
 const configured=()=>enabled&&/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')&&!!key;
 const secret=randomBytes(32),counts=new Map(),recent=new Map();
 let reset=now()+60000,total=0;
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(data?JSON.stringify(data):undefined)};
 function limited(req,keyName){
  if(now()>=reset){counts.clear();recent.clear();total=0;reset=now()+60000}
  if(++total>1200)return true;
  const h=createHmac('sha256',secret).update(clientNetwork(req)).digest('hex');
  const n=(counts.get(h)||0)+1;counts.set(h,n);
  if(n>50)return true;
  const fp=h+':'+keyName,previous=recent.get(fp);
  if(previous&&now()-previous<12000)return true;
  recent.set(fp,now());return false;
 }
 const request=async(path,options={})=>{
  const response=await fetchImpl(url+'/rest/v1/'+path,{...options,headers:{apikey:key,...(/^eyJ/.test(key)?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(4500)});
  if(!response.ok)throw Error('Storage unavailable');return response;
 };
 return {
  configured,
  async handle(req,res,parsed){
   if(!parsed.pathname.startsWith('/api/knowledge/'))return false;
   if(parsed.pathname==='/api/knowledge/config'&&req.method==='GET'){send(res,200,{enabled:configured(),privacy:'aggregate-only',location:'approximate-time-zone-country'});return true}
   if(parsed.pathname==='/api/knowledge/event'&&req.method==='POST'){
    if(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){send(res,403,{error:'Not permitted'});return true}
    if(!configured()){send(res,503,{error:'Aggregate metrics unavailable'});return true}
    let size=0,chunks=[];
    for await(const c of req){size+=c.length;if(size>256){send(res,413,{error:'Too large'});return true}chunks.push(c)}
    let m;try{m=validate(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{send(res,400,{error:'Invalid metric'});return true}
    if(limited(req,m.event+':'+m.item)){send(res,204);return true}
    try{await request('rpc/navigator_knowledge_record',{method:'POST',body:JSON.stringify({p_event:m.event,p_item:m.item,p_country:m.country})});send(res,204)}
    catch{send(res,503,{error:'Aggregate metrics unavailable'})}
    return true;
   }
   return false;
  },
  async summary(req,res,parsed){
   if(parsed.pathname!=='/api/knowledge/admin/summary')return false;
   if(req.method!=='GET'){send(res,405,{error:'Method not allowed'});return true}
   if(!configured()){send(res,503,{error:'Enable Knowledge Library metrics in the server environment'});return true}
   const since=String(parsed.searchParams.get('days')||'30');
   if(!['7','30','90','365'].includes(since)){send(res,400,{error:'Choose 7, 30, 90 or 365 days'});return true}
   const cutoff=new Date(now()-Number(since)*86400000).toISOString().slice(0,10);
   try{
    const r=await request('navigator_knowledge_daily?select=day,event,item,country,hits&day=gte.'+cutoff+'&limit=10000',{method:'GET'});
    const rows=await r.json();
    const summarize=(event)=>Object.entries(rows.filter(x=>x.event===event).reduce((a,x)=>(a[x.item]=(a[x.item]||0)+Number(x.hits),a),{})).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([item,hits])=>({item,hits}));
    const country=Object.entries(rows.reduce((a,x)=>(a[x.country]=(a[x.country]||0)+Number(x.hits),a),{})).sort((a,b)=>b[1]-a[1]).map(([item,hits])=>({item,hits}));
    send(res,200,{days:Number(since),totals:rows.reduce((a,x)=>(a[x.event]=(a[x.event]||0)+Number(x.hits),a),{}),questions:summarize('question_open').map(x=>({...x,title:questionTitles.get(x.item)||x.item})),searchedTopics:summarize('search_topic'),topics:summarize('topic_select'),actions:summarize('action_click'),countries:country,from:cutoff,note:'Anonymous event counts, not unique visitors; country inferred from browser time zone and may be unknown. Raw search queries are never stored.'});
   }catch{send(res,503,{error:'Analytics data unavailable'})}
   return true;
  }
 };
}
module.exports={createKnowledgeAnalytics,validate};
