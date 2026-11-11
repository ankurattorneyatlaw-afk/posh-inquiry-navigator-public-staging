'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validate,createKnowledgeAnalytics}=require('./knowledge-analytics.cjs');
const finder=require('../dist/finder.js');
test('knowledge metrics accept only predefined anonymous dimensions',()=>{
 assert.deepEqual(validate({event:'question_open',item:finder.records[0].id,country:'IN'}),{event:'question_open',item:finder.records[0].id,country:'IN'});
 assert.deepEqual(validate({event:'search_topic',item:finder.topics[0],country:'ZZ'}),{event:'search_topic',item:finder.topics[0],country:'ZZ'});
 for(const metric of [
  {event:'question_open',item:'invented-id',country:'IN'},
  {event:'search_topic',item:'person-name/private-case',country:'IN'},
  {event:'search_no_results',item:'raw sensitive search',country:'IN'},
  {event:'question_open',item:finder.records[0].id,country:'XX'},
  {event:'question_open',item:finder.records[0].id,country:'IN',visitorId:'123'}
 ]) assert.throws(()=>validate(metric));
});
test('knowledge tracker is disabled unless explicitly configured',()=>{
 const tracker=createKnowledgeAnalytics({enabled:false,url:'https://example.supabase.co',key:'test'});
 assert.equal(tracker.configured(),false);
});
