'use strict';
const {clientNetwork}=require('./request-guards.cjs');

const {randomUUID,randomBytes,createHmac}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories=['General','Inquiry process','Rights and safeguards','Committee practice'];
const pick=(row,fields)=>Object.fromEntries(fields.map(k=>[k,row[k]]));
const questionFields=['id','title','body','category','alias','created_at'];
const answerFields=['id','question_id','body','alias','created_at'];
const reasons=['Identifying information','Confidential case details','Abuse or harassment','Spam or misleading content'];
function validateText(value,min,max){
 if(typeof value!=='string')throw Error('Please enter text.');
 const text=value.normalize('NFKC').trim();
 if(text.length<min||text.length>max)throw Error(`Please use ${min}–${max} characters.`);
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))throw Error('Please remove control characters.');
 const checked=text.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,'').replace(/[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F]/g,c=>String(c.charCodeAt(0)-(c>='\u0966'?0x0966:c>='\u06f0'?0x06f0:0x0660)));
 if(/[^\s@]+@[^\s@]+\.[^\s@]+|(?:\+?\d[\s().-]*){7,}|https?:\/\/|www\./i.test(checked))throw Error('Remove contact details, long identifying numbers and links before submitting.');
 return text;
}
function createCommunityHandler({url=process.env.COMMUNITY_SUPABASE_URL,key=process.env.COMMUNITY_SUPABASE_KEY,origin=process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4173',fetchImpl=fetch,now=Date.now}={}){
 const salt=randomBytes(32),limits=new Map();let windowStart=now(),globalCount=0;
 function allowed(req){
  const t=now();if(t-windowStart>900000){windowStart=t;globalCount=0;limits.clear();}
  if(++globalCount>100)return false;
  const network=clientNetwork(req);
  const hash=createHmac('sha256',salt).update(String(network)).digest('hex');
  const count=(limits.get(hash)||0)+1;limits.set(hash,count);return count<=5;
 }
 async function db(table,query='',data){
  const r=await fetchImpl(url+'/rest/v1/'+table+query,{method:data?'POST':'GET',headers:{apikey:key,'Content-Type':'application/json',...(data?{Prefer:'return=minimal'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('database_unavailable');return data?null:await r.json();
 }
 function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 return async function community(req,res,parsed){
  const route=parsed.pathname;if(!route.startsWith('/api/community/'))return false;
  try{
   if(route==='/api/community/config'&&req.method==='GET'){send(res,200,{enabled:!!(url&&key),moderated:true,signInRequired:false});return true;}
   if(!url||!key){send(res,503,{error:'Community is temporarily unavailable. Please try again later.'});return true;}
   if(req.method==='GET'){
    if(route==='/api/community/questions'){
     const n=Number(parsed.searchParams.get('offset')||0);if(!Number.isInteger(n)||n<0||n>10000){send(res,400,{error:'Invalid page.'});return true;}
     const rows=await db('community_questions',`?select=id,title,body,category,alias,created_at&status=eq.approved&order=created_at.desc,id&limit=20&offset=${n}`);send(res,200,{questions:rows.map(q=>pick(q,questionFields))});return true;
    }
    const match=route.match(/^\/api\/community\/questions\/([^/]+)$/);const id=match?.[1];if(match&&UUID.test(id)){
     const offset=Number(parsed.searchParams.get('answers_offset')||0);if(!Number.isInteger(offset)||offset<0||offset>10000){send(res,400,{error:'Invalid answer page.'});return true;}
     const rows=await db('community_questions',`?select=id,title,body,category,alias,created_at&id=eq.${id}&status=eq.approved`);
     if(!rows.length){send(res,404,{error:'Question is unavailable.'});return true;}
     const answers=await db('community_answers',`?select=id,question_id,body,alias,created_at&question_id=eq.${id}&status=eq.approved&order=created_at.asc,id&limit=21&offset=${offset}`);send(res,200,{question:pick(rows[0],questionFields),answers:answers.slice(0,20).map(a=>pick(a,answerFields)),answersHasMore:answers.length>20,nextAnswerOffset:offset+Math.min(answers.length,20)});return true;
    }
    send(res,404,{error:'Not found.'});return true;
   }
   if(req.method!=='POST'){send(res,405,{error:'Method not allowed.'});return true;}
   if(req.headers.origin!==origin||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){send(res,403,{error:'Submit from the community page.'});return true;}
   if(!allowed(req)){res.setHeader('Retry-After','900');send(res,429,{error:'Submission limit reached. Please try again in fifteen minutes.'});return true;}
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>8192){send(res,413,{error:'Submission is too long.'});return true;}chunks.push(chunk);}
   let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{send(res,400,{error:'Invalid submission.'});return true;}
   if(!data||Array.isArray(data)||data.website||data.consent!==true){send(res,400,{error:'Confirm the community rules before submitting.'});return true;}
   const id=randomUUID();
   try{
    if(route==='/api/community/questions'){
     const title=validateText(data.title,10,160),body=validateText(data.body,20,2000);if(!categories.includes(data.category))throw Error('Choose a topic.');
     await db('community_questions','',{id,title,body,category:data.category,status:'pending'});
    }else if(route==='/api/community/answers'){
     if(!UUID.test(data.question_id||''))throw Error('Invalid question.');
     const body=validateText(data.body,20,2000);await db('community_answers','',{id,question_id:data.question_id,body,status:'pending'});
    }else if(route==='/api/community/reports'){
     if(!UUID.test(data.post_id||'')||!['question','answer'].includes(data.kind)||!reasons.includes(data.reason))throw Error('Choose a valid report reason.');
     await db('community_reports','',{post_id:data.post_id,kind:data.kind,reason:data.reason});
    }else{send(res,404,{error:'Not found.'});return true;}
   }catch(e){if(e.message==='database_unavailable')throw e;send(res,400,{error:e.message});return true;}
   send(res,202,{status:'pending',...(route==='/api/community/reports'?{}:{receipt:id}),message:'Received for moderator review. It is not public yet.'});return true;
  }catch{send(res,503,{error:'We could not complete that request. Please try again later.'});return true;}
 };
}
module.exports={createCommunityHandler,validateText,categories,reasons};
