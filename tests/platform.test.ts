import{test}from'node:test';import assert from'node:assert/strict';import{alarm,validSignal,ingest}from'../src/lib/signals';import{store}from'../src/lib/store';import{createSession,verifySession}from'../src/lib/session';
test('deterministic alarm and invalid readings',()=>{assert.equal(alarm({device_id:'demo',type:'smoke',value:49}),false);assert.equal(alarm({device_id:'demo',type:'smoke',value:50}),true);assert.equal(validSignal({device_id:'demo',type:'smoke',value:NaN}),false)});
test('signals and incidents remain isolated by organization',async()=>{const a=await store.createOrganization({name:'Synthetic A',ownerId:'test',orgType:'business'}),b=await store.createOrganization({name:'Synthetic B',ownerId:'test',orgType:'business'});await ingest(a.id,'test',{device_id:'demo',type:'smoke',value:80,event_id:'repeatable'});await ingest(a.id,'test',{device_id:'demo',type:'smoke',value:80,event_id:'repeatable'});assert.equal((await store.incidents(a.id)).length,1);assert.equal((await store.incidents(b.id)).length,0)});
test('session signature rejects tampering',async()=>{const s=await createSession({id:'test',username:'synthetic',role:'admin',orgId:'demo',expiresAt:Date.now()+60000},'a'.repeat(32));assert.ok(await verifySession(s,'a'.repeat(32)));assert.equal(await verifySession(s+'tampered','a'.repeat(32)),null)});


import{createKey,authenticateKey,revokeKey,listKeys,fingerprint}from'../src/lib/api-keys';
test('API keys authenticate, revoke, and remain tenant scoped',async()=>{const a=await store.createOrganization({name:'Keys Synthetic A',ownerId:'test',orgType:'business'}),b=await store.createOrganization({name:'Keys Synthetic B',ownerId:'test',orgType:'business'});const v=await createKey(a.id,'Synthetic');assert.equal((await authenticateKey('Bearer '+v.key))?.tenantId,a.id);assert.equal((await listKeys(b.id)).length,0);assert.equal(await revokeKey(b.id,v.hash),false);assert.notEqual(fingerprint(v.key),v.key);assert.equal(await revokeKey(a.id,v.hash),true);assert.equal(await authenticateKey('Bearer '+v.key),null)});


import{consume,usageFor}from'../src/lib/api-keys';
test('free image quota is enforced and usage is tenant scoped',async()=>{const a=await store.createOrganization({name:'Quota Synthetic A',ownerId:'test',orgType:'business'}),b=await store.createOrganization({name:'Quota Synthetic B',ownerId:'test',orgType:'business'});for(let i=0;i<1000;i++)assert.equal(await consume(a.id),true);assert.equal(await consume(a.id),false);assert.equal((await usageFor(a.id)).count,1000);assert.equal((await usageFor(b.id)).count,0)});

