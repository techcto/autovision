import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.AUTOVISION_TEST_URL||'http://localhost:8086';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Localhost only');
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'root',password:process.env.AUTOVISION_LOCAL_ROOT_PASSWORD||'autovision-local-change-me'})});assert.equal(login.status,200);
const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; '),headers={Origin:base,Cookie:cookie,'Content-Type':'application/json'};
const created=await fetch(base+'/api/v1/api-keys',{method:'POST',headers,body:JSON.stringify({label:'Local MCP release verification'})});assert.equal(created.status,201);const key=await created.json();
try{
 const bytes=await readFile('public/demo/backyardintruder-poster.jpg');
 const result=await fetch(base+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+key.key,Accept:'application/json, text/event-stream','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'analyze_image',arguments:{image:bytes.toString('base64'),classify:false,enhanced:false},_meta:{progressToken:'local-release'}}})});
 assert.equal(result.status,200);assert.match(result.headers.get('content-type'),/text\/event-stream/);
 const body=await result.text(),messages=body.split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6))),progress=messages.filter(m=>m.method==='notifications/progress'),final=messages.find(m=>m.result?.structuredContent);
 assert.ok(progress.length>=3);assert.ok(final);assert.ok(!final.result.isError);assert.equal(final.result.structuredContent.engine_version,'5.0.0');assert.ok(!final.result.content[0].text.includes('base64'));assert.ok(final.result.structuredContent.next_steps.length>0);assert.ok(progress.every(m=>!JSON.stringify(m).includes('base64')));
 console.log(JSON.stringify({status:'passed',engine:final.result.structuredContent.engine_version,progressNotifications:progress.length,textBytes:Buffer.byteLength(final.result.content[0].text),followupHints:final.result.structuredContent.next_steps.length,liveBedrockUsed:false}));
}finally{const r=await fetch(base+'/api/v1/api-keys',{method:'DELETE',headers,body:JSON.stringify({hash:key.hash})});assert.ok(r.ok,'Revoke local smoke-test API key');}
