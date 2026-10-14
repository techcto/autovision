import {test} from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../src/app/api/v1/analyze/route';
import {mcpRequest} from '../src/lib/mcp';
import {createKey} from '../src/lib/api-keys';
import {getJob} from '../src/lib/jobs';
import {store} from '../src/lib/store';
const image=Buffer.from([255,216,255,0]).toString('base64');
const box={label:'person',score:0.91,box:{x:0.12,y:0.18,width:0.31,height:0.64}};
// Shape returned by the OpenCV 5 YOLOX vision service.
function vision(seen:unknown[]){return async(_url:unknown,init?:RequestInit)=>{const body=JSON.parse(String(init?.body));seen.push(body);return Response.json({frames:body.frames.map((f:{at_ms:number})=>({at_ms:f.at_ms,observations:[{type:'person',value:1,detected:true}],detections:[box]})),observations:[{type:'person',value:1,detected:true},{type:'motion',value:0,detected:false}],engine:'opencv5-motion+yolox',engine_version:'5.0.0',detector_version:'yolox-opencv-zoo-rev-sha256-'+'a'.repeat(64),metrics:{latency_ms:1}});};}
test('detection_labels drive OpenCV YOLOX without classify; Bedrock is limited to package, smoke and fire',async()=>{
 const org=await store.createOrganization({name:'Detection',ownerId:'root',orgType:'personal'}),key=await createKey(org.id,'detection-test'),seen:unknown[]=[];
 const original=globalThis.fetch;
 try{
  globalThis.fetch=vision(seen) as typeof fetch;
  const response=await POST(new Request('https://example.test/api/v1/analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key.key},body:JSON.stringify({image,classify:false,detection_labels:['dog','package']})}));
  assert.equal(response.status,200);
  const result=await response.json();
  assert.deepEqual((seen[0] as {detection_labels:string[]}).detection_labels,['dog','package']);
  assert.deepEqual(result.detection_policy,{labels:['dog','package'],opencv_labels:['person','dog'],ai_labels:['package'],ai_requires_classify:true});
  assert.equal(result.classification.status,'not_requested');
  assert.deepEqual(result.frames[0].detections[0],box);
  assert.equal(result.engine,'opencv5-motion+yolox');
  assert.match(result.detector_version,/sha256-[0-9a-f]{64}$/);
  // Saved job history keeps the same detection shape and metadata.
  const job=await getJob(org.id,result.job_id);
  assert.deepEqual(job?.result?.frames[0].detections[0],box);
  assert.equal(job?.result?.engine,'opencv5-motion+yolox');
 }finally{globalThis.fetch=original;}
});
test('MCP tool results carry the same YOLOX detection shape',async()=>{
 const org=await store.createOrganization({name:'Detection MCP',ownerId:'root',orgType:'personal'}),key=await createKey(org.id,'mcp-test'),seen:unknown[]=[];
 const original=globalThis.fetch;
 try{
  globalThis.fetch=vision(seen) as typeof fetch;
  const response=await mcpRequest(new Request('https://example.test/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+key.key},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'analyze_image',arguments:{image,classify:false,detection_labels:['car']}}})}));
  const body=await response.json();
  assert.equal(body.result.isError,undefined);
  assert.deepEqual(body.result.structuredContent.frames[0].detections[0],box);
  assert.deepEqual(body.result.structuredContent.detection_policy.opencv_labels,['person','car']);
  assert.deepEqual((seen[0] as {detection_labels:string[]}).detection_labels,['car']);
 }finally{globalThis.fetch=original;}
});
test('individual MCP lenses share validated execution, persist evidence and never implicitly delegate crop to AI',async()=>{
 const org=await store.createOrganization({name:'Lens MCP',ownerId:'root',orgType:'personal'}),key=await createKey(org.id,'lens-test');
 const original=globalThis.fetch,seen:unknown[]=[];
 try{
  globalThis.fetch=(async(url,init)=>{
   if(String(url).endsWith('/inspect')){const payload=JSON.parse(String(init?.body));assert.equal(payload.operation,'inspect_region');assert.deepEqual(payload.box,box.box);return Response.json({result:{engine_version:'5.0.0',frames:[{detections:[box]}]}})}
   return vision(seen)(url,init);
  }) as typeof fetch;
  const call=async(name:string,args:unknown)=>{const r=await mcpRequest(new Request('https://example.test/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+key.key},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));return r.json()};
  const body=await call('inspect_region',{frames:[{image,at_ms:0}],frame_index:0,detection_index:0});
  assert.equal(body.result.isError,undefined);const result=body.result.structuredContent;
  assert.equal(result.inspection.status,'tool_complete');assert.equal(result.inspection.review_recommended,true);
  assert.equal(result.privacy.sent_to_bedrock,false);assert.equal((seen[0] as {classify:boolean}).classify,false);
  assert.equal((await getJob(org.id,result.job_id))?.result?.inspection.status,'tool_complete');
  const invalid=await call('inspect_region',{frames:[{image,at_ms:0}],frame_index:0,detection_index:19});assert.equal(invalid.result.isError,true);
  const discovery=await call('list_vision_lenses',{});assert.match(discovery.result.content[0].text,/planned/);
 }finally{globalThis.fetch=original}
});
