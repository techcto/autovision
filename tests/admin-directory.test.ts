import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {directoryJobs,directoryUsers,jobCounts} from '../src/lib/admin';
import {newJob,saveJob} from '../src/lib/jobs';
import {store} from '../src/lib/store';
const now=new Date().toISOString();
test('admin user directory lists each organization member once',async()=>{
 const user={id:randomUUID(),username:'synthetic-admin-'+randomUUID(),displayName:'Synthetic Admin Directory',status:'active' as const,createdAt:now,updatedAt:now};
 await store.putUser(user);
 for(const name of ['Synthetic lab','Synthetic warehouse']){const org=await store.createOrganization({name,ownerId:user.id,orgType:'business'});await store.putMembership({id:randomUUID(),orgId:org.id,userId:user.id,role:'viewer',status:'active',createdAt:now,updatedAt:now})}
 const rows=(await directoryUsers()).filter(r=>r.user.id===user.id);
 assert.equal(rows.length,1);assert.equal(rows[0].organizations,2);
});
test('admin job directory spans organizations and exposes job status only',async()=>{
 const a=await store.createOrganization({name:'Synthetic job org A',ownerId:'root',orgType:'business'}),b=await store.createOrganization({name:'Synthetic job org B',ownerId:'root',orgType:'business'});
 const done={...newJob(a.id,{kind:'user',id:'u1',label:'Synthetic User'},'manual',3),status:'complete' as const,durationMs:900,thumbnail:'data:image/jpeg;base64,private',result:{classification:{summary:'private scene'}}};
 const failed={...newJob(b.id,{kind:'api_key',id:'k1',label:'Synthetic key'},'rest',1),status:'failed' as const,error:'Analysis failed'};
 await saveJob(done);await saveJob(failed);
 const rows=(await directoryJobs()).filter(j=>j.orgId===a.id||j.orgId===b.id);
 assert.equal(rows.length,2);assert.deepEqual(jobCounts(rows),{complete:1,failed:1,running:0});
 const row=rows.find(j=>j.id===done.id)!;
 assert.equal(row.organization,'Synthetic job org A');
 assert.ok(!('thumbnail' in row)&&!('result' in row),'thumbnails and results must never reach admin views');
});
