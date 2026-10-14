import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,PutCommand} from '@aws-sdk/lib-dynamodb';

export type UsageEntry={id:string;runId:string;orgId:string;createdAt:string;kind:'bedrock';modelId:string;status:'started'|'complete'|'failed';inputTokens?:number;outputTokens?:number;cacheReadInputTokens?:number;cacheWriteInputTokens?:number;attempts?:number;durationMs?:number;accounting:'reported'|'unknown';stripeStatus:'not_exported'};
const context=new AsyncLocalStorage<{orgId:string;runId:string}>();
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.AUTOVISION_DYNAMODB_ENDPOINT}),{marshallOptions:{removeUndefinedValues:true}});
const memory=new Map<string,UsageEntry>();
export const withUsageScope=<T>(orgId:string,runId:string,work:()=>Promise<T>)=>context.run({orgId,runId},work);
async function persist(entry:UsageEntry){
 if(process.env.AUTOVISION_TABLE)await db.send(new PutCommand({TableName:process.env.AUTOVISION_TABLE,Item:{pk:'ORG#'+entry.orgId,sk:'METER#'+entry.createdAt+'#'+entry.id,...entry}}));
 else{memory.set(entry.id,structuredClone(entry));if(memory.size>10000)memory.delete(memory.keys().next().value!);}
}
export function localUsageEntries(){return [...memory.values()].map(v=>structuredClone(v));}
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
