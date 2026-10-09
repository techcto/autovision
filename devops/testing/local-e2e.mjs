import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.AUTOVISION_TEST_URL??'http://localhost:8081';
if(!['localhost','127.0.0.1','autovision-web'].includes(new URL(base).hostname))throw Error('This smoke test is restricted to the local app');
let executablePath=process.env.CHROMIUM_PATH;
if(!executablePath&&fs.existsSync('/ms-playwright')){for(const folder of fs.readdirSync('/ms-playwright'))for(const path of ['chrome-headless-shell-linux64/chrome-headless-shell','chrome-linux/headless_shell','chrome-linux64/chrome','chrome-linux/chrome']){const candidate='/ms-playwright/'+folder+'/'+path;if(fs.existsSync(candidate))executablePath=candidate;}}
const browser=await chromium.launch({headless:true,executablePath});
try{
 const context=await browser.newContext(),page=await context.newPage();
 const health=await context.request.get(base+'/api/health');assert.equal(health.status(),200);
 await page.goto(base);await page.getByRole('heading',{name:'Give your app a pair of eyes.'}).waitFor();
 await page.getByRole('checkbox',{name:'Include Bedrock AI scene classification'}).uncheck();
 for(const title of ['Dog in the yard','Night-time visitor','Delivery at the door']){await page.getByRole('button',{name:new RegExp(title)}).click();await page.getByText('Analysis complete',{exact:true}).waitFor({timeout:90000});assert.equal(await page.locator('.av-error').count(),0);console.log('Sample passed: '+title);}
 assert.equal((await context.request.get(base+'/api/v1/jobs')).status(),401);
 assert.equal((await context.request.post(base+'/api/auth/signup',{data:{username:'synthetic',password:'synthetic-password',displayName:'Demo'}})).status(),403);
 await page.goto(base+'/login');assert.equal(await page.getByRole('button',{name:'Create account',exact:true}).count(),0);
 await page.getByLabel('Username',{exact:true}).fill('root');await page.getByLabel('Password',{exact:true}).fill('autovision-local-change-me');await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
 assert.equal(await page.getByRole('link',{name:'Payment plans',exact:true}).count(),0);
 await page.getByRole('button',{name:'+ Manual run',exact:true}).click();await page.getByRole('checkbox',{name:'Include Bedrock scene summary'}).uncheck();const manualResponse=page.waitForResponse(r=>r.url().endsWith('/api/v1/jobs/run')&&r.request().method()==='POST');await page.getByRole('button',{name:'Synthetic test',exact:true}).click();const manual=await(await manualResponse).json();assert.ok(manual.job_id);await page.locator('tbody tr').first().waitFor({timeout:90000});
 const jobs=await(await context.request.get(base+'/api/v1/jobs')).json(),manualJob=jobs.find(j=>j.id===manual.job_id);assert.ok(manualJob);assert.equal(manualJob.source,'manual');assert.equal(manualJob.actor.kind,'user');assert.ok(manualJob.thumbnail);assert.equal(manualJob.status,'complete');
 const created=await context.request.post(base+'/api/v1/api-keys',{data:{label:'Synthetic REST/MCP smoke test'}});assert.equal(created.status(),201);const key=await created.json();
 try{
  const init=await context.request.post(base+'/mcp',{headers:{Authorization:'Bearer '+key.key,Accept:'application/json, text/event-stream'},data:{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'local-smoke',version:'1'}}}});assert.equal(init.status(),200);assert.ok((await init.json()).result);
  const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=128;c.height=128;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,128,128);return c.toDataURL('image/jpeg').split(',')[1];});
  const headers={Authorization:'Bearer '+key.key,'Content-Type':'application/json'};
  assert.equal((await context.request.post(base+'/api/v1/analyze',{headers,data:{image,classify:false}})).status(),200);
  const mcp=await context.request.post(base+'/mcp',{headers:{...headers,Accept:'application/json, text/event-stream'},data:{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'analyze_image',arguments:{image,classify:false}}}});assert.equal(mcp.status(),200);const value=await mcp.json();assert.ok(value.result?.structuredContent?.job_id);assert.ok(!value.result?.isError);
  const history=await(await context.request.get(base+'/api/v1/jobs')).json();assert.ok(history.some(j=>j.source==='rest'&&j.actor.kind==='api_key'));assert.ok(history.some(j=>j.source==='mcp'&&j.actor.id===key.hash.slice(0,12)));
 }finally{await context.request.delete(base+'/api/v1/api-keys',{data:{hash:key.hash}});}
 assert.equal((await context.request.post(base+'/mcp',{data:{jsonrpc:'2.0',id:1,method:'tools/list'}})).status(),401);
 for(const path of ['/api-reference','/docs/mcp','/api/openapi'])assert.equal((await context.request.get(base+path)).status(),200);
 console.log('Local E2E passed: samples, root-only login, session jobs, thumbnails, REST/MCP key attribution, revocation and docs');
 await page.screenshot({path:'/tmp/autovision-dashboard-local.png',fullPage:true});
}finally{await browser.close();}
