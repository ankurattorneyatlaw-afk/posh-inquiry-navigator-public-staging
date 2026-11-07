const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),D=require('../dist/docx.js'),P=require('../dist/personal-docx.js'),docs=require('../dist/workflow-documents.js');
const out='qa/professional-documents';fs.mkdirSync(out,{recursive:true});const manifest=[];
function save(id,title,items,bytes){const file=path.join(out,id+'.docx');fs.writeFileSync(file,bytes||D.buildDocx(title,items,{workflow:true}));manifest.push({id,title,file});}
for(const e of docs.entries)save('committee-'+e.id,e.title,docs.items(e.id));
const data=JSON.parse(fs.readFileSync(path.join(process.env.PRIVATE_PRODUCT_SOURCE,'individual-guides.json'),'utf8'));
for(const role of ['aggrieved','respondent'])for(const [id,d] of Object.entries(data[role].drafts)){
 save(role+'-'+id,d.title,d.items);
 save(role+'-'+id+'-usage','Guide to using this template',[{type:'title',text:'Guide to using this template'},{type:'heading',text:d.title},{type:'p',text:'Keep these notes separate. Do not include this guide with a letter or submission.'},{type:'heading',text:'Before you customise'},...d.instructions.map(text=>({type:'p',text})),{type:'heading',text:'Final checks'},...['Replace every bracketed field with accurate information, remove inapplicable alternatives and check the recipient, dates, references and attachments.','For correspondence, sign and send through the authorised secure channel. Keep the sent version and actual receipt. Downloading does not file, issue, serve or approve it.','Complete identifying information offline. No calls, personal legal review or representation are included. Obtain qualified advice for a disputed legal issue or remedy.'].map(text=>({type:'p',text})),{type:'heading',text:'Applicable framework to verify'},{type:'p',text:d.basis},{type:'meta',text:'POSH Inquiry Navigator · Individual template edition '+require('../dist/products.js').products.find(p=>p.id===role).edition}]);
}
save('free-complaint','Complaint',null,D.womanComplaint({}));save('free-conciliation','Conciliation',null,D.womanConciliation({'w.conciliation':'yes','w.conciliationVoluntary':'yes','w.filed':'no'}));save('free-respondent','Reply',null,D.respondentReply({}));
fs.writeFileSync(out+'/manifest.json',JSON.stringify(manifest,null,2));console.log('Generated '+manifest.length+' downloads');

