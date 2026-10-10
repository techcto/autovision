import {test} from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../src/app/api/v1/faces/route';
import {createKey} from '../src/lib/api-keys';
import {store} from '../src/lib/store';
import {proxy} from '../src/proxy';
import {NextRequest} from 'next/server';
test('stateless face endpoint authenticates, rejects classification and never creates a saved job',async()=>{
 const org=await store.createOrganization({name:'Faces',ownerId:'root',orgType:'personal'}),key=await createKey(org.id,'face-test');
 assert.equal((await proxy(new NextRequest('https://example.test/api/v1/faces'))).headers.get('x-middleware-next'),'1');
 const image=Buffer.from([255,216,255,0]).toString('base64');
 const request=(input:unknown,auth=true)=>new Request('https://example.test/api/v1/faces',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+key.key}:{})},body:JSON.stringify(input)});
 assert.equal((await POST(request({image},false))).status,401);
 assert.equal((await POST(request({image,classify:true}))).status,400);
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json({model_id:'test',frames:[]});const response=await POST(request({image}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');globalThis.fetch=async()=>new Response('',{status:503});assert.equal((await POST(request({image}))).status,503);}finally{globalThis.fetch=original;}
 // The route deliberately bypasses runJob; verify no org-scoped history was created.
 assert.equal((await store.incidents(org.id)).length,0);
});
