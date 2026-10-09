import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getJob,newJob,saveJob} from '../src/lib/jobs';
test('job detail enforces organization, expiration and invalid ID protection',async()=>{
 const job=newJob('detail-a',{kind:'user',id:'root',label:'Root'},'manual',1);
 await saveJob(job);
 assert.equal((await getJob('detail-a',job.id))?.id,job.id);
 assert.equal(await getJob('detail-b',job.id),null);
 assert.equal(await getJob('detail-a','invalid'),null);
 job.ttl=1;await saveJob(job);
 assert.equal(await getJob('detail-a',job.id),null);
});
