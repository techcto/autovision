import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mcpRequest} from '../src/lib/mcp';
import {store} from '../src/lib/store';
import {createKey,revokeKey} from '../src/lib/api-keys';
const image=Buffer.from([255,216,255,0]).toString('base64');
test('MCP sends requested progress before analysis finishes and keeps JSON clients compatible',async()=>{
 const org=await store.createOrganization({name:'MCP progress fixture',ownerId:'root',orgType:'personal'}),key=await createKey(org.id,'MCP progress fixture');
 const fetcher=globalThis.fetch;let release:()=>void=()=>{},blocked=false;
 try{
  globalThis.fetch=async()=>{if(blocked)await new Promise<void>(resolve=>{release=resolve});return Response.json({engine_version:'5.0.0',frames:[{at_ms:0,preview:'data:image/jpeg;base64,'+image,quality:{brightness:20},detections:[{label:'person',score:.8,box:{x:.1,y:.1,width:.2,height:.4}}],observations:[{type:'person',detected:true,value:1}]}],observations:[{type:'person',detected:true,value:1}],metrics:{latency_ms:2}});};
  const req=(progress=false)=>new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer '+key.key,Accept:'application/json, text/event-stream','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'analyze_image',arguments:{image,classify:false,enhanced:false},...(progress?{_meta:{progressToken:0}}:{})}})});
  const json=await mcpRequest(req());assert.match(json.headers.get('content-type')??'',/application\/json/);const plain=await json.json();assert.ok(!plain.result.isError);assert.ok(plain.result.structuredContent.job_id);assert.ok(plain.result.structuredContent.next_steps.some((h:string)=>h.includes('enhance_low_light')));assert.ok(!plain.result.content[0].text.includes('base64'));
  blocked=true;const streaming=await mcpRequest(req(true));assert.match(streaming.headers.get('content-type')??'',/text\/event-stream/);
  const reader=streaming.body!.getReader(),decoder=new TextDecoder();let body='';
  const timeout=AbortSignal.timeout(5000);
  while(!body.includes('OpenCV 5 perception')){const part=await Promise.race([reader.read(),new Promise<never>((_,reject)=>timeout.addEventListener('abort',()=>reject(Error('Progress did not arrive before result')),{once:true}))]);assert.ok(!part.done);body+=decoder.decode(part.value);}
  assert.match(body,/notifications\/progress/);assert.ok(!body.includes('structuredContent'),'progress must arrive before the final result');
  release();blocked=false;
  for(;;){const part=await reader.read();if(part.done)break;body+=decoder.decode(part.value);}
  const messages=body.split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));
  const updates=messages.filter(m=>m.method==='notifications/progress');assert.ok(updates.length>=3);assert.ok(updates.every(m=>m.params.progressToken===0));assert.ok(updates.every((m,i)=>!i||m.params.progress>updates[i-1].params.progress));assert.ok(updates.every(m=>!JSON.stringify(m).includes('base64')));assert.ok(messages.some(m=>m.result?.structuredContent?.job_id));
 }finally{release();globalThis.fetch=fetcher;await revokeKey(org.id,key.hash);}
});
