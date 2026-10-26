import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST} from '../src/app/api/v1/jobs/run/route';
import {createSession,sessionCookie} from '../src/lib/session';
import {store} from '../src/lib/store';
import {getJob,listJobs} from '../src/lib/jobs';
const image=Buffer.from([255,216,255,0]).toString('base64');
test('manual runs stream actual events, persist image-free steps, and retain JSON compatibility',async()=>{
 process.env.AUTOVISION_SESSION_SECRET='synthetic-manual-pipeline-session';
 const org=await store.createOrganization({name:'Manual pipeline test',ownerId:'root',orgType:'personal'});
 const token=await createSession({id:'root',username:'root',role:'root',orgId:org.id,expiresAt:Date.now()+60000},process.env.AUTOVISION_SESSION_SECRET),original=globalThis.fetch;
 const req=(stream=false)=>new NextRequest('http://localhost/api/v1/jobs/run',{method:'POST',headers:{Cookie:sessionCookie+'='+token,Origin:'http://localhost','Content-Type':'application/json',...(stream?{Accept:'text/event-stream'}:{})},body:JSON.stringify({image,classify:false,enhanced:false})});
 try{
  globalThis.fetch=async()=>Response.json({engine_version:'5.0.0',thumbnail:image,frames:[{at_ms:0,preview:image,quality:{brightness:20},observations:[],detections:[]}],observations:[],metrics:{latency_ms:1}});
  const response=await POST(req(true));assert.match(response.headers.get('content-type')??'',/text\/event-stream/);
  const events=(await response.text()).split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));
  assert.ok(events.some(e=>e.type==='step.started'&&e.step_id==='perception'));
  const final=events.find(e=>e.type==='run.completed');assert.ok(final?.data?.job_id);
  const saved=await getJob(org.id,final.data.job_id);assert.equal(saved?.status,'complete');const history=saved?.result?.pipeline_events as unknown[];assert.ok(history.length>=3);assert.ok(!JSON.stringify(history).includes(image));assert.ok(!JSON.stringify(history).includes('preview'));
  const json=await POST(req());assert.match(json.headers.get('content-type')??'',/application\/json/);assert.ok((await json.json()).job_id);
  globalThis.fetch=async()=>{throw Error('synthetic offline')};
  const failed=await POST(req(true));assert.match(await failed.text(),/run.failed/);const jobs=await listJobs(org.id);assert.ok(jobs.some(j=>j.status==='failed'&&Array.isArray(j.result?.pipeline_events)));
  assert.equal((await POST(new NextRequest('http://localhost/api/v1/jobs/run',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}))).status,403);
  const cross=req();cross.headers.set('Origin','https://other.example');assert.equal((await POST(cross)).status,403);
 }finally{globalThis.fetch=original;}
});
