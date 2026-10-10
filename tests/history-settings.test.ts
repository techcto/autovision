import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {createSession,sessionCookie} from '../src/lib/session';
import {GET,PUT} from '../src/app/api/v1/settings/route';
import {DELETE} from '../src/app/api/v1/jobs/route';
test('settings are tenant-scoped; purge requires authorization, confirmation and same origin',async()=>{
 process.env.AUTOVISION_SESSION_SECRET='synthetic-history-settings-secret';
 async function headers(orgId:string){return {'Content-Type':'application/json',Cookie:sessionCookie+'='+await createSession({id:'root',username:'root',role:'root',orgId,expiresAt:Date.now()+60000},process.env.AUTOVISION_SESSION_SECRET!)};}
 const a=await headers('settings-a'),b=await headers('settings-b');
 const saved=await PUT(new NextRequest('http://localhost/api/v1/settings',{method:'PUT',headers:a,body:JSON.stringify({objectDetection:{labels:['dog']}})}));assert.equal(saved.status,200);
 assert.deepEqual((await (await GET(new NextRequest('http://localhost/api/v1/settings',{headers:a}))).json()).objectDetection.labels,['dog']);
 assert.notDeepEqual((await (await GET(new NextRequest('http://localhost/api/v1/settings',{headers:b}))).json()).objectDetection.labels,['dog']);
 assert.equal((await DELETE(new NextRequest('http://localhost/api/v1/jobs',{method:'DELETE',headers:{'Content-Type':'application/json'},body:'{}'}))).status,403);
 assert.equal((await DELETE(new NextRequest('http://localhost/api/v1/jobs',{method:'DELETE',headers:a,body:'{}'}))).status,400);
 assert.equal((await DELETE(new NextRequest('http://localhost/api/v1/jobs',{method:'DELETE',headers:{...a,Origin:'https://other.test'},body:JSON.stringify({confirmation:'CLEAR HISTORY'})}))).status,403);
 assert.equal((await DELETE(new NextRequest('http://localhost/api/v1/jobs',{method:'DELETE',headers:a,body:JSON.stringify({confirmation:'CLEAR HISTORY'})}))).status,200);
});
