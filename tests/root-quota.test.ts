import {test} from 'node:test';
import assert from 'node:assert/strict';
import {store} from '../src/lib/store';
import {createKey,authenticateKey,consume,usageFor,quotaWindow,quotaCounterOptions} from '../src/lib/api-keys';
import {localUsageEntries} from '../src/lib/usage-ledger';
import {usageAlerts} from '../src/lib/usage-billing';

test('root default workspace and its keys bypass image quota while usage is still recorded',async()=>{
 const mode=process.env.AUTOVISION_DEPLOYMENT_MODE;process.env.AUTOVISION_DEPLOYMENT_MODE='saas';
 try{
  const before=(await store.organizations()).length;assert.equal(await store.singleDeploymentOrgId(),null);assert.equal((await store.organizations()).length,before,'lookup must not create a workspace');
  const root=await store.ensureSingleDeploymentOrg(),key=await createKey(root.id,'synthetic-root-key');
  assert.equal((await authenticateKey('Bearer '+key.key))?.tenantId,root.id);assert.equal((await quotaWindow(root.id)).quotaExempt,true);
  for(let n=0;n<1008;n+=12)assert.equal(await consume(root.id,12),true);
  assert.equal(await consume(root.id,8),true);assert.equal((await usageFor(root.id)).count,1016);assert.equal((await usageFor(root.id)).quotaExempt,true);
  assert.equal(localUsageEntries().filter(e=>e.orgId===root.id&&e.kind==='image').reduce((n,e)=>n+(e.units??0),0),1016);
  assert.equal(await usageAlerts(root.id,{send:async()=>{throw Error('Exempt usage should not produce quota warnings');}}),0);
  await assert.rejects(consume(root.id,13),/Invalid image units/);
  const customer=await store.createOrganization({name:'Root-created customer',ownerId:'root',orgType:'business'});
  assert.equal((await quotaWindow(customer.id)).quotaExempt,false,'root ownership/name must not grant exemption');
  for(let n=0;n<1000;n++)assert.equal(await consume(customer.id),true);
  assert.equal(await consume(customer.id),false);assert.equal((await usageFor(customer.id)).count,1000);
  assert.equal((await store.singleDeploymentOrgId()),root.id);
 }finally{if(mode===undefined)delete process.env.AUTOVISION_DEPLOYMENT_MODE;else process.env.AUTOVISION_DEPLOYMENT_MODE=mode;}
});
test('DynamoDB exempt counters keep metering but have no quota condition or unused operands',()=>{
 assert.deepEqual(quotaCounterOptions(true,8,1000),{ExpressionAttributeNames:{'#count':'count'},ExpressionAttributeValues:{':one':8}});
 const capped=quotaCounterOptions(false,8,1000);assert.ok(capped.ConditionExpression);assert.equal(capped.ExpressionAttributeValues[':remaining'],992);
});
