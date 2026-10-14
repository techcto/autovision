import {test} from 'node:test';
import assert from 'node:assert/strict';
import {store} from '../src/lib/store';
import {consume,quotaWindow,usageFor} from '../src/lib/api-keys';
import {localUsageEntries,measureBedrock,withUsageScope,type UsageEntry} from '../src/lib/usage-ledger';
import {aiCredits,attachOveragePrices,billingSummary,creditWeights,exportUsage,overageValues,reconcileUsage,usageAlerts,validateBilling,AI_METER,IMAGE_METER,type MeterClient} from '../src/lib/usage-billing';
import type {Subscription} from '../src/lib/model';
const withEnv=async(values:Record<string,string|undefined>,work:()=>Promise<void>)=>{const before=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));for(const [k,v] of Object.entries(values))if(v===undefined)delete process.env[k];else process.env[k]=v;try{await work()}finally{for(const [k,v] of Object.entries(before))if(v===undefined)delete process.env[k];else process.env[k]=v}};
const billingEnv={AUTOVISION_DEPLOYMENT_MODE:'saas',AUTOVISION_USAGE_EXPORT:'enabled',STRIPE_IMAGE_OVERAGE_PRICE_ID:'price_image_overage',STRIPE_AI_OVERAGE_PRICE_ID:undefined,AUTOVISION_AI_CREDIT_WEIGHTS_JSON:undefined};
const paid=async(name:string,productId='starter')=>{const org=await store.createOrganization({name,ownerId:'test',orgType:'business'});const sub:Subscription={id:'sub_'+org.id,orgId:org.id,productId,stripeCustomerId:'cus_'+org.id.slice(0,8),stripeSubscriptionId:'sub_'+org.id,status:'active',currentPeriodStart:new Date(Date.now()-86400000).toISOString(),currentPeriodEnd:new Date(Date.now()+29*86400000).toISOString(),updatedAt:new Date().toISOString()};await store.putSubscription(sub);return{org,sub}};
const optIn=async(orgId:string,capUnits:number,overageEnabled=true)=>{const s=await store.settings(orgId);await store.putSettings(orgId,{...s,billing:{overageEnabled,capUnits,alertPercents:[80,100],updatedAt:new Date().toISOString()}})};
const fill=async(orgId:string,units:number)=>{for(let left=units;left>0;left-=Math.min(12,left))assert.equal(await consume(orgId,Math.min(12,left)),true)};
function fakeStripe(fail?:(id:string)=>Error|undefined){const events:{event_name:string;payload:Record<string,string>;identifier:string;timestamp:number}[]=[];const client:MeterClient={billing:{meterEvents:{create:async p=>{const e=fail?.(p.identifier);if(e)throw e;events.push(p);return{}}},meters:{list:async function*(){yield{id:'mtr_img',event_name:IMAGE_METER};yield{id:'mtr_ai',event_name:AI_METER}},listEventSummaries:async function*(id){const name=id==='mtr_img'?IMAGE_METER:AI_METER;yield{aggregated_value:events.filter(e=>e.event_name===name).reduce((n,e)=>n+Number(e.payload.value),0)}}}}};return{client,events}}
const entry=(id:string,kind:'image'|'bedrock',extra:Partial<UsageEntry>):UsageEntry=>({id,runId:'r',orgId:'o',createdAt:'2026-10-14T00:00:0'+id+'.000Z',kind,status:'complete',accounting:'reported',stripeStatus:'not_exported',...extra});

test('only usage beyond the allowance is billable, split exactly at the boundary, per quota counter',()=>{
 const w={version:'v1',included_credits:{},models:{m:{input_per_1k:1000,output_per_1k:0}}};
 const values=overageValues([entry('0','image',{units:50}),entry('7','image',{units:9,quotaKey:'USAGE#2026-10'}),entry('1','image',{units:8,quotaKey:'P'}),entry('2','image',{units:4,quotaKey:'P'}),entry('3','image',{units:5,quotaKey:'P'}),entry('4','bedrock',{modelId:'m',inputTokens:3}),entry('5','bedrock',{modelId:'m',inputTokens:4}),entry('6','bedrock',{modelId:'x',inputTokens:1})],10,5,w);
 assert.deepEqual(['1','2','3'].map(id=>values.get(id)?.value),[0,2,5]);
 assert.equal(values.get('0')?.value,0,'records without a quota counter are never overage');
 assert.equal(values.get('7')?.value,0,'another counter has its own allowance');
 assert.deepEqual(['4','5'].map(id=>values.get(id)?.value),[0,2]);
 assert.equal(values.get('6'),null,'unpriced model is never billed');
});

test('overage needs export enabled, opt-in and a paid plan; the cap is a hard stop',()=>withEnv(billingEnv,async()=>{
 const {org}=await paid('Overage Synthetic');
 assert.match((await quotaWindow(org.id)).key,/^USAGE#P/,'paid plans count per Stripe period');
 await fill(org.id,10000);
 assert.equal(await consume(org.id,1),false,'plan allowance is a hard stop without opt-in');
 await optIn(org.id,10005);
 assert.equal(await consume(org.id,5),true);assert.equal(await consume(org.id,1),false,'cap is a hard stop');
 assert.deepEqual([(await usageFor(org.id)).count,(await usageFor(org.id)).cap],[10005,10005]);
 await withEnv({AUTOVISION_USAGE_EXPORT:undefined},async()=>{assert.equal((await quotaWindow(org.id)).limit,10000,'no overage without a way to bill it')});
 const free=await store.createOrganization({name:'Free Synthetic',ownerId:'test',orgType:'business'});await optIn(free.id,5000);
 await fill(free.id,1000);assert.equal(await consume(free.id,1),false,'free plan never gets overage');
}));

test('admin settings validate cap, alerts, deployment enablement and paid subscription',()=>withEnv(billingEnv,async()=>{
 const sub={productId:'starter',stripeCustomerId:'cus_x',stripeSubscriptionId:'sub_x'} as Subscription;
 assert.deepEqual(validateBilling({overageEnabled:true,capUnits:20000,alertPercents:[100,80,80]},sub).alertPercents,[80,100]);
 assert.throws(()=>validateBilling({overageEnabled:true,capUnits:5000,alertPercents:[]},sub),/between the plan allowance/);
 assert.throws(()=>validateBilling({overageEnabled:true,capUnits:20000,alertPercents:[]},null),/paid subscription/);
 assert.throws(()=>validateBilling({overageEnabled:false,capUnits:2000,alertPercents:[75]},null),/Invalid/);
 await withEnv({AUTOVISION_USAGE_EXPORT:undefined},async()=>assert.throws(()=>validateBilling({overageEnabled:true,capUnits:20000,alertPercents:[]},sub),/not enabled/));
 await withEnv({STRIPE_IMAGE_OVERAGE_PRICE_ID:undefined},async()=>assert.throws(()=>validateBilling({overageEnabled:true,capUnits:20000,alertPercents:[]},sub),/prices are not configured/));
 assert.equal(validateBilling({overageEnabled:false,capUnits:2000,alertPercents:[]},null).overageEnabled,false);
}));

test('opting in attaches the overage price to the subscription once',async()=>withEnv(billingEnv,async()=>{
 const items=[{price:{id:'price_starter'}}],created:{params:unknown;key?:string}[]=[];
 const client={subscriptionItems:{list:async function*(){yield*items},create:async(params:{subscription:string;price:string},options?:{idempotencyKey?:string})=>{created.push({params,key:options?.idempotencyKey});items.push({price:{id:params.price}});return{}}}};
 const sub={stripeSubscriptionId:'sub_attach'} as Subscription;
 assert.deepEqual(await attachOveragePrices(sub,client),['price_image_overage']);
 assert.deepEqual(await attachOveragePrices(sub,client),[]);
 assert.equal(created.length,1);assert.equal(created[0].key,'autovision_overage_sub_attach_price_image_overage');
}));

test('AI credits use versioned weights and never price unknown usage',()=>withEnv({AUTOVISION_AI_CREDIT_WEIGHTS_JSON:JSON.stringify({version:'v1',included_credits:{starter:10},models:{'model-a':{input_per_1k:1,output_per_1k:4}}})},async()=>{
 const w=creditWeights();assert.equal(w?.included_credits.starter,10);
 const base={id:'x',runId:'r',orgId:'o',createdAt:'',kind:'bedrock' as const,status:'complete' as const,stripeStatus:'not_exported' as const};
 assert.equal(aiCredits({...base,modelId:'model-a',inputTokens:1500,outputTokens:300,accounting:'reported'},w),3);
 assert.equal(aiCredits({...base,modelId:'model-a',accounting:'unknown'},w),undefined);
 await withEnv({AUTOVISION_AI_CREDIT_WEIGHTS_JSON:'{"version":"v1","models":{"m":{"input_per_1k":-1,"output_per_1k":1}}}'},async()=>assert.equal(creditWeights(),null));
}));

test('export sends only overage, is idempotent, retries failures and continues after opt-out',()=>withEnv({...billingEnv,AUTOVISION_AI_CREDIT_WEIGHTS_JSON:JSON.stringify({version:'v1',included_credits:{starter:2},models:{'model-a':{input_per_1k:1,output_per_1k:4}}})},async()=>{
 const {org,sub}=await paid('Export Synthetic');const {client,events}=fakeStripe();
 await withEnv({AUTOVISION_USAGE_EXPORT:undefined},async()=>assert.equal((await exportUsage(org.id,client)).status,'disabled'));
 await fill(org.id,9996);await optIn(org.id,20000);
 await withUsageScope(org.id,'run-export',async()=>{await consume(org.id,10);await measureBedrock('model-a',async()=>({usage:{inputTokens:1000,outputTokens:500}}));await measureBedrock('unpriced-model',async()=>({usage:{inputTokens:10,outputTokens:10}}))});
 assert.deepEqual(await exportUsage(org.id,client),{status:'ok',sent:2,unpriced:1,failed:0});
 assert.deepEqual(events.map(e=>[e.event_name,e.payload.value,e.payload.stripe_customer_id]).sort(),[[AI_METER,'1',sub.stripeCustomerId],[IMAGE_METER,'6',sub.stripeCustomerId]],'10 images crossing 10,000 bill 6; 3 credits over 2 included bill 1');
 const ids=new Set(localUsageEntries().filter(e=>e.orgId===org.id).map(e=>e.id));assert.ok(events.every(e=>ids.has(e.identifier)));
 assert.deepEqual(await exportUsage(org.id,client),{status:'ok',sent:0,unpriced:1,failed:0},'exported records are not resent');
 assert.deepEqual((await reconcileUsage(org.id,client)).map(m=>[m.meter,m.ledger,m.stripe,m.difference]),[[IMAGE_METER,6,6,0],[AI_METER,1,1,0]]);
 const summary=await billingSummary(org.id);assert.deepEqual([summary.overage_images,summary.overage_ai_credits,summary.unpriced_ai_calls,summary.pending_records],[6,1,1,0]);
 // Opting out stops new overage but usage already consumed is still billed; failures retry and duplicates count as sent.
 await withUsageScope(org.id,'run-retry',()=>consume(org.id,2));await optIn(org.id,20000,false);
 assert.equal(await consume(org.id,1),false,'opted out: back to a hard stop');
 const flaky=fakeStripe(()=>Object.assign(new Error('Stripe unavailable'),{code:'api_error'}));
 assert.equal((await exportUsage(org.id,flaky.client)).failed,1);
 assert.equal(localUsageEntries().find(e=>e.runId==='run-retry')?.exportAttempts,1);
 assert.equal((await billingSummary(org.id)).retrying_records,1);
 const dupe=fakeStripe(()=>Object.assign(new Error('An event with this identifier already exists'),{code:'resource_already_exists'}));
 assert.equal((await exportUsage(org.id,dupe.client)).failed,0);
 assert.equal(localUsageEntries().find(e=>e.runId==='run-retry')?.stripeStatus,'exported');
}));

test('usage alerts email once per threshold per period, for the allowance and the cap',()=>withEnv(billingEnv,async()=>{
 const {org}=await paid('Alert Synthetic');const sent:string[]=[];const send={send:async(n:{subject:string})=>{sent.push(n.subject);return'ok'}};
 await fill(org.id,8100);
 assert.equal(await usageAlerts(org.id,send),0,'email disabled by default');
 const s=await store.settings(org.id);await store.putSettings(org.id,{...s,notifications:{...s.notifications,emailEnabled:true,recipients:'ops@example.com'}});
 assert.equal(await usageAlerts(org.id,send),1);assert.equal(await usageAlerts(org.id,send),0,'not repeated');
 await optIn(org.id,10500);await fill(org.id,2400);
 assert.equal(await usageAlerts(org.id,send),3,'100% of allowance, 80% and 100% of the cap');
 assert.deepEqual(sent,['AutoVision usage at 80% of your plan allowance','AutoVision usage at 100% of your plan allowance','AutoVision usage at 80% of your spending cap','AutoVision usage at 100% of your spending cap']);
}));

test('usage counted before the Stripe period was stored is never billed as overage (regression)',()=>withEnv(billingEnv,async()=>{
 const {org,sub}=await paid('Period Switch Synthetic');const periodStart=sub.currentPeriodStart!;
 await store.putSubscription({...sub,currentPeriodStart:undefined});
 await withUsageScope(org.id,'before-period',()=>consume(org.id,12));
 assert.match((await quotaWindow(org.id)).key,/^USAGE#\d{4}-\d{2}$/,'month counter until the period is known');
 await store.putSubscription({...sub,currentPeriodStart:periodStart});await optIn(org.id,20000);
 await fill(org.id,9996);await withUsageScope(org.id,'over',()=>consume(org.id,6));
 assert.equal((await usageFor(org.id)).count,10002,'the period counter starts fresh');
 const {client,events}=fakeStripe();await exportUsage(org.id,client);
 assert.deepEqual(events.map(e=>e.payload.value),['2'],'only the 2 images over the period counter are billed');
 assert.equal((await billingSummary(org.id)).overage_images,2);
}));
