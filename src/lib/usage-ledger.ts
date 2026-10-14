import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,PutCommand,QueryCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';

export type UsageEntry={id:string;runId:string;orgId:string;createdAt:string;kind:'bedrock'|'image';modelId?:string;units?:number;quotaKey?:string;status:'started'|'complete'|'failed';inputTokens?:number;outputTokens?:number;cacheReadInputTokens?:number;cacheWriteInputTokens?:number;attempts?:number;durationMs?:number;accounting:'reported'|'unknown';stripeStatus:'not_exported'|'exported';exportAttempts?:number;lastExportError?:string;exportedAt?:string;exportedValue?:number;exportedMeter?:string;creditWeightsVersion?:string};
// Anonymous public demo inference is operator cost; it never uses a customer billing scope.
export const PUBLIC_DEMO_SCOPE='operator.public-demo';
const context=new AsyncLocalStorage<{orgId:string;runId:string}>();
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.AUTOVISION_DYNAMODB_ENDPOINT}),{marshallOptions:{removeUndefinedValues:true}});
const memory=new Map<string,UsageEntry>(),claimed=new Set<string>();
export const withUsageScope=<T>(orgId:string,runId:string,work:()=>Promise<T>)=>context.run({orgId,runId},work);
export const usageKey=(entry:UsageEntry)=>({pk:'ORG#'+entry.orgId,sk:'METER#'+entry.createdAt+'#'+entry.id});
export function rememberLocal(entry:UsageEntry){memory.set(entry.id,structuredClone(entry));if(memory.size>10000)memory.delete(memory.keys().next().value!);}
async function persist(entry:UsageEntry){
 if(process.env.AUTOVISION_TABLE)await db.send(new PutCommand({TableName:process.env.AUTOVISION_TABLE,Item:{...usageKey(entry),...entry}}));
 else rememberLocal(entry);
}
export function localUsageEntries(){return [...memory.values()].map(v=>structuredClone(v));}
// Image units (supplied frames and follow-up passes); consume() writes this in the same transaction as the quota counter.
// quotaKey is the counter the units were charged against, so billing matches exactly what the quota enforced.
export function imageUsage(orgId:string,units:number,quotaKey?:string):UsageEntry{const scope=context.getStore();return{id:randomUUID(),runId:scope?.orgId===orgId?scope.runId:'unscoped',orgId,createdAt:new Date().toISOString(),kind:'image',units,quotaKey,status:'complete',accounting:'reported',stripeStatus:'not_exported'}}
export async function usageEntries(orgId:string,since:string):Promise<UsageEntry[]>{
 if(!process.env.AUTOVISION_TABLE)return localUsageEntries().filter(v=>v.orgId===orgId&&v.createdAt>=since);
 const items:UsageEntry[]=[];let start:Record<string,unknown>|undefined;
 do{const r=await db.send(new QueryCommand({TableName:process.env.AUTOVISION_TABLE,KeyConditionExpression:'pk=:pk AND sk BETWEEN :from AND :to',ExpressionAttributeValues:{':pk':'ORG#'+orgId,':from':'METER#'+since,':to':'METER#~'},ExclusiveStartKey:start}));items.push(...(r.Items??[]) as UsageEntry[]);start=r.LastEvaluatedKey;}while(start);
 return items;
}
export async function markUsage(entry:UsageEntry,fields:Partial<UsageEntry>){
 if(!process.env.AUTOVISION_TABLE){rememberLocal({...entry,...fields});return;}
 const keys=Object.keys(fields).filter(k=>fields[k as keyof UsageEntry]!==undefined);
 await db.send(new UpdateCommand({TableName:process.env.AUTOVISION_TABLE,Key:usageKey(entry),UpdateExpression:'SET '+keys.map((k,i)=>'#k'+i+'=:v'+i).join(','),ExpressionAttributeNames:Object.fromEntries(keys.map((k,i)=>['#k'+i,k])),ExpressionAttributeValues:Object.fromEntries(keys.map((k,i)=>[':v'+i,fields[k as keyof UsageEntry]]))}));
}
// First caller wins; each usage alert threshold is sent once per quota period.
export async function claimOnce(orgId:string,key:string){
 if(!process.env.AUTOVISION_TABLE){if(claimed.has(orgId+key))return false;claimed.add(orgId+key);return true;}
 try{await db.send(new PutCommand({TableName:process.env.AUTOVISION_TABLE,Item:{pk:'ORG#'+orgId,sk:'CLAIM#'+key,createdAt:new Date().toISOString(),ttl:Math.floor(Date.now()/1000)+400*86400},ConditionExpression:'attribute_not_exists(pk)'}));return true}
 catch(e){if(e instanceof Error&&e.name==='ConditionalCheckFailedException')return false;throw e}
}
// Measured totals only: no prices, credits or invoice estimates. Unknown Bedrock usage stays counted as unknown, never zero.
export function summarizeUsage(entries:UsageEntry[]){
 const models:Record<string,{calls:number;input_tokens:number;output_tokens:number;unknown_calls:number}>={};let imageUnits=0;
 for(const e of entries){
  if(e.kind==='image'&&e.status==='complete')imageUnits+=e.units??0;
  if(e.kind==='bedrock'){const m=models[e.modelId??'unknown']??={calls:0,input_tokens:0,output_tokens:0,unknown_calls:0};m.calls++;m.input_tokens+=e.inputTokens??0;m.output_tokens+=e.outputTokens??0;if(e.accounting!=='reported')m.unknown_calls++}
 }
 return{image_units:imageUnits,ai_models:models};
}
// The paid Stripe period when the webhook has stored one; otherwise the current calendar month.
export function usagePeriod(subscription:{currentPeriodStart?:string;currentPeriodEnd?:string}|null){const now=new Date();return{start:subscription?.currentPeriodStart??new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString(),end:subscription?.currentPeriodEnd??null,source:subscription?.currentPeriodStart?'stripe_subscription':'calendar_month'}}
const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:undefined;
export async function measureBedrock<T>(modelId:string,work:()=>Promise<T>):Promise<T>{
 const scope=context.getStore();if(!scope)return work();
 const start=Date.now();
 const entry:UsageEntry={...scope,id:randomUUID(),createdAt:new Date().toISOString(),kind:'bedrock',modelId,status:'started',accounting:'unknown',stripeStatus:'not_exported'};
 // Durable intent before inference. If accounting storage is unavailable, do not start a new AI call.
 await persist(entry);
 let response:T;
 try{response=await work();}catch(error){await persist({...entry,status:'failed',durationMs:Date.now()-start});throw error;}
 const result=response as {usage?:Record<string,unknown>;$metadata?:{attempts?:number}};
 const usage=result.usage;
 await persist({...entry,status:'complete',durationMs:Date.now()-start,inputTokens:count(usage?.inputTokens),outputTokens:count(usage?.outputTokens),cacheReadInputTokens:count(usage?.cacheReadInputTokens),cacheWriteInputTokens:count(usage?.cacheWriteInputTokens),attempts:count(result.$metadata?.attempts),accounting:count(usage?.inputTokens)!==undefined&&count(usage?.outputTokens)!==undefined?'reported':'unknown'});
 return response;
}
