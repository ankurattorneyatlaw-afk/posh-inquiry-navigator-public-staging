
'use strict';

const assetByEdition = {'2.0':'buyer-checklist-template.json'};
const accessDays = 120;
const millisecondsPerDay = 86400000;

function decodeXml(text) {
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, entity)=>{
    const values={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    if(entity[0]!=='#')return values[entity];
    return String.fromCodePoint(entity[1]==='x'?Number.parseInt(entity.slice(2),16):Number(entity.slice(1)));
  });
}

function textRuns(xml) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(m=>decodeXml(m[1]));
}

function readEdition(parts) {
  const xml=parts['word/document.xml'];
  if(typeof xml!=='string')throw Error('Checklist document unavailable');
  const groups=[];
  let group;
  let count=0;
  for(const [paragraph] of xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)){
    if(/<w:pStyle\s+w:val="Heading2"\s*\/>/.test(paragraph)){
      group={title:textRuns(paragraph).join('').trim(),note:'',items:[]};
      groups.push(group);
      continue;
    }
    if(!group)continue;
    const tag=paragraph.match(/<w:tag\s+w:val="check_(\d{2})"\s*\/>/);
    if(!tag){
      if(!group.items.length){
        const text=textRuns(paragraph).join('').trim();
        if(text)group.note=[group.note,text].filter(Boolean).join(' ');
      }
      continue;
    }
    if(!/<w14:checkbox>/.test(paragraph)||Number(tag[1])!==count+1)throw Error('Checklist item order is invalid');
    const runs=textRuns(paragraph.slice(paragraph.indexOf('</w:sdt>')+'</w:sdt>'.length));
    if(runs.shift()?.trim()!==tag[1])throw Error('Checklist item number is invalid');
    const text=runs.join('').trim();
    if(!text)throw Error('Checklist item text is missing');
    group.items.push({number:++count,text});
  }
  const stages=groups.filter(item=>item.items.length);
  if(count!==43||stages.length!==6||stages.some(stage=>!stage.title))throw Error('Checklist edition is incomplete');

  const relationships=new Map();
  for(const [relationship] of (parts['word/_rels/document.xml.rels']||'').matchAll(/<Relationship\s[^>]*\/>/g)){
    const id=relationship.match(/\bId="([^"]+)"/)?.[1];
    const target=relationship.match(/\bTarget="([^"]+)"/)?.[1];
    if(id&&target&&target.startsWith('https://'))relationships.set(id,decodeXml(target));
  }
  const sources=[];
  for(const [,id,link] of xml.matchAll(/<w:hyperlink\s[^>]*\br:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/g)){
    const url=relationships.get(id);
    const title=textRuns(link).join('').trim();
    if(url&&title)sources.push({title,url});
  }
  return {stages,sources};
}

function onlineFromEnvironment({
  url=process.env.NAVIGATOR_AUTH_URL,key=process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,
  token=process.env.NAVIGATOR_CHECKLIST_STORE_TOKEN,fetchImpl=fetch,
  readAsset=require('./product-assets.cjs').productReader({key:process.env.NAVIGATOR_CHECKLIST_ASSET_KEY})
}={}){
  const editions=new Map();
  function read(edition){
    if(!Object.hasOwn(assetByEdition,edition))throw Error('Checklist edition unavailable');
    if(!editions.has(edition))editions.set(edition,readEdition(JSON.parse(readAsset(assetByEdition[edition]).toString('utf8'))));
    return editions.get(edition);
  }
  async function access(buyer,id){
    if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')||!key||! /^[a-f0-9]{64}$/.test(token||'')||!buyer.accessToken)throw Error('Online access is not configured');
    const response=await fetchImpl(url+'/rest/v1/rpc/navigator_online_checklist',{
      method:'POST',headers:{apikey:key,Authorization:'Bearer '+buyer.accessToken,'Content-Type':'application/json'},
      body:JSON.stringify({p_token:token,p_id:id}),signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)throw Error('Online checklist access could not be verified');
    return response.json();
  }
  return {read,access};
}

function accessUntil(order){
  if(!order.captured||!order.downloadUntil)return null;
  const legacyDeadline=Date.parse(order.downloadUntil);
  return Number.isFinite(legacyDeadline)?new Date(legacyDeadline+(accessDays-90)*millisecondsPerDay).toISOString():null;
}

module.exports={readEdition,onlineFromEnvironment,accessUntil};

