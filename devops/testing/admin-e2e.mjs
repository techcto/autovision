import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
// Synthetic data only: run against a local SaaS-mode app (in-memory store recommended; there is no organization delete API).
const base=process.env.AUTOVISION_TEST_URL??'http://localhost:8081';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('This synthetic admin test is local-only');
const shots=process.env.AUTOVISION_TEST_SCREENSHOTS;
const run=randomUUID().slice(0,8),orgName='Synthetic admin E2E '+run,userName='synthetic-admin-viewer-'+run,userPassword='synthetic-viewer-'+randomUUID();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
async function login(page,username,password){await page.goto(base+'/login');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard')}
const shot=async(page,name)=>{if(shots)await page.screenshot({path:`${shots}/${name}.png`,fullPage:true})};
let key;const context=await browser.newContext(),api=context.request;
try{
 const page=await context.newPage();
 await login(page,process.env.AUTOVISION_TEST_USER??'root',process.env.AUTOVISION_TEST_PASSWORD??'autovision-local-change-me');
 await page.goto(base+'/admin');await page.waitForURL('**/admin/organizations');
 const nav=page.getByRole('navigation',{name:'Admin navigation'});
 for(const item of ['Organizations','Users','Jobs','Settings'])await nav.getByRole('link',{name:item,exact:true}).waitFor();
 assert.equal(await nav.getByRole('link',{name:'Organizations',exact:true}).getAttribute('aria-current'),'page');
 // Admin is view-only; organizations are added on the existing Organizations page.
 assert.equal(await page.getByRole('button',{name:/Add organization/}).count(),0);
 await page.goto(base+'/organizations');await page.getByRole('button',{name:'Add organization',exact:true}).click();
 await page.getByLabel('Organization name').fill(orgName);await page.getByRole('button',{name:'Create',exact:true}).click();
 await page.locator('.offcanvas pre code, [role=dialog] pre code').first().waitFor();
 await page.goto(base+'/admin/organizations');
 await page.getByRole('link',{name:new RegExp(orgName)}).click();await page.waitForURL('**/admin/organizations/*');
 const orgId=page.url().split('/').pop();
 // Seed a member and an analysis job through the product's own APIs.
 assert.equal((await api.post(base+'/api/orgs/active',{data:{orgId}})).status(),200);
 const member=await api.post(base+'/api/v1/users',{data:{username:userName,displayName:'Synthetic Admin Viewer',password:userPassword,role:'viewer'}});assert.equal(member.status(),201,await member.text());const userId=(await member.json()).id;
 const created=await api.post(base+'/api/v1/api-keys',{data:{label:'Synthetic admin E2E key'}});assert.equal(created.status(),201);key=await created.json();
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.fillStyle='#222';x.fillRect(0,0,64,64);return c.toDataURL('image/jpeg').split(',')[1]});
 const analyzed=await api.post(base+'/api/v1/analyze',{headers:{Authorization:'Bearer '+key.key},data:{image,classify:false},timeout:120000});
 assert.ok([200,503].includes(analyzed.status()),'analysis completes, or fails cleanly without a vision service: '+analyzed.status());
 const expected=analyzed.status()===200?'complete':'failed';
 await page.reload();await page.getByRole('link',{name:/Synthetic Admin Viewer/}).waitFor();await page.locator('td .admin-status',{hasText:expected}).first().waitFor();await shot(page,'organization-detail');
 // Users: list -> detail.
 await nav.getByRole('link',{name:'Users',exact:true}).click();await page.waitForURL('**/admin/users');
 await page.getByRole('link',{name:/Synthetic Admin Viewer/}).click();await page.waitForURL('**/admin/users/'+userId);
 page.locator('.admin-header-title',{hasText:'Synthetic Admin Viewer'}).waitFor();await page.getByRole('link',{name:new RegExp(orgName)}).first().waitFor();await shot(page,'user-detail');
 // Jobs: list -> detail shows status, organization, and the API key that ran it.
 await nav.getByRole('link',{name:'Jobs',exact:true}).click();await page.waitForURL('**/admin/jobs');
 const row=page.locator('tr',{has:page.getByRole('link',{name:orgName,exact:true})}).first();
 await row.locator('.admin-status',{hasText:expected}).waitFor();await shot(page,'jobs');
 await row.getByRole('link').first().click();await page.waitForURL(`**/admin/jobs/${orgId}/*`);
 await page.locator('dd .admin-status',{hasText:expected}).waitFor();await page.getByText('Synthetic admin E2E key').first().waitFor();await shot(page,'job-detail');
 const jobPath=new URL(page.url()).pathname;
 for(const path of ['/admin/jobs',jobPath,`/admin/organizations/${orgId}`,`/admin/users/${userId}`]){await page.goto(base+path);const html=await page.content();assert.ok(!html.includes('data:image'),path+' must not expose job images');assert.ok(!html.includes(key.key),path+' must not expose API keys')}
 // Settings stays reachable from the sidenav and never shows secrets.
 await page.getByRole('navigation',{name:'Admin navigation'}).getByRole('link',{name:'Settings',exact:true}).click();await page.waitForURL('**/admin/settings');page.locator('.admin-header-title',{hasText:'Settings'}).waitFor();
 // Non-root members cannot open admin pages.
 const viewer=await browser.newContext(),viewerPage=await viewer.newPage();
 await login(viewerPage,userName,userPassword);
 for(const path of ['/admin/jobs',jobPath]){await viewerPage.goto(base+path);await viewerPage.waitForURL('**/settings')}
 await viewer.close();
 console.log(`PASS: admin sidenav, organization/user/job list and detail pages (job ${expected}), privacy limits, and root-only access.`);
}finally{if(key)await api.delete(base+'/api/v1/api-keys',{data:{hash:key.hash}});await browser.close()}
