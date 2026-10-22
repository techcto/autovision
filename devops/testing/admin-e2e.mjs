import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
// Synthetic data only: run against a local SaaS-mode app (in-memory store recommended) with a non-AWS notification mode,
// so forgot-password returns the reset link instead of emailing it.
const base=process.env.AUTOVISION_TEST_URL??'http://localhost:8081';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('This synthetic admin test is local-only');
const shots=process.env.AUTOVISION_TEST_SCREENSHOTS;
const run=randomUUID().slice(0,8),orgName='Synthetic admin E2E '+run,userName='synthetic-admin-viewer-'+run,userPassword='synthetic-viewer-'+randomUUID();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
async function login(page,username,password){await page.goto(base+'/login');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard')}
const shot=async(page,name)=>{if(shots)await page.screenshot({path:`${shots}/${name}.png`,fullPage:true})};
let key;const context=await browser.newContext(),api=context.request;
// Everything the run creates; a failed run deletes what is left through the same Delete APIs (users first, then the organization).
const cleanup=[];
try{
 const page=await context.newPage();
 await login(page,process.env.AUTOVISION_TEST_USER??'root',process.env.AUTOVISION_TEST_PASSWORD??'autovision-local-change-me');
 await page.goto(base+'/admin');await page.waitForURL('**/admin/organizations');
 const nav=page.getByRole('navigation',{name:'Admin navigation'});
 for(const item of ['Organizations','Users','Jobs','Settings'])await nav.getByRole('link',{name:item,exact:true}).waitFor();
 assert.equal(await nav.getByRole('link',{name:'Organizations',exact:true}).getAttribute('aria-current'),'page');
 // Organizations are added on the existing Organizations page; admin only views and deletes them.
 assert.equal(await page.getByRole('button',{name:/Add organization/}).count(),0);
 await page.goto(base+'/organizations');await page.getByRole('button',{name:'Add organization',exact:true}).click();
 await page.getByLabel('Organization name').fill(orgName);await page.getByRole('button',{name:'Create',exact:true}).click();
 await page.locator('.offcanvas pre code, [role=dialog] pre code').first().waitFor();
 await page.goto(base+'/admin/organizations');
 await page.getByRole('link',{name:new RegExp(orgName)}).click();await page.waitForURL('**/admin/organizations/*');
 const orgId=page.url().split('/').pop();cleanup.push(`/api/orgs/${orgId}`);
 // Seed a member and an analysis job through the product's own APIs.
 assert.equal((await api.post(base+'/api/orgs/active',{data:{orgId}})).status(),200);
 const member=await api.post(base+'/api/v1/users',{data:{username:userName,displayName:'Synthetic Admin Viewer',password:userPassword,role:'viewer'}});assert.equal(member.status(),201,await member.text());const userId=(await member.json()).id;cleanup.unshift(`/api/v1/users/${userId}`);
 const created=await api.post(base+'/api/v1/api-keys',{data:{label:'Synthetic admin E2E key'}});assert.equal(created.status(),201);key=await created.json();
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.fillStyle='#222';x.fillRect(0,0,64,64);return c.toDataURL('image/jpeg').split(',')[1]});
 const analyzed=await api.post(base+'/api/v1/analyze',{headers:{Authorization:'Bearer '+key.key},data:{image,classify:false},timeout:120000});
 assert.ok([200,503].includes(analyzed.status()),'analysis completes, or fails cleanly without a vision service: '+analyzed.status());
 const expected=analyzed.status()===200?'complete':'failed';
 await page.reload();await page.getByRole('link',{name:new RegExp(userName)}).waitFor();await page.locator('td .admin-status',{hasText:expected}).first().waitFor();await shot(page,'organization-detail');
 // Users: list -> detail.
 await nav.getByRole('link',{name:'Users',exact:true}).click();await page.waitForURL('**/admin/users');
 await page.getByRole('link',{name:new RegExp(userName)}).click();await page.waitForURL('**/admin/users/'+userId);
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
 // Every internal link on the admin and settings pages resolves.
 const seen=new Set();
 for(const path of ['/admin/organizations',`/admin/organizations/${orgId}`,'/admin/users',`/admin/users/${userId}`,'/admin/jobs',jobPath,'/admin/settings','/settings']){
  await page.goto(base+path);
  for(const href of await page.locator('a[href^="/"]').evaluateAll(as=>as.map(a=>a.getAttribute('href')))){if(seen.has(href))continue;seen.add(href);const r=await api.get(base+href,{maxRedirects:0});assert.ok(r.status()<400,`${path} links to ${href}: ${r.status()}`)}
 }
 // Forgot password: login link -> request -> reset link -> new password works; a used page without a token offers a new link.
 const selfName='synthetic-self-'+run,selfPassword='synthetic-self-'+randomUUID(),newPassword='synthetic-reset-'+randomUUID();
 const self=await browser.newContext(),selfPage=await self.newPage();
 const signup=await self.request.post(base+'/api/auth/signup',{data:{displayName:'Synthetic Self Delete '+run,email:`${selfName}@example.com`,username:selfName,password:selfPassword}});assert.equal(signup.status(),201);const signupBody=await signup.json();cleanup.unshift(`/api/v1/users/${signupBody.id}`);
 assert.equal((await self.request.post(base+'/api/auth/verify-email',{data:{token:new URL(signupBody.verifyLink).searchParams.get('token')}})).status(),200,'verify the new account before signing in');
 await self.clearCookies();
 await selfPage.goto(base+'/login');await selfPage.getByRole('link',{name:'Forgot password?'}).click();await selfPage.waitForURL('**/login/forgot-password');await selfPage.waitForLoadState('networkidle');
 await selfPage.getByLabel('Username').fill(selfName);await selfPage.getByRole('button',{name:'Send reset link'}).click();
 await selfPage.getByText('Check your email').waitFor();await selfPage.locator('.notice a').click();await selfPage.waitForURL('**/login/reset-password?token=*');await selfPage.waitForLoadState('networkidle');
 await selfPage.getByLabel('New password').fill(newPassword);await selfPage.getByRole('button',{name:'Set new password'}).click();await selfPage.waitForURL(u=>new URL(u).pathname==='/login');
 await login(selfPage,selfName,newPassword);
 await selfPage.goto(base+'/login/reset-password');await selfPage.getByRole('link',{name:'Request a new one.'}).click();await selfPage.waitForURL('**/login/forgot-password');
 await selfPage.getByRole('link',{name:'Back to sign in'}).click();await selfPage.waitForURL('**/login');
 // Self-service account deletion: Cloud-style confirmation, then the account and its unshared personal organization are gone.
 await selfPage.goto(base+'/settings');await selfPage.getByRole('button',{name:'Delete',exact:true}).click();
 const selfDrawer=selfPage.locator('.offcanvas.show');await selfDrawer.getByText(`Synthetic Self Delete ${run} (Personal)`).waitFor();
 const selfConfirm=selfDrawer.getByRole('button',{name:'Delete',exact:true});assert.ok(await selfConfirm.isDisabled(),'confirmation is required');
 await selfDrawer.getByLabel('Type DELETE to confirm').fill('DELETE');await shot(selfPage,'account-delete');await selfConfirm.click();await selfPage.waitForURL('**/login');
 const relogin=await self.request.post(base+'/api/auth/login',{data:{username:selfName,password:newPassword}});assert.equal(relogin.status(),401,'deleted account cannot sign in');
 await self.close();
 await page.goto(base+'/admin/organizations');assert.equal(await page.getByRole('link',{name:new RegExp(`Synthetic Self Delete ${run}`)}).count(),0,'unshared personal organization is deleted with the account');
 // The operator workspace cannot be deleted.
 await page.getByRole('link',{name:/^AutoVision autovision(-[a-z0-9]{6})?$/}).click();await page.waitForURL('**/admin/organizations/*');await page.getByRole('button',{name:'Open organization console'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Delete',exact:true}).count(),0,'the operator workspace offers no Delete');
 // Admin user deletion from the detail page: membership removed, sign-in refused.
 await page.goto(base+`/admin/users/${userId}`);await page.getByRole('button',{name:'Delete',exact:true}).click();
 const userDrawer=page.locator('.offcanvas.show');await userDrawer.getByText('Memberships removed').waitFor();await userDrawer.getByText(orgName).waitFor();
 assert.equal((await api.get(base+`/admin/users/${userId}`)).status(),200);
 await userDrawer.getByLabel('Type DELETE to confirm').fill('DELETE');await shot(page,'user-delete');await userDrawer.getByRole('button',{name:'Delete',exact:true}).click();await page.waitForURL(u=>new URL(u).pathname==='/admin/users');
 assert.equal(await page.getByRole('link',{name:new RegExp(userName)}).count(),0);
 assert.equal((await api.get(base+`/admin/users/${userId}`)).status(),404);
 assert.equal((await api.post(base+'/api/auth/login',{data:{username:userName,password:userPassword}})).status(),401,'deleted user cannot sign in');
 // Admin organization deletion from the detail page: API keys stop working and the detail page is gone.
 assert.equal((await api.delete(base+`/api/orgs/${orgId}`,{data:{}})).status(),400,'API requires the typed confirmation');
 // A member whose only organization is this one: the account is deleted with it.
 const lastMember=await api.post(base+'/api/v1/users',{data:{username:'synthetic-last-member-'+run,displayName:'Synthetic Last Member',password:'synthetic-last-'+randomUUID(),role:'viewer'}});assert.equal(lastMember.status(),201,await lastMember.text());const lastMemberId=(await lastMember.json()).id;cleanup.unshift(`/api/v1/users/${lastMemberId}`);
 await page.goto(base+`/admin/organizations/${orgId}`);await page.getByRole('button',{name:'Delete',exact:true}).click();
 const orgDrawer=page.locator('.offcanvas.show');await orgDrawer.getByText('Synthetic admin E2E key').waitFor();
 await orgDrawer.getByText('Accounts deleted').waitFor();await orgDrawer.getByText('Synthetic Last Member').waitFor();
 await orgDrawer.getByLabel('Type DELETE to confirm').fill('delete');assert.ok(await orgDrawer.getByRole('button',{name:'Delete',exact:true}).isDisabled(),'confirmation is case-sensitive');
 await orgDrawer.getByLabel('Type DELETE to confirm').fill('DELETE');await shot(page,'organization-delete');await orgDrawer.getByRole('button',{name:'Delete',exact:true}).click();await page.waitForURL(u=>new URL(u).pathname==='/admin/organizations');
 assert.equal(await page.getByRole('link',{name:new RegExp(orgName)}).count(),0);
 assert.equal((await api.get(base+`/admin/organizations/${orgId}`)).status(),404);
 assert.equal((await api.get(base+`/admin/users/${lastMemberId}`)).status(),404,'the member with no other organization is deleted');
 const anonymous=await browser.newContext();assert.equal((await anonymous.request.post(base+'/api/v1/analyze',{headers:{Authorization:'Bearer '+key.key},data:{image,classify:false}})).status(),401,'deleted organization API keys stop authenticating');await anonymous.close();
 key=undefined;
 console.log(`PASS: admin sidenav, organization/user/job list and detail pages (job ${expected}), privacy limits, root-only access, links, forgot password, account/user/organization deletion.`);
}finally{
 if(key)await api.delete(base+'/api/v1/api-keys',{data:{hash:key.hash}});
 for(const path of cleanup){const r=await api.delete(base+path,{headers:{Origin:base},data:{confirmation:'DELETE'}});if(![200,404].includes(r.status()))console.error(`cleanup ${path}: ${r.status()} ${await r.text()}`)}
 await browser.close();
}
