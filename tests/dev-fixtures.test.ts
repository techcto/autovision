import {test} from 'node:test';
import assert from 'node:assert/strict';
import {devFixturesEnabled,seedDevFixtures} from '../src/lib/dev-fixtures';
import {listJobs} from '../src/lib/jobs';
import {store} from '../src/lib/store';
const keys=['NODE_ENV','AUTOVISION_TABLE','AUTOVISION_DYNAMODB_ENDPOINT','AUTOVISION_DEPLOYMENT_MODE'];
function withEnv<T>(values:Record<string,string|undefined>,fn:()=>T):T{const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const apply=(v:Record<string,string|undefined>)=>{for(const k of keys)if(v[k]===undefined)delete process.env[k];else Object.assign(process.env,{[k]:v[k]})};apply(values);try{return fn()}finally{apply(saved)}}
test('fixtures require private development and never seed SaaS or production',()=>{
 const on=(v:Record<string,string|undefined>)=>withEnv({AUTOVISION_DEPLOYMENT_MODE:'on-premise',...v},devFixturesEnabled);
 assert.equal(on({NODE_ENV:'development'}),true,'private in-memory development');
 assert.equal(on({NODE_ENV:'development',AUTOVISION_TABLE:'local',AUTOVISION_DYNAMODB_ENDPOINT:'http://autovision-dynamodb:8000'}),true,'private development with local DynamoDB');
 for(const mode of ['saas','on-premise'])for(const endpoint of [undefined,'http://autovision-dynamodb:8000','https://dynamodb.us-east-1.amazonaws.com']){
  assert.equal(on({NODE_ENV:'production',AUTOVISION_DEPLOYMENT_MODE:mode,AUTOVISION_TABLE:endpoint?'table':undefined,AUTOVISION_DYNAMODB_ENDPOINT:endpoint}),false,'all production configurations are disabled');
  if(mode==='saas')assert.equal(on({NODE_ENV:'development',AUTOVISION_DEPLOYMENT_MODE:mode,AUTOVISION_TABLE:endpoint?'table':undefined,AUTOVISION_DYNAMODB_ENDPOINT:endpoint}),false,'local SaaS is disabled too');
 }
 assert.equal(on({NODE_ENV:'development',AUTOVISION_TABLE:'prod'}),false,'AWS tables are disabled');
 assert.equal(on({NODE_ENV:'development',AUTOVISION_TABLE:'prod',AUTOVISION_DYNAMODB_ENDPOINT:'https://dynamodb.us-east-1.amazonaws.com'}),false,'remote endpoints are disabled');
 assert.equal(withEnv({NODE_ENV:'development'},devFixturesEnabled),false,'private mode must be explicit');
});
test('dev fixtures seed organizations, users, and jobs once into the in-memory private store',async()=>{
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,{NODE_ENV:'development',AUTOVISION_DEPLOYMENT_MODE:'on-premise'});delete process.env.AUTOVISION_TABLE;delete process.env.AUTOVISION_DYNAMODB_ENDPOINT;
  Object.assign(process.env,{NODE_ENV:'production'});assert.equal(await seedDevFixtures(),false);
  Object.assign(process.env,{NODE_ENV:'development',AUTOVISION_DEPLOYMENT_MODE:'saas'});assert.equal(await seedDevFixtures(),false);
  Object.assign(process.env,{AUTOVISION_DEPLOYMENT_MODE:'on-premise'});
  assert.equal(await seedDevFixtures(),true);
  assert.equal(await seedDevFixtures(),false,'seeding is idempotent per server');
  const northwind=(await store.organizations()).find(o=>o.name==='Northwind Logistics');assert.ok(northwind);
  const jobs=await listJobs(northwind.id);assert.deepEqual(jobs.map(j=>j.status).sort(),['complete','complete','failed','running']);
  const ava=await store.userByName('ava.patel');assert.ok(ava);assert.equal((await store.orgsForUser(ava.id)).length,2);
  assert.ok(jobs.some(j=>j.actor.kind==='user'&&j.actor.id===ava.id),'manual fixture jobs are attributed to fixture users');
 }finally{for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else Object.assign(process.env,{[k]:v})}
});
