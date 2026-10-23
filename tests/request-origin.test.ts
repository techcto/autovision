import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {hasAllowedOrigin} from '../src/lib/request-origin';
import {POST as forgotPassword} from '../src/app/api/auth/forgot-password/route';
import {store} from '../src/lib/store';
test('allow Docker external port and HTTPS host without trusting forwarded hosts', () => {
  const check=(origin:string,host='localhost:8081')=>hasAllowedOrigin(new Request('http://localhost:3000/api/demo/analyze',{headers:{origin,host,'x-forwarded-host':'attacker.test'}}));
  assert.equal(check('http://localhost:8081'),true);
  assert.equal(check('https://autovision.dev','autovision.dev'),true);
  for(const origin of ['http://localhost:8082','https://attacker.test','null','file:///tmp/a','http://localhost:8081/path'])assert.equal(check(origin),false);
  assert.equal(hasAllowedOrigin(new Request('http://localhost:3000')),true);
});
test('password reset links use the browser-facing Host, never the container address or X-Forwarded-Host', async () => {
  process.env.AUTOVISION_SESSION_SECRET='synthetic-reset-origin-secret';
  const now=new Date().toISOString(),username='reset@example.com';
  await store.putUser({id:'synthetic-reset-origin-'+Date.now(),username,email:'reset@example.com',displayName:'Synthetic Reset',status:'active',createdAt:now,updatedAt:now},'hash');
  const link=async(headers:Record<string,string>)=>(await (await forgotPassword(new NextRequest('http://0.0.0.0:3000/api/auth/forgot-password',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({username})}))).json()).resetLink as string;
  assert.match(await link({host:'localhost:8081','x-forwarded-host':'attacker.test'}),/^http:\/\/localhost:8081\/login\/reset-password\?token=/);
  assert.match(await link({host:'autovision.dev','x-forwarded-proto':'https'}),/^https:\/\/autovision\.dev\/login\/reset-password\?token=/);
});
