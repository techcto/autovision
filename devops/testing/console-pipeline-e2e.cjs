const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const base=process.env.AUTOVISION_TEST_URL||'http://localhost:8086';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Localhost only');
if(process.env.AUTOVISION_TEST_BEDROCK!=='true')throw Error('Explicit AUTOVISION_TEST_BEDROCK=true approval required for live inference.');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/login');await page.getByLabel('Email (or root username)',{exact:true}).fill('root');await page.getByLabel('Password',{exact:true}).fill(process.env.AUTOVISION_LOCAL_ROOT_PASSWORD||'autovision-local-change-me');await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
  await page.getByRole('button',{name:'+ Manual run',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles(path.resolve('public/demo/backyardintruder-poster.jpg'));
  const enhanced=page.getByLabel('Enhanced AI inspection — let the Decider choose follow-up tools');await enhanced.check();
  const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/v1/jobs/run')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Run analysis',exact:true}).click();
  const response=await responsePromise;assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/text\/event-stream/);
  const link=page.getByRole('link',{name:'Open analysis report →',exact:true});await link.waitFor();
  await page.getByRole('region',{name:'Current analysis workflow'}).getByText('Decider evaluates evidence',{exact:true}).first().waitFor();
  fs.mkdirSync('docs/console-pipeline-live',{recursive:true});await page.getByRole('region',{name:'Current analysis workflow'}).scrollIntoViewIfNeeded();await page.screenshot({path:'docs/console-pipeline-live/01-live-console-pipeline.png'});
  const href=await link.getAttribute('href');await link.click();await page.getByRole('heading',{name:'Saved workflow and Decider steps'}).waitFor();
  const replay=page.getByRole('button',{name:'Replay saved steps',exact:true});await replay.click();await page.getByRole('button',{name:'Pause replay',exact:true}).waitFor();await page.getByRole('button',{name:'Show all steps',exact:true}).click();
  await page.getByRole('heading',{name:'Saved workflow and Decider steps'}).scrollIntoViewIfNeeded();await page.screenshot({path:'docs/console-pipeline-live/02-saved-decider-steps.png'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',streaming:true,savedDeciderSteps:true,replay:true,jobPath:href,liveBedrock:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
