import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {createSession,sessionCookie} from '../src/lib/session';
import {POST as createOrganization,GET as listOrganizations} from '../src/app/api/orgs/route';
import {POST as switchOrganization} from '../src/app/api/orgs/active/route';
test('SaaS root can create and switch organizations; private mode blocks both',async()=>{
 process.env.AUTOVISION_SESSION_SECRET='synthetic-organization-test-session-secret';
 process.env.AUTOVISION_DEPLOYMENT_MODE='saas';
 const token=await createSession({id:'root',username:'root',role:'root',orgId:'synthetic-root',expiresAt:Date.now()+60000},process.env.AUTOVISION_SESSION_SECRET);
 const headers={'Content-Type':'application/json',Cookie:sessionCookie+'='+token};
 const created=await createOrganization(new NextRequest('http://localhost/api/orgs',{method:'POST',headers,body:JSON.stringify({name:'Synthetic organization verification'})}));
 assert.equal(created.status,201);const org=await created.json();
 const listed=await listOrganizations(new NextRequest('http://localhost/api/orgs',{headers}));assert.ok((await listed.json()).some((o:{id:string})=>o.id===org.id));
 const switched=await switchOrganization(new NextRequest('http://localhost/api/orgs/active',{method:'POST',headers,body:JSON.stringify({orgId:org.id})}));assert.equal(switched.status,200);assert.ok(switched.headers.get('set-cookie'));
 process.env.AUTOVISION_DEPLOYMENT_MODE='on-premise';
 assert.equal((await createOrganization(new NextRequest('http://localhost/api/orgs',{method:'POST',headers,body:'{}'}))).status,403);
 assert.equal((await switchOrganization(new NextRequest('http://localhost/api/orgs/active',{method:'POST',headers,body:'{}'}))).status,403);
});
