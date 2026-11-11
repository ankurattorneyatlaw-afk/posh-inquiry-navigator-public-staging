'use strict';
// Server-only transport. Not enabled until a durable delivery queue and verified sender are connected.
const sender={name:'The Cosmic Energizers',email:'training@thecosmicenergizers.com'};
const owner='ankur.attorneyatlaw@gmail.com';
const plans={unsure:'Help me choose',essential:'Inquiry Essential',professional:'Inquiry Professional',advanced:'Inquiry Advanced',institutional:'Institutional Plus',enterprise:'Government / Enterprise',knowledge:'Professional knowledge resources'};
function buildMessages(enquiry){
 const {id,contact_name,organisation,email,role,plan,need,users}=enquiry;
 if(!/^[0-9a-f-]{36}$/i.test(id)||![contact_name,organisation,email,role,need,users].every(v=>typeof v==='string'&&v.trim()&&!/[\r\n<>\x00-\x1f\x7f]/.test(v))||!plans[plan]||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid enquiry mail data');
 const summary=`Reference: ${id}\nPlan interest: ${plans[plan]}\nSupport requested: ${need}\nExpected application users: ${users}`;
 const base={sender,replyTo:sender,tags:['navigator-enquiry'],headers:{'X-Mailin-Custom':'navigator-enquiry'}};
 return [
  {kind:'acknowledgement',payload:{...base,to:[{email,name:contact_name}],subject:`Your POSH Inquiry Navigator request — ${id}`,textContent:`Hello ${contact_name},\n\nThank you for your enquiry on behalf of ${organisation}. Your request has been received for private review.\n\n${summary}\n\nWe will review your requirements and contact you about availability, the relevant workflow and the written scope. This acknowledgement does not confirm an appointment, purchase or paid-plan activation.\n\nPlease do not reply with complaint narratives, party identities, witness details or evidence. You can reply with general business requirements or a correction to your enquiry.\n\nThe Cosmic Energizers\n${sender.email}`}},
  {kind:'owner_alert',payload:{...base,to:[{email:owner}],subject:`New Navigator enquiry — ${plans[plan]} — ${id}`,textContent:`A new consented enquiry was saved successfully.\n\nName: ${contact_name}\nOrganisation: ${organisation}\nEmail: ${email}\nRole: ${role}\n${summary}\n\nNext action: review the requirements, confirm availability and offer the appropriate walkthrough or proposal. Record the review status in the private enquiry store.`}}
 ];
}
function createBrevoTransport({apiKey=process.env.BREVO_API_KEY,fetchImpl=fetch}={}){
 return async function send(payload){
  if(!apiKey)return {state:'not_configured'};
  try{
   const response=await fetchImpl('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':apiKey,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
   if(response.status===201){const data=await response.json();return typeof data.messageId==='string'?{state:'accepted',messageId:data.messageId}:{state:'uncertain'};}
   // A timeout/5xx may follow acceptance: hold for authorised delivery verification rather than risk duplicate mail.
   if(response.status===429)return {state:'retry_later'};
   if(response.status>=500)return {state:'uncertain'};
   return {state:'rejected',status:response.status};
  }catch{return {state:'uncertain'};}
 };
}
function createEnquiryMailer({enabled=process.env.ENQUIRY_EMAIL_ENABLED==='true',send=createBrevoTransport(),report=(kind,state)=>console.warn('enquiry_mail',kind,state)}={}){
 return async function notify(enquiry){
  if(!enabled)return;
  // Receipts always remain in the private store. Never retry an uncertain send automatically.
  const messages=buildMessages(enquiry);
  await Promise.all(messages.map(async({kind,payload})=>{try{const result=await send(payload);report(kind,result.state)}catch{report(kind,'uncertain')}}));
 };
}
module.exports={buildMessages,createBrevoTransport,createEnquiryMailer};
