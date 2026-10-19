import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {createSession,sessionCookie} from '../src/lib/session';
import {proxy} from '../src/proxy';
const directory=['/admin/organizations','/admin/organizations/synthetic-org','/admin/users','/admin/users/synthetic-user','/admin/jobs','/admin/jobs/synthetic-org/synthetic-job'];
test('admin directory exists only in SaaS mode; admin settings exist in both modes',async()=>{
 const mode=process.env.AUTOVISION_DEPLOYMENT_MODE;
 process.env.AUTOVISION_SESSION_SECRET='synthetic-admin-modes-session-secret';
 const token=await createSession({id:'root',username:'root',role:'root',orgId:'synthetic-root',expiresAt:Date.now()+60000},process.env.AUTOVISION_SESSION_SECRET);
 const get=(path:string)=>proxy(new NextRequest('http://localhost'+path,{headers:{Cookie:sessionCookie+'='+token}}));
 const passes=(r:Response)=>r.headers.get('x-middleware-next')==='1';
 try{
  process.env.AUTOVISION_DEPLOYMENT_MODE='on-premise';
  for(const path of directory)assert.equal((await get(path)).status,404,path+' must not exist in private mode');
  for(const path of ['/admin','/admin/settings'])assert.ok(passes(await get(path)),path+' must stay available in private mode');
  process.env.AUTOVISION_DEPLOYMENT_MODE='saas';
  for(const path of [...directory,'/admin','/admin/settings'])assert.ok(passes(await get(path)),path+' must be routed in SaaS mode');
 }finally{if(mode===undefined)delete process.env.AUTOVISION_DEPLOYMENT_MODE;else process.env.AUTOVISION_DEPLOYMENT_MODE=mode}
});
