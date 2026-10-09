import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const base=process.env.AUTOVISION_TEST_URL??'http://localhost:8081';
if(!['localhost','127.0.0.1','autovision-web'].includes(new URL(base).hostname))throw Error('This test is restricted to local AutoVision');
const image='iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAE0lEQVQI12P8/58BK2BiYBhKEgCSigIOsWPmZgAAAABJRU5ErkJggg=='; // Original synthetic yellow PNG; no customer media.
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.AUTOVISION_ROOT_USER??'root',password:process.env.AUTOVISION_ROOT_PASSWORD??'autovision-local-change-me'})});
assert.equal(login.status,200,'Local root login');
const cookie=login.headers.get('set-cookie').split(';')[0],headers={'Content-Type':'application/json',Cookie:cookie};
const created=await fetch(base+'/api/v1/api-keys',{method:'POST',headers,body:JSON.stringify({label:'Temporary local MCP smoke test'})});
assert.equal(created.status,201);const key=await created.json();
const client=new Client({name:'autovision-local-test',version:'1.0.0'});
let revoked=false;
try{
 await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+key.key}}}));
 const tools=await client.listTools();assert.deepEqual(tools.tools.map(t=>t.name).sort(),['analyze_image','analyze_video_frames']);
 const invalid=await client.callTool({name:'analyze_video_frames',arguments:{frames:[],classify:false}});
 assert.equal(invalid.isError,true,'Invalid frame input must return an MCP tool error');
 const rest=await fetch(base+'/api/v1/analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key.key},body:JSON.stringify({image,classify:false})});
 assert.equal(rest.status,200,'The same API key must authorize REST and MCP');
 assert.ok(tools.tools.every(t=>t.annotations?.readOnlyHint===false));
 const ai=process.env.AUTOVISION_TEST_BEDROCK==='true';
 const single=await client.callTool({name:'analyze_image',arguments:{image,classify:ai}});
 assert.ok(!single.isError,JSON.stringify(single.content));assert.ok(single.structuredContent?.job_id);
 assert.match(single.structuredContent.engine_version, /^5\./, 'REST/MCP core processing must use OpenCV 5');
 if(ai){assert.equal(single.structuredContent.classification.status,'complete');assert.equal(single.structuredContent.classification.model,'us.amazon.nova-lite-v1:0');assert.ok(single.structuredContent.classification.summary);}
 const video=await client.callTool({name:'analyze_video_frames',arguments:{frames:[{image,at_ms:0},{image,at_ms:1000}],classify:false}});
 assert.ok(!video.isError,JSON.stringify(video.content));assert.equal(video.structuredContent.media.frame_count,2);assert.equal(video.structuredContent.media.kind,'sampled_video');
 const jobs=await(await fetch(base+'/api/v1/jobs',{headers:{Cookie:cookie}})).json();
 for(const result of [single,video]){const job=jobs.find(j=>j.id===result.structuredContent.job_id);assert.ok(job);assert.equal(job.source,'mcp');assert.equal(job.actor.kind,'api_key');assert.equal(job.actor.id,key.hash.slice(0,12));assert.equal(job.status,'complete');assert.ok(job.thumbnail);assert.equal((await fetch(base+'/dashboard/jobs/'+job.id,{headers:{Cookie:cookie}})).status,200);}
 const rpc={jsonrpc:'2.0',id:1,method:'tools/list'};
 const request=(extra={})=>fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...extra},body:JSON.stringify(rpc)});
 assert.equal((await request({Cookie:cookie})).status,401,'Session alone is not an MCP API key');
 assert.equal((await request({Authorization:'Bearer '+key.key,Origin:'https://attacker.test'})).status,403);
 assert.equal((await fetch(base+'/api/v1/api-keys',{method:'DELETE',headers,body:JSON.stringify({hash:key.hash})})).status,200);revoked=true;
 assert.equal((await request({Authorization:'Bearer '+key.key})).status,401,'Revoked keys must fail');
 console.log('PASS: SDK discovery, image/video tools, private job details, API-key attribution, session/key separation, foreign-origin rejection, key revocation'+(ai?', real Nova Lite inference':''));
}finally{await client.close();if(!revoked){const cleanup=await fetch(base+'/api/v1/api-keys',{method:'DELETE',headers,body:JSON.stringify({hash:key.hash})});assert.equal(cleanup.status,200,'Temporary test-key cleanup');}}
