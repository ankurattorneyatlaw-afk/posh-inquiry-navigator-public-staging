'use strict';
const {randomBytes,createHash}=require('node:crypto');
const {clientNetwork}=require('./request-guards.cjs');
const questions=new Set(require('../dist/finder.js').records.map(record=>record.id));
const reasons=new Set(['outdated','citation','unclear','context']);
const editorialStatuses=new Set(['under-review','reviewed','updated']);
const reactions=new Set(['useful','loved','review']);
const cookieName='navigator-question-reactions';

function createKnowledgeReactions({
 connectionString=process.env.KNOWLEDGE_REACTIONS_DATABASE_URL,
 enabled=process.env.KNOWLEDGE_REACTIONS_ENABLED==='true',
 url=process.env.ENQUIRY_SUPABASE_URL||process.env.COMMUNITY_SUPABASE_URL,
 key=process.env.ENQUIRY_SUPABASE_KEY||process.env.COMMUNITY_SUPABASE_KEY,
 origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',
 fetchImpl=fetch, now=Date.now
}={}){
 const writes=new Map();
 let reset=0;
 const pool=connectionString?new (require('pg').Pool)({connectionString,max:3,connectionTimeoutMillis:5000,statement_timeout:4500,ssl:{rejectUnauthorized:true}}):null;
 pool?.on('error',error=>console.error('Knowledge reactions database connection:',error.code||error.name));
 const configured=enabled&&(!!pool||(/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')&&!!key));
 async function request(path,method,body,prefer){
  if(pool){
   const args=body||{};
   if(path.startsWith('rpc/')){
    const query=path.endsWith('review_queue')?['select public.navigator_knowledge_review_queue() as value',[]]:
      ['select public.navigator_question_reactions($1,$2) as value',[args.p_question,args.p_browser_hash]];
    const result=await pool.query(...query);
    return {json:async()=>result.rows[0].value};
   }
   if(method==='DELETE'){
    const params=new URLSearchParams(path.split('?')[1]);
    await pool.query('delete from public.navigator_knowledge_reactions where question=$1 and browser_hash=$2',[params.get('question').slice(3),params.get('browser_hash').slice(3)]);
   }else if(path.startsWith('navigator_knowledge_editorial')){
    await pool.query(`insert into public.navigator_knowledge_editorial(question,status,updated_at,note,published_at)
      values($1,$2,$3,$4,$5) on conflict(question) do update set status=excluded.status,updated_at=excluded.updated_at,
      note=coalesce(excluded.note,navigator_knowledge_editorial.note),published_at=coalesce(excluded.published_at,navigator_knowledge_editorial.published_at)`,
      [args.question,args.status,args.updated_at,args.note||null,args.published_at||null]);
   }else{
    await pool.query(`insert into public.navigator_knowledge_reactions(question,browser_hash,reaction,reason,updated_at)
      values($1,$2,$3,$4,$5) on conflict(question,browser_hash) do update set reaction=excluded.reaction,reason=excluded.reason,updated_at=excluded.updated_at
      where (navigator_knowledge_reactions.reaction,navigator_knowledge_reactions.reason) is distinct from (excluded.reaction,excluded.reason)`,
      [args.question,args.browser_hash,args.reaction,args.reason,args.updated_at]);
   }
   return {};
  }
  const response=await fetchImpl(url+'/rest/v1/'+path,{method,body:body===undefined?undefined:JSON.stringify(body),
   headers:{apikey:key,...(/^eyJ/.test(key)?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
   signal:AbortSignal.timeout(4500)});
  if(!response.ok)throw Error('Reaction storage unavailable');
  return response;
 }
 return async function handle(req,res,parsed,{operator=false}={}){
  const admin=parsed.pathname==='/api/knowledge/admin/reactions';
  if(!admin&&parsed.pathname!=='/api/knowledge/reactions')return false;
  const send=(status,data)=>{
   res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
   res.end(JSON.stringify(data));return true;
  };
  if(!['GET','POST'].includes(req.method))return send(405,{error:'Method not allowed'});
  if(admin&&!operator)return send(403,{error:'Administrator access required'});
  if(admin&&req.method==='GET'){
   if(!configured)return send(503,{error:'Review queue unavailable'});
   try{return send(200,await (await request('rpc/navigator_knowledge_review_queue','POST',{})).json());}
   catch{return send(503,{error:'Review queue unavailable'});}
  }
  const question=parsed.searchParams.get('question');
  if(!questions.has(question))return send(404,{error:'Question not found'});
  if(!configured)return send(503,{error:'Reactions are temporarily unavailable'});
  const token=(req.headers.cookie||'').match(/(?:^|;\s*)navigator-question-reactions=([0-9a-f]{64})(?:;|$)/)?.[1];
  const browser=token||randomBytes(32).toString('hex');
  const hash=createHash('sha256').update(browser).digest('hex');
  try{
   if(req.method==='POST'){
    if(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))
     return send(403,{error:'Use the Knowledge Library to react'});
    if(!admin&&!token)return send(400,{error:'Allow browser cookies to save your reaction'});
    if(now()>=reset){writes.clear();reset=now()+60000;}
    const network=clientNetwork(req);
    const count=(writes.get(network)||0)+1;
    if(count>35||(!writes.has(network)&&writes.size>=5000))return send(429,{error:'Try again in a minute'});
    writes.set(network,count);
    let size=0, chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>(admin?4096:160))return send(413,{error:'Reaction too large'});chunks.push(chunk);}
    let data;
    try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Invalid reaction'});}
    if(!data||Array.isArray(data)||typeof data!=='object')return send(400,{error:'Invalid request'});
    const updated_at=new Date(now()).toISOString();
    if(admin){
     if(Object.keys(data).some(key=>!['status','note'].includes(key))||!editorialStatuses.has(data.status)||
       (data.status==='updated'?(typeof data.note!=='string'||!data.note.trim()||data.note.length>500):data.note!==undefined))
      return send(400,{error:'Choose a status and enter a public note for an update'});
     const update={question,status:data.status,updated_at};
     if(data.status==='updated')Object.assign(update,{note:data.note.trim(),published_at:updated_at});
     await request('navigator_knowledge_editorial?on_conflict=question','POST',update,'resolution=merge-duplicates');
     return send(200,{saved:true});
    }
    if(Object.keys(data).some(key=>!['reaction','reason'].includes(key))||!(data.reaction===null||reactions.has(data.reaction))||
      (data.reason!=null&&(data.reaction!=='review'||!reasons.has(data.reason))))return send(400,{error:'Invalid reaction'});
    if(data.reaction===null){
     await request('navigator_knowledge_reactions?'+new URLSearchParams({question:'eq.'+question,browser_hash:'eq.'+hash}),'DELETE');
    }else{
     await request('navigator_knowledge_reactions?on_conflict=question,browser_hash','POST',{question,browser_hash:hash,reaction:data.reaction,reason:data.reason??null,updated_at},'resolution=merge-duplicates');
    }
   }
   const response=await request('rpc/navigator_question_reactions','POST',{p_question:question,p_browser_hash:hash});
   const tally=await response.json();
   if(!token)res.setHeader('Set-Cookie',cookieName+'='+browser+'; Max-Age=31536000; Path=/api/knowledge/reactions; HttpOnly; SameSite=Lax'+(origin.startsWith('https:')?'; Secure':''));
   return send(200,tally);
  }catch{return send(503,{error:'Reactions are temporarily unavailable'});}
 };
}
module.exports={createKnowledgeReactions};
