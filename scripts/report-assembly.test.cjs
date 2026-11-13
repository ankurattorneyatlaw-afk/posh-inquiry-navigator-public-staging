'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assemble,validate,choices}=require('../dist/report-assembly.js');
const {getPlanTools}=require('./plan-tools.cjs');
const docx=require('../dist/docx.js');
const allegation={id:'A-001',title:'Meeting comment',conduct:'iii',scope:'Notified remarks at the offsite meeting',outcome:'proved',reasons:'Committee determination R1'};
const sample={route:'statutory',forum:'IC',path:'employee',procedure:'prescribed',employment:'same',respondentEmployer:'ORG-1',settlement:'none',allegations:[allegation],evidence:[],witnesses:[]};
const contents=doc=>doc.flatMap(i=>i.text||i.rows.flat()).join('\n');
const report=overrides=>contents(assemble({...sample,...overrides}));
test('Section 2(n) alone and connected Section 3(2) produce distinct allegation analysis',()=>{
  const only=report();
  assert.match(only,/sexually coloured remarks/);
  assert.doesNotMatch(only,/Section 3\(2\)/);
  const joined=report({allegations:[allegation,{...allegation,id:'A-002',circumstance:'iv',nexus:'Connection N2',outcome:'not-proved'}]});
  assert.equal((joined.match(/Connected circumstance under Section 3\(2\)/g)||[]).length,1);
  assert.match(joined,/hostile work environment.*Connection N2/);
  assert.match(joined,/proved conduct in A-001/);
  assert.match(joined,/unproved allegations or portions identified in A-002/);
});
test('employment relationships preserve the actual second-proviso trigger',()=>{
  assert.match(report(),/Common employer/);
  const cross=report({employment:'different',complainantEmployer:'ORG-2',procedure:'service',rules:'Respondent rules clause 21'});
  assert.match(cross,/Separate employers.*ORG-2.*ORG-1/s);
  assert.match(cross,/Respondent rules clause 21/);
  assert.match(cross,/second proviso to Section 11\(1\) requires an opportunity/);
  assert.doesNotMatch(cross,/seven working days/);
  assert.doesNotMatch(report({employment:'one'}),/second proviso to Section 11\(1\) requires an opportunity/);
});
test('domestic referral, third-party assistance and settlement have route-specific outputs',()=>{
  const domestic=report({forum:'LC',route:'referral',path:'domestic',employment:'one',allegations:[]});
  assert.match(domestic,/prima facie case exists.*within seven days.*Section 11\(2\).*after conviction/);
  assert.doesNotMatch(domestic,/Action on proved findings|Report delivery, implementation and appeal/);
  assert.match(report({route:'referral',path:'third-party',employment:'one',allegations:[]}),/Sections 19\(g\) and 19\(h\)/);
  assert.match(report({route:'conciliation',settlement:'completed',allegations:[]}),/copies supplied to both parties/);
  assert.match(report({settlement:'breach'}),/first-proviso inquiry or police route/);
});
test('evidence, disputed and missing records, role-specific witnesses and coded gates flow into the Word file',()=>{
  const data={...sample,
    allegations:[{...allegation,support:'E-001, W-001',contrary:'E-002 W-002'}],
    evidence:[{id:'E-001',title:'Email',type:'message',status:'disputed',source:'Records officer',authenticity:'Headers checked',custody:'Custodian C-1',annexure:'Folio 8',dispute:'Objection D-1'},
      {id:'E-002',title:'CCTV',type:'media',status:'missing',dispute:'Overwrite verified'}],
    witnesses:['complainant','respondent','committee','committee'].map((source,i)=>({id:'W-00'+(i+1),source,statement:'Statement '+i})),
    audit:{completed:4,gates:[['Competence','pass','R4']]}
  };
  const items=assemble(data);
  assert.deepEqual(items,assemble(data));
  const output=contents(items);
  for(const phrase of ['Annexure E-001','Headers checked','Custodian C-1','Objection D-1','Missing · no enclosure','Overwrite verified','Aggrieved woman: 1 · Respondent: 1 · Committee: 2','Statement 3','4 of 84','Competence'])assert.ok(output.includes(phrase),phrase);
  const bytes=Buffer.from(docx.buildDocx(items[0].text,items,{workflow:true}));
  assert.equal(bytes.readUInt32LE(0),0x04034b50);
  assert.ok(bytes.includes(Buffer.from('word/document.xml')));
  assert.ok(bytes.includes(Buffer.from('Overwrite verified')));
});
test('validation detects contradictory routes, duplicate and missing references and impossible chronology',()=>{
  for(const [overrides,match] of [
    [{path:'domestic'},/Local Committee/],[{settlement:'completed'},/subsisting/],
    [{path:'third-party'},/third party/],[{allegations:[]},/each notified allegation/],
    [{allegations:[{...allegation,support:'E-404'}]},/unknown exhibit/],
    [{evidence:[{id:'A-001'}]},/unique/],
    [{received:'2026-02-30'},/valid date/],
    [{commenced:'2026-05-03',completed:'2026-05-02'},/precedes/],
    [{employment:'different',complainantEmployer:'org-1'},/distinct identifiers/]
  ])assert.match(validate({...sample,...overrides}).join(' '),match);
});
test('preliminary and separate disciplinary records omit statutory finalisation language',()=>{
  assert.doesNotMatch(report({route:'preliminary'}),/Action on proved findings|Report delivery, implementation and appeal/);
  assert.match(report({route:'preliminary'}),/Provisional finding/);
  assert.match(report({route:'disciplinary',section13:'separate'}),/Disciplinary or sector disposition/);
  assert.doesNotMatch(report({route:'disciplinary',section13:'separate'}),/Action on proved findings|Report delivery, implementation and appeal/);
  assert.match(report({indexedReferences:['EV-004'],allegations:[{...allegation,support:'EV-004'}]}),/Supporting record: EV-004/);
  assert.match(report({commenced:'2026-01-01',completed:'2026-05-01'}),/Recorded timing exception/);
  assert.match(report({absence:'yes',interim:'yes'}),/three consecutive absences.*Section 12 written request/s);
});
test('each workspace plan exposes the same report routes with the existing tier controls',()=>{
  for(const plan of ['essential','professional','advanced']){
    const data=getPlanTools(plan);
    assert.equal(data.reportAssembly,plan!=='essential');
    assert.deepEqual(data.legalAudit.reports.map(r=>r.id).sort(),Object.keys(choices.route).sort());
    assert.equal(data.legalAudit.checks.length,84);
    assert.equal(data.legalAudit.gates.length,8);
  }
});

test('entered sentence punctuation is preserved at report sentence boundaries',()=>{
  const text=report({authority:'The order is in IC-01.',limitation:'See the written reasons.',allegations:[{...allegation,complainant:'I asked for it to stop.',respondent:'What was said?',reasons:'Determination R1.'}]});
  assert.match(text,/IC-01\./);
  assert.match(text,/What was said\?/);
  assert.doesNotMatch(text,/\.\.|\?\./);
});

test('all contracted inquiry plans resolve the report tools without adding self-service checkout',()=>{
  for(const [id,label] of [['institutional','Institutional Plus'],['enterprise','Enterprise']]){
    const plan=getPlanTools(id);
    assert.equal(plan.label,label);
    assert.equal(plan.reportAssembly,true);
    assert.equal(require('../dist/plans.js').checkoutPlans[id],undefined);
  }
  assert.equal(getPlanTools('knowledge'),null);
});
test('report pagination uses compact, readable spacing without affecting other Word templates',()=>{
  const items=assemble(sample);
  const compact=Buffer.from(docx.buildDocx(items[0].text,items,{workflow:true,caseReport:true}));
  const standard=Buffer.from(docx.buildDocx(items[0].text,items,{workflow:true}));
  assert.ok(compact.includes(Buffer.from('w:after="90" w:line="288"')));
  assert.ok(standard.includes(Buffer.from('w:after="120" w:line="324"')));
});

test('all five plans preserve core safeguards and add cumulative record-linked depth',()=>{
  const plans=['essential','professional','advanced','institutional','enterprise'];
  const markers=['Procedural decisions and response opportunities','Elements and supporting record','Committee constitution and independence','Issues for review and record map'];
  for(const [index,plan] of plans.entries()){
    const doc=report({plan,reviewRecord:'Folio JR-4 addresses objection O-2.',allegations:[{...allegation,elementRecord:'Exact folio 18 supports this element.'}]});
    assert.match(doc,/Opportunity to respond to findings/);
    assert.match(doc,/Authorisation and restricted custody/);
    for(const [i,marker] of markers.entries())assert.equal(doc.includes(marker),index>i,plan+' '+marker);
    assert.equal(doc.includes('Exact folio 18'),index>=2);
    assert.equal(doc.includes('Folio JR-4'),index===4);
  }
});
test('all seven pathways remain distinct at each plan depth',()=>{
  for(const plan of ['essential','professional','advanced','institutional','enterprise']){
    for(const route of Object.keys(choices.route)){
      const doc=report({plan,route,settlement:route==='conciliation'?'completed':'none',routeDecision:'Reasoned onward decision R-2'});
      assert.ok(doc.startsWith(choices.route[route]),plan+' '+route);
      assert.equal(doc.includes('Assessment and finding for A-001'),['statutory','preliminary','disciplinary','special'].includes(route));
      assert.equal(doc.includes('Report delivery, implementation and appeal'),route==='statutory');
      assert.equal(doc.includes('Reasoned onward decision R-2'),['jurisdiction','referral'].includes(route));
    }
  }
});
test('other representation rights and domestic jurisdiction decisions carry through',()=>{
  assert.match(report({employment:'one',representations:'Response under applicable rule R-1'}),/Other applicable participation and representation rights.*Response under applicable rule R-1/s);
  assert.match(report({route:'jurisdiction',forum:'LC',path:'domestic',employment:'one',routeDecision:'District decision JD-1'}),/District decision JD-1/);
});
