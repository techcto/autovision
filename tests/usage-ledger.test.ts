import {test} from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {NextRequest} from 'next/server';
import {withUsageScope,measureBedrock,localUsageEntries,summarizeUsage,usagePeriod,PUBLIC_DEMO_SCOPE} from '../src/lib/usage-ledger';
import {consume} from '../src/lib/api-keys';
import {store} from '../src/lib/store';
import {POST as webhook} from '../src/app/api/billing/webhook/route';

test('usage accounting isolates organizations and records provider tokens without content',async()=>{
 await Promise.all(['usage-org-a','usage-org-b'].map(org=>withUsageScope(org,'run-'+org,()=>measureBedrock('approved-model',async()=>({usage:{inputTokens:123,outputTokens:45,cacheReadInputTokens:10},$metadata:{attempts:1},secret:'not recorded'})))));
 const records=localUsageEntries().filter(v=>v.runId.startsWith('run-usage-org'));
 assert.equal(records.length,2);
 assert.deepEqual(new Set(records.map(v=>v.orgId)),new Set(['usage-org-a','usage-org-b']));
 for(const record of records){assert.equal(record.inputTokens,123);assert.equal(record.outputTokens,45);assert.equal(record.accounting,'reported');assert.equal(record.stripeStatus,'not_exported');assert.ok(!JSON.stringify(record).includes('not recorded'));}
});
test('failed and missing-token calls are not reported as zero-cost',async()=>{
 await assert.rejects(withUsageScope('usage-org-failure','failed-run',()=>measureBedrock('model',async()=>{throw new Error('provider failure');})),/provider failure/);
 await withUsageScope('usage-org-failure','missing-run',()=>measureBedrock('model',async()=>({})));
 const records=localUsageEntries();
 assert.equal(records.find(v=>v.runId==='failed-run')?.status,'failed');
 assert.equal(records.find(v=>v.runId==='failed-run')?.accounting,'unknown');
 assert.equal(records.find(v=>v.runId==='missing-run')?.inputTokens,undefined);
 assert.equal(records.find(v=>v.runId==='missing-run')?.accounting,'unknown');
});
test('unscoped inference does not create an organization billing record',async()=>{
 const before=localUsageEntries().length;
 await measureBedrock('model',async()=>({usage:{inputTokens:1,outputTokens:1}}));
 assert.equal(localUsageEntries().length,before);
});
test('SaaS image units are ledger records tied to the run; private installs only count',async()=>{
 const mode=process.env.AUTOVISION_DEPLOYMENT_MODE;process.env.AUTOVISION_DEPLOYMENT_MODE='saas';
 try{
  const org=await store.createOrganization({name:'Image ledger synthetic',ownerId:'test',orgType:'business'});
  assert.equal(await withUsageScope(org.id,'run-images',()=>consume(org.id,3)),true);
  assert.deepEqual(localUsageEntries().filter(v=>v.orgId===org.id).map(v=>[v.kind,v.units,v.runId,v.stripeStatus]),[['image',3,'run-images','not_exported']]);
  process.env.AUTOVISION_DEPLOYMENT_MODE='on-premise';
  assert.equal(await consume(org.id,2),true);
  assert.equal(localUsageEntries().filter(v=>v.orgId===org.id).length,1);
 }finally{if(mode===undefined)delete process.env.AUTOVISION_DEPLOYMENT_MODE;else process.env.AUTOVISION_DEPLOYMENT_MODE=mode}
});
test('usage summary totals images and per-model tokens, keeping unknown usage separate',async()=>{
 await withUsageScope('usage-summary-org','run-summary',async()=>{await measureBedrock('model-a',async()=>({usage:{inputTokens:100,outputTokens:20}}));await measureBedrock('model-a',async()=>({}))});
 const summary=summarizeUsage([...localUsageEntries().filter(v=>v.orgId==='usage-summary-org'),{id:'i',runId:'r',orgId:'usage-summary-org',createdAt:'',kind:'image',units:4,status:'complete',accounting:'reported',stripeStatus:'not_exported'}]);
 assert.equal(summary.image_units,4);
 assert.deepEqual(summary.ai_models['model-a'],{calls:2,input_tokens:100,output_tokens:20,unknown_calls:1});
 assert.equal(usagePeriod(null).source,'calendar_month');
 assert.deepEqual(usagePeriod({currentPeriodStart:'2026-10-01T00:00:00.000Z',currentPeriodEnd:'2026-11-01T00:00:00.000Z'}),{start:'2026-10-01T00:00:00.000Z',end:'2026-11-01T00:00:00.000Z',source:'stripe_subscription'});
});
test('public demo inference is recorded under the operator scope, not a customer',async()=>{
 await withUsageScope(PUBLIC_DEMO_SCOPE,'demo-run',()=>measureBedrock('model',async()=>({usage:{inputTokens:5,outputTokens:5}})));
 assert.equal(localUsageEntries().find(v=>v.runId==='demo-run')?.orgId,'operator.public-demo');
});
test('subscription webhooks store the Stripe billing period from subscription items',async()=>{
 const before={key:process.env.STRIPE_SECRET_KEY,secret:process.env.STRIPE_WEBHOOK_SECRET};process.env.STRIPE_SECRET_KEY='sk_test_synthetic';process.env.STRIPE_WEBHOOK_SECRET='whsec_synthetic';
 try{
  const org=await store.createOrganization({name:'Period synthetic',ownerId:'test',orgType:'business'});
  const payload=JSON.stringify({id:'evt_1',object:'event',type:'customer.subscription.updated',data:{object:{id:'sub_period',object:'subscription',status:'active',customer:'cus_period',metadata:{orgId:org.id,productId:'starter'},items:{data:[{current_period_start:1760400000,current_period_end:1763078400}]}}}});
  const signature=new Stripe('sk_test_synthetic').webhooks.generateTestHeaderString({payload,secret:'whsec_synthetic'});
  assert.equal((await webhook(new NextRequest('http://localhost/api/billing/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload}))).status,200);
  const sub=await store.activeSubscriptionForOrg(org.id);
  assert.equal(sub?.currentPeriodStart,new Date(1760400000*1000).toISOString());assert.equal(sub?.currentPeriodEnd,new Date(1763078400*1000).toISOString());
 }finally{for(const [k,v] of [['STRIPE_SECRET_KEY',before.key],['STRIPE_WEBHOOK_SECRET',before.secret]] as const)if(v===undefined)delete process.env[k];else process.env[k]=v}
});
