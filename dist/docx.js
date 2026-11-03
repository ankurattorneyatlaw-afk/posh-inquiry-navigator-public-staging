/* Fully local, dependency-free OOXML/DOCX exporter. ZIP method 0 (valid DOCX).
   Creates genuine, editable MS Word documents. No data leaves the browser. */
(function(root,factory){const api=factory(); if(typeof module==='object'&&module.exports)module.exports=api;root.NavigatorDocx=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const te=new TextEncoder();
  const enc=s=>te.encode(String(s));
  const xml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const p=(text,style)=>`<w:p>${style?`<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`:''}<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
  function table(rows,workflow=false){
    if(!rows?.length)return '';
    const cols=rows[0].length, grids=workflow&&cols===4?[2200,2382,2382,2382]:workflow&&cols===3?[2600,3373,3373]:cols===2?[3200,6146]:cols===3?(rows[0][0]==='REFERENCE'?[1650,3500,4196]:[1320,2450,5576]):cols===4?[1300,2400,2500,3146]:Array(cols).fill(Math.floor(9346/cols));
    const gridXml=`<w:tblGrid>${grids.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="9346" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:color="DDE4EB" w:sz="5"/><w:bottom w:val="single" w:color="DDE4EB" w:sz="5"/><w:insideH w:val="single" w:color="DFE5EB" w:sz="4"/><w:insideV w:val="single" w:color="DFE5EB" w:sz="4"/></w:tblBorders><w:tblCellMar><w:top w:w="105" w:type="dxa"/><w:bottom w:w="105" w:type="dxa"/><w:left w:w="125" w:type="dxa"/><w:right w:w="125" w:type="dxa"/></w:tblCellMar></w:tblPr>${gridXml}${rows.map((r,i)=>`<w:tr><w:trPr><w:cantSplit/>${i===0?'<w:tblHeader/>':''}</w:trPr>${r.map((c,j)=>`<w:tc><w:tcPr><w:tcW w:w="${grids[j]||grids[0]}" w:type="dxa"/>${i===0?'<w:shd w:val="clear" w:fill="172C42"/>':i%2===0?'<w:shd w:val="clear" w:fill="F5F7FA"/>':''}</w:tcPr>${p(c,i===0?'TableHeader':'TableBody')}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
  }
  function crc32(bytes){let c=-1;for(let i=0;i<bytes.length;i++){c^=bytes[i];for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xEDB88320:0);}return (c^-1)>>>0;}
  function u16(n){return [n&255,(n>>>8)&255]}function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
  function zip(files){let parts=[],central=[],offset=0;for(const [name,body]of Object.entries(files)){
    const n=enc(name),b=enc(body),crc=crc32(b),flags=0x0800;
    const local=Uint8Array.from([0x50,0x4b,3,4,...u16(20),...u16(flags),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(b.length),...u32(b.length),...u16(n.length),...u16(0)]);
    parts.push(local,n,b);
    const cd=Uint8Array.from([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(flags),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(b.length),...u32(b.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]);
    central.push(cd,n);offset+=local.length+n.length+b.length;
  }
  const size=central.reduce((a,x)=>a+x.length,0),count=Object.keys(files).length;
  const end=Uint8Array.from([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(count),...u16(count),...u32(size),...u32(offset),...u16(0)]);
  const all=[...parts,...central,end],len=all.reduce((a,x)=>a+x.length,0);let out=new Uint8Array(len),pos=0;for(const part of all){out.set(part,pos);pos+=part.length;}return out;
  }
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos"/><w:sz w:val="21"/><w:color w:val="273444"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="70" w:line="265" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:before="100" w:after="170"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="33"/><w:color w:val="162A42"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:pPr><w:spacing w:before="180" w:after="75"/><w:keepNext/><w:keepLines/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="162A42"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Kicker"><w:name w:val="Kicker"/><w:pPr><w:spacing w:after="45"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="987945"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Metadata"/><w:pPr><w:spacing w:after="70"/></w:pPr><w:rPr><w:sz w:val="19"/><w:color w:val="556679"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table Header"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="19"/><w:color w:val="FFFFFF"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableBody"><w:name w:val="Table Body"/><w:pPr><w:spacing w:after="0"/><w:keepLines/></w:pPr><w:rPr><w:sz w:val="19"/><w:color w:val="26384C"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Notice"><w:name w:val="Draft notice"/><w:pPr><w:spacing w:before="50" w:after="170"/></w:pPr><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="875E2E"/></w:rPr></w:style></w:styles>`;
  const contentTypes=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const docRels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;
  function buildDocx(title,items,options={}){
    const data=items.map(i=>i.type==='pageKicker'?'<w:p><w:pPr><w:pStyle w:val="Kicker"/><w:pageBreakBefore/></w:pPr><w:r><w:t xml:space="preserve">'+xml(i.text)+'</w:t></w:r></w:p>':i.type==='table'?table(i.rows,options.workflow):p(i.text,i.type==='title'?'Title':i.type==='heading'?'Heading1':i.type==='kicker'?'Kicker':i.type==='meta'?'Meta':i.type==='notice'?'Notice':i.type==='th'?'TableHeader':'Normal')).join('');
    const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${data}<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="980" w:right="1280" w:bottom="980" w:left="1280" w:header="620" w:footer="650"/></w:sectPr></w:body></w:document>`;
    const core=`<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:creator>The Cosmic Energizers — POSH Inquiry Navigator</dc:creator><cp:keywords>Confidential draft — editable template</cp:keywords></cp:coreProperties>`;
    const header=`<?xml version="1.0" encoding="UTF-8"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:color="C3A36E"/></w:pBdr></w:pPr><w:r><w:rPr><w:b/><w:color w:val="172C42"/><w:sz w:val="16"/></w:rPr><w:t>THE COSMIC ENERGIZERS  |  POSH INQUIRY NAVIGATOR</w:t></w:r></w:p></w:hdr>`;
    const footer=`<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:color="D9DFE5"/></w:pBdr></w:pPr><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="697889"/></w:rPr><w:t>CONFIDENTIAL  |  EDITABLE DRAFT — NOT SUBMITTED</w:t></w:r></w:p></w:ftr>`;
    return zip({'[Content_Types].xml':contentTypes,'_rels/.rels':rels,'word/document.xml':doc,'word/styles.xml':options.workflow?styles.replace(/w:color w:val="(?:162A42|987945|556679|26384C|875E2E)"/g,'w:color w:val="000000"'):styles,'word/header1.xml':options.workflow?header.replace('172C42','000000'):header,'word/footer1.xml':footer,'word/_rels/document.xml.rels':docRels,'docProps/core.xml':core});
  }
  const item=(type,text)=>({type,text}),head=t=>item('heading',t),para=t=>item('p',t),tbl=rows=>({type:'table',rows});
  const selectionLabels={
    'w.conduct':{physical:'Unwelcome physical contact or advances',favours:'Demands or requests for sexual favours',remarks:'Sexually coloured remarks',pornography:'Showing pornography',nonverbal:'Other unwelcome conduct of a sexual nature',unsure:'Category not yet clear',nonsexual:'No apparent sexual element'},
    'w.circumstances':{promise:'Promise of preferential treatment in employment',detriment:'Threat of detrimental treatment in employment',employment:'Threat concerning present/future employment status',environment:'Interference with work or intimidating/offensive/hostile environment',humiliation:'Humiliating treatment likely to affect health or safety',none:'No Section 3(2) circumstance identified',unsure:'Not sure which Section 3(2) circumstance, if any, applies'},
    'w.relationship':{employee:'Employee',contractor:'Contractor / temporary worker',intern:'Intern / trainee',student:'Student',visitor:'Visitor / applicant',other:'Other / uncertain'},
    'w.nexus':{yes:'Workplace or work-related connection reported',unknown:'Connection uncertain — requires review',no:'No apparent workplace connection reported'},
    'w.dateType':{single:'Single incident indicated',series:'Series of incidents indicated',unsure:'Not yet determined'},
    'w.workforce':{'10plus':'10 or more workers (estimated)',under10:'Fewer than 10 workers (estimated)',unknown:'Not known'},
    'w.againstEmployer':{yes:'Allegation against the employer reported',no:'Not stated to be against employer',unknown:'Not sure'},
    'w.ic':{yes:'IC indicated to exist; formal constitution not verified',no:'IC reported not constituted',unknown:'IC information not available / not verified'}
  };
  const sel=(state,id,fallback='[Not provided]')=>selectionLabels[id]?.[state[id]]||fallback;
  const dateDisplay=iso=>/^\d{4}-\d{2}-\d{2}$/.test(iso||'')?new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}):'[Date not entered]';
  function canConciliate(state) {
    return state['w.conciliation']==='yes' && state['w.conciliationVoluntary']==='yes' &&
      (state['w.filed']==='no' || (state['w.filed']==='yes' && state['w.inquiryStarted']==='no'));
  }
  function forumInstruction(state) {
    if(state['w.againstEmployer']==='yes'||state['w.workforce']==='under10')return 'Local Committee route indicated by Section 6; confirm district and official contact before filing';
    if(state['w.workforce']==='10plus' && state['w.ic']==='no')return 'No IC reportedly constituted despite 10+ workers; forum and receiving authority require urgent verification with the District Officer';
    if(state['w.workforce']==='10plus' && state['w.ic']==='unknown')return '10+ workers; IC appointment/contact not available; verify written order and seek official guidance without delay';
    return 'Verify current IC/LC competence, composition and secure contact before submission';
  }
  function womanComplaint(state){
    let sectionNo=0;
    const sec=t=>head(`${++sectionNo}. ${t}`);
    const submitted=state['w.filed']==='yes';
    const incidentDate=dateDisplay(state['w.lastDate']);
    const conduct=sel(state,'w.conduct','[Describe the alleged unwelcome sexual conduct]');
    const circumstances=Array.isArray(state['w.circumstances'])&&state['w.circumstances'].length
      ?state['w.circumstances'].map(c=>selectionLabels['w.circumstances'][c]||c).join('; ')
      :'[No related circumstances recorded during guidance]';
    const rows=[
      ['PARTICULAR','INFORMATION FROM GUIDANCE / TO COMPLETE'],
      ['Complainant','[Full name, safe address and preferred contact — complete privately]'],
      ['Workplace / establishment','[Employer, work unit, location and district — complete privately]'],
      ['Relationship to workplace',sel(state,'w.relationship')],
      ['Reported conduct',conduct],
      ['Allegation against employer?',sel(state,'w.againstEmployer')],
      ['Approximate workers',sel(state,'w.workforce')],
      ['Internal Committee status',sel(state,'w.ic')],
      ['Proposed receiving forum',forumInstruction(state)],
      ['Respondent(s)','[Identify person(s), position and relevant work relationship]']
    ];
    const chronology=[['INCIDENT','DATE','PLACE & FACTUAL DESCRIPTION'],
      ['1',incidentDate,'[Describe actual words, actions, approximate time/place and why the conduct was unwelcome; complete in your own words.]']];
    if(state['w.dateType']==='series')chronology.push(['Additional events','[Actual incident dates]','[Number separately; distinguish the last alleged sexual-harassment incident from unrelated events.]']);
    const out=[
      item('kicker','CONFIDENTIAL   /   POSH ACT, 2013'),
      item('title','Written Complaint of Alleged Workplace Sexual Harassment'),
      item('notice','EDITABLE PRE-SUBMISSION DRAFT  |  NOT FILED OR ACKNOWLEDGED'),
      para('To: [Presiding Officer, competent Internal Committee / Chairperson, competent Local Committee — confirm correct recipient]'),
      para('Name of workplace / district: [Complete]'),
      para('Date of signing and submission: [Insert only when actually signed/submitted]'),
      para('Subject: Complaint under Section 9 of the POSH Act, 2013 and related requests, where applicable'),
      sec('Parties, workplace and preliminary information'),tbl(rows),
      sec('Statement of allegations and chronology'),
      para('I request the competent Committee to consider the following allegations. The chronology must contain my own actual factual account, not merely the broad categories selected during preliminary guidance.'),
      para(`Incident type selected: ${sel(state,'w.dateType')}.`),tbl(chronology),
      sec('Nature of unwelcome conduct — Section 2(n)'),
      para(`Preliminary category selected: ${conduct}.`),
      para('[Give the actual acts, language or conduct alleged; explain when, how and why unwelcome; distinguish witnessed facts from what others told you. Delete unsupported language.]'),
      sec('Related circumstances — Section 3(2)'),
      para(`Circumstances selected: ${circumstances}.`),
      para('[For each applicable selection, state its factual connection to alleged unwelcome sexual conduct, including any promise, threat, work interference, hostile environment or humiliation. A separate ordinary workplace grievance is not automatically a POSH violation.]'),
      sec('Documents, electronic evidence and potential witnesses'),
      tbl([['REFERENCE','RECORD / PERSON','SOURCE OR SUBJECT'],['E-01','[Existing email/message/CCTV/record, if any]','[Actual source / date]'],['W-01','[Potential witness, if any]','[Incident personally observed, if known]']]),
      para('[Keep the original record wherever lawful. Identify all documents relied upon and include only genuine material.]'),
      sec('Assistance and interim measures, if sought'),
      para(state['w.need']==='protection'||state['w.urgent']==='yes'?'You indicated a protection or safety concern during guidance. [Set out a concrete request, relevant facts and why the measure is needed. The Committee decides what is legally available.]':'[If appropriate, request help preparing a written complaint, evidence preservation, safe contact or consideration of Section 12 interim relief. Delete if irrelevant.]'),
    ];
    if((state['w.workforce']==='10plus'&&['no','unknown'].includes(state['w.ic']))){
      out.push(sec('Receiving Committee information and request for directions'));
      out.push(para(state['w.ic']==='no'
        ?'The preliminary information indicates at least ten workers and that an Internal Committee has not been constituted. [State the source of that information; request identification of a competent authority without presuming Local Committee jurisdiction.]'
        :'The preliminary information indicates at least ten workers, but the current IC constitution order and confidential contact are unavailable to me. [Complete only after checking the actual position.]'));
      out.push(para('[If necessary, submit a SEPARATE short request to employer/HR for the written IC appointment order and secure contact, or seek District Officer guidance. Do not attach intimate allegations to an unrelated recipient solely to obtain contact details.]'));
    }
    out.push(sec('Relevant dates, previous submission and acknowledgement'));
    out.push(para(`Alleged incident / last relevant alleged incident: ${incidentDate}.`));
    if(submitted){
      out.push(para(`Previous written complaint reportedly submitted: ${dateDisplay(state['w.submittedDate'])}. [Give actual recipient, channel and any tracking/acknowledgement. Explain whether this draft is supplementary or replaces an earlier version.]`));
      out.push(para(state['w.acknowledged']==='yes'?'Written acknowledgement was indicated during guidance. [Insert actual acknowledgement date, reference number and copy.]':state['w.acknowledged']==='no'?'No written acknowledgement was reported. I request written confirmation of the actual receipt date and reference number.':'Acknowledgement status not verified. [Check before stating receipt as fact.]'));
    }else out.push(para('[If filing delay may be relevant, describe the actual reasons; an extension under Section 9 requires the competent Committee’s consideration and written reasons. Do not assert automatic extension.]'));
    if(state['w.conciliation']==='yes'){
      out.push(sec('Optional Section 10 conciliation request'));
      if(canConciliate(state))out.push(para('At my voluntary request, and only if no inquiry under Section 11 has yet been initiated, I request the competent Committee to consider conciliation under Section 10. This request is made without treating monetary settlement as its basis. I understand that an actual settlement requires appropriate statutory steps and cannot be presumed from this request.'));
      else out.push(para('I expressed interest in conciliation during preliminary guidance; however, its voluntariness and/or availability before an inquiry began has not been established. THIS PARAGRAPH IS NOT A FORMAL SECTION 10 REQUEST. [Delete or replace only after obtaining advice and confirming the correct stage.]'));
    }
    out.push(
      sec('Requests to the competent Committee'),
      para('I respectfully request that this written complaint be received and dealt with by the competent Internal Committee or Local Committee, as the case may be, in accordance with Section 9 and the applicable provisions of Sections 10 and 11 of the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013 and the relevant Rules. I request a written, date-stamped acknowledgement of actual receipt, confirmation of the competent Committee and secure communication of the next procedural steps. If any preliminary issue relating to jurisdiction or maintainability arises, I request that it be considered and communicated with reasons in accordance with applicable law.'),
      para('Confidentiality — Section 16: I request that the contents of my complaint, the identities and addresses of the parties and witnesses, and information relating to any conciliation or inquiry proceedings be handled in accordance with Section 16 of the Act, without publication, communication or disclosure to the public, press or media, while permitting disclosure and service required for lawful and fair proceedings.'),
      para('Protection against retaliation and intimidation: I request that appropriate safeguards be taken against threats, coercion, victimisation, retaliatory or adverse treatment, and interference with me or witnesses for making or participating in this complaint. I request a safe working environment consistent with Section 19(a) of the Act. Where an inquiry is pending and I make a written request for interim relief, I request consideration by the Committee under Section 12, as applicable. [Specify any actual threats, dates or particular relief sought; delete unsupported assertions.]'),
      sec('Annexures and document schedule'),
      para('Annexure A-01: [Actual description, date and page count].  Annexure A-02: [If applicable].'),
      para('[Check that each annexure is authentic, labelled and actually attached. Follow the applicable complaint-copy and evidence-submission rules.]'),
      sec('Declaration, date and signature'),
      para('I declare that the facts and particulars stated by me in this complaint are true and correct to the best of my knowledge, information and belief. Where I refer to matters learned from others or from records, I have identified their source to the extent known to me. I have not knowingly included any false factual statement or fabricated document. I understand that the competent Committee will independently examine the allegations and evidence.'),
      para('[Before signing: review every statement, date and annexure; correct or remove any unsupported text and complete all applicable placeholders.]'),
      para('Place: [Place]     Date: [Date]     Signature: ________________     Name: [Full name]'),
      item('pageKicker','PERSONAL FOLLOW-UP GUIDE   /   NOT PART OF THE COMPLAINT'),
      item('title','After submitting your complaint'),
      item('notice','REMOVE THIS GUIDANCE PAGE BEFORE SUBMITTING THE COMPLAINT'),
      head('1. Preserve submission and request acknowledgement'),
      para('Save the exact filed version, annexures, transmission proof and a written acknowledgement showing actual receipt date, where available. If none arrives, request a reply through the verified Committee channel. An immediate acknowledgement is recommended good administration; no fixed same-day statutory deadline is claimed.'),
      head('2. Verify the receiving forum'),
      para(forumInstruction(state)+'. The employer must establish the IC where required. If no IC is constituted or no contact is available, promptly seek the District Officer/WCD office’s verified guidance; do not assume that every absent-IC case automatically has LC jurisdiction.'),
      head('3. Understand notice and reply steps under the applicable Rules'),
      para('Under Central Rule 7(2), where applicable, the Committee sends one copy of the complaint to the respondent within seven WORKING days of the Committee’s receipt. The respondent’s written reply under Rule 7(3), where applicable, is due within ten WORKING days after receipt of the specified documents. Applicable service rules must be checked.'),
      head('4. Conciliation is optional and legally timed'),
      para(state['w.conciliation']==='yes'?'You expressed interest in conciliation. Make a separate written Section 10 request only if voluntary and before the inquiry begins. No monetary settlement may be the basis and no settlement is assumed.':'You did not establish a voluntary Section 10 request. Conciliation cannot be imposed; ordinary procedural steps remain available as applicable.'),
      head('5. Track procedural communications'),
      para('Request written reasons if the competent Committee declines to proceed for jurisdictional or other preliminary reasons. Preserve genuine notices, hearing dates and any interim requests. The Committee’s statutory procedure and relevant service rules govern the next steps.'),
      head('6. Maintain confidentiality and safety'),
      para('Do not circulate allegations publicly or upload personal narratives into this prototype. For immediate threats, contact local emergency services. If child sexual-offence reporting duties may arise, seek child-safe assistance promptly.')
    );
    return buildDocx('Confidential — Complaint and separate personal follow-up guide',out);
  }
  function womanConciliation(state){
    if(!canConciliate(state))throw new Error('Conciliation request unavailable: voluntariness or pre-inquiry timing not established');
    return buildDocx('Voluntary Section 10 Conciliation Request — Editable',[
      item('kicker','CONFIDENTIAL   /   SECTION 10 REQUEST'),
      item('title','Voluntary Request for Conciliation'),
      item('notice','EDITABLE DRAFT  |  NOT SUBMITTED  |  NOT A SETTLEMENT'),
      para('To: [Presiding Officer, competent IC / Chairperson, competent LC — verify official recipient]'),
      para('From: [Aggrieved woman’s full name, preferred confidential contact]'),
      para('Organisation / district: [Complete privately]'),
      para(`Complaint submitted: ${state['w.filed']==='yes'?`Reportedly on ${dateDisplay(state['w.submittedDate'])}`:'Not indicated as previously submitted'}. Reference: [If any]`),
      para('Subject: Voluntary request under Section 10 of the POSH Act, 2013'),
      head('1. Request made of my own free choice'),
      para('I voluntarily request that the competent Committee consider conciliation under Section 10 before initiating an inquiry under Section 11, subject to the applicable law and the Committee’s own procedural assessment. This request is not made under pressure or coercion.'),
      head('2. Scope and conditions'),
      para('I understand that monetary settlement cannot be the basis of conciliation. [State any non-monetary conditions you would like considered, if appropriate, without adding allegations or terms that are not your own.]'),
      para('I understand that requesting conciliation does not amount to an agreement or a completed settlement, and that the statutory recording/copy and consequence provisions apply only if a lawful settlement is actually reached.'),
      head('3. Requested communication and confidentiality'),
      para('Please acknowledge this request, confirm the relevant procedural stage, and communicate the Committee’s decision by a secure channel. Please preserve confidentiality as required by law.'),
      head('4. Declaration and signature'),
      para('[Review and amend all text before signing. Use only if the request is actually voluntary and legally timed.]'),
      para('Place: [Place]       Date: [Date]'),
      para('Signature: _____________________   Name: [Complete]'),
      item('meta','Draft generated locally; no request has been transmitted and the Committee has made no decision.')
    ]);
  }
  function respondentReply(state){
    return buildDocx('Confidential — Respondent Written Reply (editable template)',[
      item('title','Response to Allegations — Editable Draft'),para('CONFIDENTIAL | NEUTRAL DRAFT — NOT FILED OR SERVED'),
      para('To: [Presiding Officer / Chairperson, competent Internal / Local Committee]'),para('Case/notice reference: [Enter only after verifying notice]'),para('From: [Respondent name and contact details]'),para('Date: [Date]'),
      head('1. Receipt and preliminary position'),para(`Documents reportedly received: ${state['r.serviceDate']||'[DD Month YYYY / not supplied]'}. [Describe actual receipt, completeness and any reservation objectively; do not assume defective service.]`),
      head('2. Allegation-wise reply'),tbl([['Allegation ref','Allegation as actually received','Response: admit / dispute / unknown','Reasons and supporting references'],['A-01','[Quote or accurately paraphrase allegation]','[State position]','[Specific factual explanation; evidence E-__]'],['A-02','[As applicable]','[State position]','[Specific factual explanation]']]),
      head('3. Documentary and electronic evidence'),tbl([['Ref','Description','Custodian / source','What issue it relates to'],['E-01','[Actual record]','[Custodian]','[A-__]']]),
      head('4. Potential witnesses'),para('[Identify only genuine potential witnesses and facts within their personal knowledge. Do not invent statements or contact witnesses improperly.]'),
      head('5. Procedural clarification, if necessary'),para('[Identify documents requested, relevant hearing difficulty, accessibility needs or properly grounded concerns; separate facts from assumptions.]'),
      head('6. Response and cooperation'),para('[Set out any appropriate requests for opportunity to respond to material and to participate in a fair inquiry. Edit this text to reflect actual circumstances.]'),
      head('7. Annexures'),para('[R-01] [Actual document]. [R-02] [Actual document].'),
      head('8. Verification and signature'),para('I have reviewed this response for factual accuracy and have not knowingly presented fabricated information. [Modify this statement where appropriate.]'),para('Place: [Place]     Date: [Date]'),para('Signature: __________________     Name: [Full name]'),
      head('Important'),para('This tool does not determine guilt, credibility, false complaint, malicious intention, limitation, or the legal outcome. A downloaded draft is not proof of filing.')]);
  }
  function download(blobName,bytes){const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=blobName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
  return {buildDocx,womanComplaint,womanConciliation,canConciliate,respondentReply,download};
});
