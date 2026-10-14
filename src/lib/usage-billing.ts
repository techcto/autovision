import {store} from './store';
import {planLimit,quotaWindow,usageFor} from './api-keys';
import {claimOnce,markUsage,usageEntries,usagePeriod,type UsageEntry} from './usage-ledger';
import {notifier,type Notifier} from './notifications';
import type {Settings,Subscription} from './model';
export const IMAGE_METER='autovision_image_units_v1',AI_METER='autovision_ai_credits_v1';
const saas=()=>process.env.AUTOVISION_DEPLOYMENT_MODE==='saas';
// Off by default. Export also gates overage in quotaWindow(), so no extra usage is ever allowed without a way to bill it.
export const usageExportEnabled=()=>saas()&&process.env.AUTOVISION_USAGE_EXPORT==='enabled';
export const overagePrices=()=>({image:process.env.STRIPE_IMAGE_OVERAGE_PRICE_ID||null,ai:process.env.STRIPE_AI_OVERAGE_PRICE_ID||null});

// Versioned token-to-credit weights per approved model, plus AI credits included per plan. No defaults: unpriced AI usage is reported, never exported.
type Weights={version:string;included_credits:Record<string,number>;models:Record<string,{input_per_1k:number;output_per_1k:number}>};
export function creditWeights():Weights|null{
 const raw=process.env.AUTOVISION_AI_CREDIT_WEIGHTS_JSON;if(!raw)return null;
 try{const v=JSON.parse(raw),rate=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1000000;
  if(typeof v?.version!=='string'||!/^[-a-z0-9_.]{1,40}$/i.test(v.version)||!v.models||typeof v.models!=='object'||Object.keys(v.models).length>50||Object.values(v.models).some((m:unknown)=>!rate((m as {input_per_1k?:unknown})?.input_per_1k)||!rate((m as {output_per_1k?:unknown})?.output_per_1k))||(v.included_credits!==undefined&&(typeof v.included_credits!=='object'||Object.values(v.included_credits).some(n=>!Number.isInteger(n)||!rate(n)))))throw Error();
  return{version:v.version,included_credits:v.included_credits??{},models:v.models}}catch{console.error('Invalid AUTOVISION_AI_CREDIT_WEIGHTS_JSON; AI usage stays unpriced');return null}
}
// Whole credits per call, rounded up; undefined when tokens are unknown or the model has no approved weight.
export function aiCredits(entry:UsageEntry,weights:Weights|null){
 if(entry.kind!=='bedrock'||entry.status!=='complete'||entry.accounting!=='reported'||!entry.modelId)return undefined;
 const w=weights?.models[entry.modelId];if(!w)return undefined;
 return Math.ceil(((entry.inputTokens??0)*w.input_per_1k+(entry.outputTokens??0)*w.output_per_1k)/1000);
}
// Billable value of each record: only the part above the allowance, in time order, so included usage is never charged.
// Images are counted per quota counter (quotaKey), exactly as consume() enforced them; records without one are never overage.
// AI credits are counted from the billing period start.
export function overageValues(entries:UsageEntry[],imageAllowance:number,aiAllowance:number,weights:Weights|null,periodStart=''){
 const images=new Map<string,number>();let credits=0;const values=new Map<string,{meter:string;value:number}|null>();
 for(const e of [...entries].filter(e=>e.status==='complete').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))){
  if(e.kind==='image'){if(!e.quotaKey){values.set(e.id,{meter:IMAGE_METER,value:0});continue}const before=images.get(e.quotaKey)??0,after=before+(e.units??0);images.set(e.quotaKey,after);values.set(e.id,{meter:IMAGE_METER,value:Math.max(0,after-imageAllowance)-Math.max(0,before-imageAllowance)})}
  else{if(e.createdAt<periodStart)continue;const c=aiCredits(e,weights);if(c===undefined){values.set(e.id,null);continue}const before=credits;credits+=c;values.set(e.id,{meter:AI_METER,value:Math.max(0,credits-aiAllowance)-Math.max(0,before-aiAllowance)})}
 }
 return values;
}
// Current quota counters start at the earlier of the billing period and the calendar month, so read from there.
const ledgerStart=(periodStart:string)=>{const now=new Date(),month=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString();return periodStart<month?periodStart:month};
export async function billingSummary(orgId:string){
 const subscription=await store.activeSubscriptionForOrg(orgId),period=usagePeriod(subscription),weights=creditWeights();
 const entries=(await usageEntries(orgId,ledgerStart(period.start))).filter(e=>e.status==='complete'),values=overageValues(entries,planLimit(subscription?.productId),weights?.included_credits[subscription?.productId??'dev']??0,weights,period.start);
 let overageImages=0,overageCredits=0,exported=0,pending=0,retrying=0,unpriced=0;
 for(const e of entries){const v=values.get(e.id);if(v===null)unpriced++;else if(v?.meter===IMAGE_METER)overageImages+=v.value;else if(v)overageCredits+=v.value;if(e.stripeStatus==='exported')exported++;else if(v&&v.value>0){pending++;if(e.exportAttempts)retrying++}}
 return{export_enabled:usageExportEnabled(),overage_prices:{image:!!overagePrices().image,ai:!!overagePrices().ai},credit_weights_version:weights?.version??null,overage_images:overageImages,overage_ai_credits:overageCredits,unpriced_ai_calls:unpriced,exported_records:exported,pending_records:pending,retrying_records:retrying};
}

// Admin overage settings. Opting in needs export enabled, a paid Stripe subscription and an image overage price.
export const alertChoices=[50,80,90,100];
export function validateBilling(value:unknown,subscription:Subscription|null):NonNullable<Settings['billing']>{
 const v=value as Record<string,unknown>|null;
 if(!v||typeof v!=='object'||typeof v.overageEnabled!=='boolean'||!Number.isInteger(v.capUnits)||!Array.isArray(v.alertPercents)||v.alertPercents.length>4||v.alertPercents.some(p=>!alertChoices.includes(p as number)))throw Error('Invalid billing settings');
 const plan=planLimit(subscription?.productId),cap=v.capUnits as number;
 if(cap<plan||cap>10000000)throw Error('Cap must be between the plan allowance ('+plan+') and 10,000,000 images');
 if(v.overageEnabled){
  if(!usageExportEnabled())throw Error('Usage-based billing is not enabled on this deployment');
  if(!subscription?.stripeCustomerId||!subscription.stripeSubscriptionId||subscription.productId==='dev')throw Error('Overage requires an active paid subscription');
  if(!overagePrices().image)throw Error('Overage prices are not configured on this deployment');
 }
 return{overageEnabled:v.overageEnabled,capUnits:cap,alertPercents:[...new Set(v.alertPercents as number[])].sort((a,b)=>a-b),updatedAt:new Date().toISOString()};
}
// Adds the per-unit overage prices to the customer's subscription once; Stripe then invoices exported meter usage each period.
export type SubscriptionItemClient={subscriptionItems:{list(params:{subscription:string;limit?:number}):AsyncIterable<{price:{id:string}}>;create(params:{subscription:string;price:string},options?:{idempotencyKey?:string}):Promise<unknown>}};
export async function attachOveragePrices(subscription:Subscription,client:SubscriptionItemClient){
 const wanted=[overagePrices().image,overagePrices().ai].filter((p):p is string=>!!p),present=new Set<string>();
 for await(const item of client.subscriptionItems.list({subscription:subscription.stripeSubscriptionId!,limit:20}))present.add(item.price.id);
 const added=[];for(const price of wanted)if(!present.has(price)){await client.subscriptionItems.create({subscription:subscription.stripeSubscriptionId!,price},{idempotencyKey:'autovision_overage_'+subscription.stripeSubscriptionId+'_'+price});added.push(price)}
 return added;
}

// Minimal Stripe surface so export can be tested without network access.
export type MeterClient={billing:{meterEvents:{create(params:{event_name:string;payload:Record<string,string>;identifier:string;timestamp:number}):Promise<unknown>};meters:{list(params?:{limit?:number}):AsyncIterable<{id:string;event_name:string}>;listEventSummaries(id:string,params:{customer:string;start_time:number;end_time:number}):AsyncIterable<{aggregated_value:number}>}}};
const duplicate=(e:unknown)=>{const v=e as {code?:string;message?:string};return v?.code==='resource_already_exists'||/identifier.*(already|duplicate)|duplicate.*identifier/i.test(v?.message??'')};
// Idempotent outbox: one meter event per ledger record, identified by the record ID, so retries never double count.
// Runs for every paid subscription, including after opt-out, so overage already consumed is still billed.
export async function exportUsage(orgId:string,client:MeterClient){
 if(!usageExportEnabled())return{status:'disabled' as const};
 const subscription=await store.activeSubscriptionForOrg(orgId);if(!subscription?.stripeCustomerId||subscription.productId==='dev')return{status:'no_customer' as const};
 const weights=creditWeights(),period=usagePeriod(subscription),entries=(await usageEntries(orgId,ledgerStart(period.start))).filter(e=>e.status==='complete');
 const values=overageValues(entries,planLimit(subscription.productId),weights?.included_credits[subscription.productId]??0,weights,period.start);
 let sent=0,unpriced=0,failed=0;
 for(const e of entries.filter(e=>e.stripeStatus!=='exported')){
  const v=values.get(e.id);if(v===undefined)continue;if(v===null){unpriced++;continue}
  const done={stripeStatus:'exported' as const,exportedAt:new Date().toISOString(),exportedValue:v.value,exportedMeter:v.meter,creditWeightsVersion:e.kind==='bedrock'?weights?.version:undefined};
  if(v.value===0){await markUsage(e,done);continue}
  try{await client.billing.meterEvents.create({event_name:v.meter,payload:{stripe_customer_id:subscription.stripeCustomerId,value:String(v.value)},identifier:e.id,timestamp:Math.floor(Date.parse(e.createdAt)/1000)});await markUsage(e,done);sent++}
  catch(error){if(duplicate(error)){await markUsage(e,done);continue}failed++;await markUsage(e,{exportAttempts:(e.exportAttempts??0)+1,lastExportError:(error instanceof Error?error.message:'Stripe export failed').slice(0,300)})}
 }
 return{status:'ok' as const,sent,unpriced,failed};
}
// Compares exported ledger values with Stripe meter summaries for the current period. Stripe aggregates with a short delay.
export async function reconcileUsage(orgId:string,client:MeterClient){
 const subscription=await store.activeSubscriptionForOrg(orgId);if(!subscription?.stripeCustomerId)return[];
 const period=usagePeriod(subscription),entries=await usageEntries(orgId,period.start),meters=new Map<string,string>();
 for await(const m of client.billing.meters.list({limit:100}))meters.set(m.event_name,m.id);
 const minute=(ms:number)=>Math.floor(ms/60000)*60,start=minute(Date.parse(period.start)),end=minute(Date.now())+60,result=[];
 for(const meter of [IMAGE_METER,AI_METER]){
  const ledger=entries.filter(e=>e.stripeStatus==='exported'&&e.exportedMeter===meter).reduce((n,e)=>n+(e.exportedValue??0),0),id=meters.get(meter);let stripeTotal:number|null=null;
  if(id){stripeTotal=0;for await(const s of client.billing.meters.listEventSummaries(id,{customer:subscription.stripeCustomerId,start_time:start,end_time:end}))stripeTotal+=s.aggregated_value}
  result.push({meter,ledger,stripe:stripeTotal,difference:stripeTotal===null?null:stripeTotal-ledger});
 }
 return result;
}
// Email once per threshold per quota period, against the plan allowance and, when opted in, the cap.
export async function usageAlerts(orgId:string,send:Notifier=notifier()){
 if(!saas())return 0;
 const settings=await store.settings(orgId),recipients=settings.notifications.recipients.split(',').map(v=>v.trim()).filter(Boolean);
 if(!settings.notifications.emailEnabled||!recipients.length)return 0;
 const usage=await usageFor(orgId),window=await quotaWindow(orgId),percents=settings.billing?.alertPercents??[80,100];let sent=0;
 const limits:[string,number][]=[['plan allowance',usage.limit],...(usage.cap?[['spending cap',usage.cap] as [string,number]]:[])];
 for(const [name,limit] of limits)for(const pct of percents){
  if(usage.count<limit*pct/100||!await claimOnce(orgId,'ALERT#'+window.key+'#'+name+'#'+pct))continue;
  for(const destination of recipients)await send.send({channel:'email',destination,subject:'AutoVision usage at '+pct+'% of your '+name,text:usage.count.toLocaleString('en-US')+' of '+limit.toLocaleString('en-US')+' images used this '+(window.periodStart?'billing period':'month')+'.'+(name==='plan allowance'&&!usage.cap?' Analysis stops at the allowance unless an admin enables usage beyond the plan.':'')});
  sent++;
 }
 return sent;
}
