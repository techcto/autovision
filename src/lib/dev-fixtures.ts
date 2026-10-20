import {randomUUID} from 'node:crypto';
import {store} from './store';
import {hashPassword} from './password';
import {listJobs,saveJob,type Job} from './jobs';
import type {MembershipRole,OrgType} from './model';
// Synthetic fixtures are restricted to private development with in-memory or local DynamoDB storage.
// Production builds (including local production previews) and SaaS never seed.
export const devFixturePassword='autovision-dev-fixture';
type FixtureJob=[Job['status'],Job['source'],string,number,number,number];// status, source, run by (username or API key label), frames, duration ms, hours ago
type Fixture={name:string;orgType:OrgType;contactEmail?:string;members:[string,string,MembershipRole][];jobs:FixtureJob[]};
const fixtures:Fixture[]=[
 {name:'Northwind Logistics',orgType:'business',contactEmail:'ops@example.com',members:[['ava.patel','Ava Patel','admin'],['sam.lee','Sam Lee','operator']],jobs:[['complete','manual','ava.patel',12,4200,0.2],['complete','rest','Dock camera integration',1,850,1],['failed','rest','Dock camera integration',1,300,3],['running','mcp','Inspection assistant',24,0,0]]},
 {name:'Riverside Clinic',orgType:'business',contactEmail:'it@example.com',members:[['maria.gomez','Maria Gomez','admin'],['ava.patel','Ava Patel','viewer']],jobs:[['complete','manual','maria.gomez',6,2600,5],['complete','mcp','Front desk assistant',1,1200,26]]},
 {name:'Jordan Kim Studio',orgType:'personal',members:[['jordan.kim','Jordan Kim','admin']],jobs:[['failed','manual','jordan.kim',30,9100,48]]},
];
function localDynamo(){try{return ['localhost','127.0.0.1','autovision-dynamodb'].includes(new URL(process.env.AUTOVISION_DYNAMODB_ENDPOINT??'').hostname)}catch{return false}}
export const devFixturesEnabled=()=>process.env.NODE_ENV==='development'&&process.env.AUTOVISION_DEPLOYMENT_MODE==='on-premise'&&(!process.env.AUTOVISION_TABLE||localDynamo());
export async function seedDevFixtures(){
 const g=globalThis as typeof globalThis&{autovisionDevFixtures?:boolean};
 if(!devFixturesEnabled()||g.autovisionDevFixtures)return false;
 g.autovisionDevFixtures=true;
 const now=Date.now(),iso=(hoursAgo:number)=>new Date(now-hoursAgo*3600000).toISOString();
 // DynamoDB local persists across restarts: organizations and users are created once; jobs expire after 7 days, so they are re-added when none remain.
 const existing=new Map((await store.organizations()).map(o=>[o.name,o]));let seeded=false;
 for(const f of fixtures){
  let org=existing.get(f.name);
  if(!org){
   org=await store.createOrganization({name:f.name,ownerId:'root',orgType:f.orgType,contactEmail:f.contactEmail});seeded=true;
   for(const [username,displayName,role] of f.members){
    let user=await store.userByName(username);
    if(!user){user={id:randomUUID(),username,displayName,status:'active',createdAt:iso(24*30),updatedAt:iso(24*30)};await store.putUser(user,hashPassword(devFixturePassword))}
    await store.putMembership({id:randomUUID(),orgId:org.id,userId:user.id,role,status:'active',createdAt:iso(24*30),updatedAt:iso(24*30)});
   }
  }
  if((await listJobs(org.id)).length)continue;
  for(const [status,source,runBy,frameCount,durationMs,hoursAgo] of f.jobs){
   const user=source==='manual'?await store.userByName(runBy):null,createdAt=iso(hoursAgo);
   const actor:Job['actor']=user?{kind:'user',id:user.id,label:user.displayName}:{kind:'api_key',id:'fixture'+randomUUID().slice(0,6),label:runBy};
   await saveJob({id:randomUUID(),orgId:org.id,createdAt,status,source,actor,frameCount,...(status==='running'?{}:{durationMs}),...(status==='failed'?{error:'Analysis failed'}:{}),...(status==='complete'?{result:{}}:{}),ttl:Math.floor(Date.parse(createdAt)/1000)+7*86400});
   seeded=true;
  }
 }
 if(seeded)console.log(`AutoVision dev fixtures loaded: ${fixtures.length} organizations. Fixture users sign in with password "${devFixturePassword}".`);
 return seeded;
}
