import {randomUUID} from 'node:crypto';
// Resolve detail links beyond the dashboard's most recent 50, always within
// the signed-in organization and the retention window.
export async function getJob(orgId:string,id:string):Promise<Job|null>{
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!process.env.AUTOVISION_TABLE) {
    const job=memory.get(id);
    return job && job.orgId===orgId && job.ttl>Date.now()/1000 ? structuredClone(job) : null;
  }
  let cursor:Record<string,unknown>|undefined;
  do {
    const page = await db.send(new QueryCommand({TableName:process.env.AUTOVISION_TABLE,
      KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',
      FilterExpression:'#id=:id AND #ttl>:now',
      ExpressionAttributeNames:{'#id':'id','#ttl':'ttl'},
      ExpressionAttributeValues:{':pk':'ORG#'+orgId,':prefix':'JOB#',':id':id,':now':Math.floor(Date.now()/1000)},
      ExclusiveStartKey:cursor,Limit:100,ConsistentRead:true}));
    if(page.Items?.length){const {pk,sk,...job}=page.Items[0];void pk;void sk;return job as Job;}
    cursor=page.LastEvaluatedKey;
  }while(cursor);
  return null;
}
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,PutCommand,QueryCommand,DeleteCommand} from '@aws-sdk/lib-dynamodb';
export async function purgeJobs(orgId:string):Promise<number>{
  if(!process.env.AUTOVISION_TABLE){let deleted=0;for(const[id,job]of memory)if(job.orgId===orgId){memory.delete(id);deleted++;}return deleted;}
  let cursor:Record<string,unknown>|undefined,deleted=0;
  do{
    const page=await db.send(new QueryCommand({TableName:process.env.AUTOVISION_TABLE,KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':'ORG#'+orgId,':prefix':'JOB#'},ProjectionExpression:'pk,sk',ExclusiveStartKey:cursor,ConsistentRead:true,Limit:100}));
    for(const item of page.Items??[]){await db.send(new DeleteCommand({TableName:process.env.AUTOVISION_TABLE,Key:{pk:item.pk,sk:item.sk}}));deleted++;}
    cursor=page.LastEvaluatedKey;
  }while(cursor);
  return deleted;
}
export type Actor={kind:'user'|'api_key';id:string;label:string};
export type Job={id:string;orgId:string;createdAt:string;status:'running'|'complete'|'failed';source:'manual'|'rest'|'mcp';actor:Actor;frameCount:number;durationMs?:number;thumbnail?:string;result?:Record<string,unknown>;error?:string;ttl:number};
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.AUTOVISION_DYNAMODB_ENDPOINT}),{marshallOptions:{removeUndefinedValues:true}});
const globalJobs=globalThis as unknown as {autovisionJobs?:Map<string,Job>};
const memory=globalJobs.autovisionJobs??=new Map<string,Job>();
export function newJob(orgId:string,actor:Actor,source:Job['source'],frameCount:number):Job{return{id:randomUUID(),orgId,actor,source,frameCount,status:'running',createdAt:new Date().toISOString(),ttl:Math.floor(Date.now()/1000)+7*86400};}
export async function saveJob(job:Job){if(process.env.AUTOVISION_TABLE)await db.send(new PutCommand({TableName:process.env.AUTOVISION_TABLE,Item:{pk:'ORG#'+job.orgId,sk:'JOB#'+job.createdAt+'#'+job.id,...job}}));else{memory.set(job.id,structuredClone(job));for(const[id,v]of memory)if(v.ttl<Date.now()/1000)memory.delete(id);if(memory.size>1000)memory.delete(memory.keys().next().value!);}}
export async function listJobs(orgId:string):Promise<Job[]>{if(process.env.AUTOVISION_TABLE){const r=await db.send(new QueryCommand({TableName:process.env.AUTOVISION_TABLE,KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':'ORG#'+orgId,':prefix':'JOB#'},ScanIndexForward:false,Limit:50}));return(r.Items??[]).filter(v=>v.ttl>Date.now()/1000).map(v=>{const {pk,sk,...job}=v;void pk;void sk;return job as Job;});}return[...memory.values()].filter(v=>v.orgId===orgId&&v.ttl>Date.now()/1000).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50).map(v=>structuredClone(v));}
