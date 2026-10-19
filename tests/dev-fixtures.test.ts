import {test} from 'node:test';
import assert from 'node:assert/strict';
import {devFixturesEnabled,seedDevFixtures} from '../src/lib/dev-fixtures';
import {listJobs} from '../src/lib/jobs';
import {store} from '../src/lib/store';
const keys=['NODE_ENV','AUTOVISION_TABLE','AUTOVISION_DYNAMODB_ENDPOINT','AUTOVISION_DEPLOYMENT_MODE'];
function withEnv<T>(values:Record<string,string|undefined>,fn:()=>T):T{const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const apply=(v:Record<string,string|undefined>)=>{for(const k of keys)if(v[k]===undefined)delete process.env[k];else Object.assign(process.env,{[k]:v[k]})};apply(values);try{return fn()}finally{apply(saved)}}
test('dev fixtures are enabled only for npm run dev or the local docker DynamoDB in SaaS mode, never AWS',()=>{
 const on=(v:Record<string,string|undefined>)=>withEnv({AUTOVISION_DEPLOYMENT_MODE:'saas',...v},devFixturesEnabled);
 assert.equal(on({NODE_ENV:'development'}),true,'npm run dev with the in-memory store');
 assert.equal(on({NODE_ENV:'production',AUTOVISION_TABLE:'autovision-local',AUTOVISION_DYNAMODB_ENDPOINT:'http://autovision-dynamodb:8000'}),true,'local docker stack');
 assert.equal(on({NODE_ENV:'production'}),false,'production build without a table');
 assert.equal(on({NODE_ENV:'development',AUTOVISION_TABLE:'autovision-prod'}),false,'AWS tables have no endpoint override');
 assert.equal(on({NODE_ENV:'production',AUTOVISION_TABLE:'autovision-prod',AUTOVISION_DYNAMODB_ENDPOINT:'https://dynamodb.us-east-1.amazonaws.com'}),false,'remote endpoints are never seeded');
 assert.equal(withEnv({NODE_ENV:'development'},devFixturesEnabled),false,'private mode is never seeded');
 assert.equal(withEnv({AUTOVISION_DEPLOYMENT_MODE:'on-premise',NODE_ENV:'production',AUTOVISION_TABLE:'autovision-local',AUTOVISION_DYNAMODB_ENDPOINT:'http://autovision-dynamodb:8000'},devFixturesEnabled),false,'private local docker stack is never seeded');
});
test('dev fixtures seed organizations, users, and jobs once into the in-memory SaaS store',async()=>{
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,{NODE_ENV:'development',AUTOVISION_DEPLOYMENT_MODE:'saas'});delete process.env.AUTOVISION_TABLE;delete process.env.AUTOVISION_DYNAMODB_ENDPOINT;
  assert.equal(await seedDevFixtures(),true);
  assert.equal(await seedDevFixtures(),false,'seeding is idempotent per server');
  const northwind=(await store.organizations()).find(o=>o.name==='Northwind Logistics');assert.ok(northwind);
  const jobs=await listJobs(northwind.id);assert.deepEqual(jobs.map(j=>j.status).sort(),['complete','complete','failed','running']);
  const ava=await store.userByName('ava.patel');assert.ok(ava);assert.equal((await store.orgsForUser(ava.id)).length,2);
  assert.ok(jobs.some(j=>j.actor.kind==='user'&&j.actor.id===ava.id),'manual fixture jobs are attributed to fixture users');
 }finally{for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else Object.assign(process.env,{[k]:v})}
});
