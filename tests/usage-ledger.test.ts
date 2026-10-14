import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withUsageScope,measureBedrock,localUsageEntries} from '../src/lib/usage-ledger';

test('usage accounting isolates organizations and records provider tokens without content',async()=>{
 await Promise.all(['usage-org-a','usage-org-b'].map(org=>withUsageScope(org,'run-'+org,()=>measureBedrock('approved-model',async()=>({usage:{inputTokens:123,outputTokens:45,cacheReadInputTokens:10},$metadata:{attempts:1},secret:'not recorded'})))));
 const records=localUsageEntries().filter(v=>v.runId.startsWith('run-usage-org'));
 assert.equal(records.length,2);
 assert.deepEqual(new Set(records.map(v=>v.orgId)),new Set(['usage-org-a','usage-org-b']));
 for(const record of records){assert.equal(record.inputTokens,123);assert.equal(record.outputTokens,45);assert.equal(record.accounting,'reported');assert.equal(record.stripeStatus,'not_exported');assert.ok(!JSON.stringify(record).includes('not recorded'));}
});
test('failed and missing-token calls are not reported as zero-cost',async()=>{
 await assert.rejects(withUsageScope('usage-org-failure','failed-run',()=>measureBedrock('model',async()=>{throw new Error('provider failure');})),/provider failure/);
 await withUsageScope('usage-org-failure','missing-run',()=>measureBedrock('model',async()=>({})));
 const records=localUsageEntries();
 assert.equal(records.find(v=>v.runId==='failed-run')?.status,'failed');
 assert.equal(records.find(v=>v.runId==='failed-run')?.accounting,'unknown');
 assert.equal(records.find(v=>v.runId==='missing-run')?.inputTokens,undefined);
 assert.equal(records.find(v=>v.runId==='missing-run')?.accounting,'unknown');
});
test('unscoped inference does not create an organization billing record',async()=>{
 const before=localUsageEntries().length;
 await measureBedrock('model',async()=>({usage:{inputTokens:1,outputTokens:1}}));
 assert.equal(localUsageEntries().length,before);
});
