const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.AUTOVISION_TEST_URL||'http://localhost:8086',out=path.resolve(process.env.AUTOVISION_GALLERY_DIR||'docs/console-gallery');
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Localhost only');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const captures=[];
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(60000);
 let original;
 async function shot(file,caption,target){if(target)await target.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-120));await page.waitForTimeout(250);await page.screenshot({path:path.join(out,file),animations:'disabled'});assert.ok(fs.statSync(path.join(out,file)).size<5*1024*1024);captures.push({file,caption});console.log(file);}
 try{
  await page.goto(base+'/login');await page.getByLabel('Email (or root username)',{exact:true}).fill('root');await page.getByLabel('Password',{exact:true}).fill(process.env.AUTOVISION_LOCAL_ROOT_PASSWORD||'autovision-local-change-me');await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
  await page.getByRole('button',{name:'+ Manual run',exact:true}).click();
  await page.getByLabel('Include Bedrock scene summary').uncheck();await page.locator('input[type=file]').setInputFiles(path.resolve('public/intruder.mp4'));
  await shot('01-console-manual-run.png','Signed-in console: upload an authorized short clip; browser sampling and privacy limits are shown.');
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/v1/jobs/run')&&r.request().method()==='POST');await page.getByRole('button',{name:'Run analysis',exact:true}).click();const response=await pending;const result=await response.json();assert.ok(response.ok(),result.error);assert.ok(result.job_id);
  await page.getByRole('heading',{name:'Recent jobs'}).waitFor();await page.waitForTimeout(700);
  await shot('02-console-job-history.png','Real local manual analysis persisted in private job history with actor, source, frames and duration.');
  await page.goto(base+'/dashboard/jobs/'+result.job_id);await page.locator('.av-job-detail').waitFor();
  await shot('03-console-job-details.png','Actual local OpenCV 5 result: detections, runtime information and recorded samples.');
  const detail=page.locator('.av-job-detail');
  await page.getByRole('button',{name:'5.5s',exact:true}).click();
  await shot('04-console-frame-evidence.png','A later selected frame and measured detections from the actual local video analysis.',detail.locator('.av-detail-grid'));
  await page.goto(base+'/settings');await page.getByRole('button',{name:'Save detection preferences',exact:true}).waitFor();
  const settingsResponse=await page.request.get(base+'/api/v1/settings');original=await settingsResponse.json();
  const objects=page.locator('section').filter({has:page.getByRole('heading',{name:'Object detection',exact:true})}).last();
  await shot('05-opencv-detection-settings.png','Organization OpenCV/YOLOX object controls, presets and advisory AI categories.',objects);
  const inspection=page.locator('section').filter({has:page.getByRole('heading',{name:'Autonomous inspection and vision lenses',exact:true})}).last();
  await page.getByLabel('Enable by default for this organization').check();
  await page.getByRole('button',{name:'Save inspection preferences',exact:true}).click();await page.getByText('Inspection preferences saved.',{exact:true}).waitFor();
  await shot('06-enable-enhanced-inspection.png','Enable enhanced AI by default, choose triggers and bound follow-ups. Model-configuration warnings remain visible.',inspection);
  await shot('07-approved-model-controls.png','Separate approved planner, scene, package and activity model selectors.',page.getByLabel('Planner model').locator('..'));
  const light=inspection.locator('details').filter({has:page.locator('summary').filter({hasText:'enhance low light'})});await light.locator('summary').click();
  await shot('08-opencv-low-light-controls.png','Allow low-light inspection; control brightness threshold and CLAHE strength.',light);
  const crop=inspection.locator('details').filter({has:page.locator('summary').filter({hasText:'inspect region'})});await crop.locator('summary').click();
  await shot('09-crop-inspection-controls.png','Allow crop/re-detection and control region padding.',crop);
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),notes:'Real authenticated local console and fresh OpenCV video analysis. Enhanced-inspection settings demonstrated; no fresh successful Bedrock agent loop is claimed. Original inspection settings restored after capture.',captures},null,2)+'\n');
  fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><html><meta charset="utf-8"><title>AutoVision Console Gallery</title><style>body{font:16px system-ui;margin:32px;background:#101114;color:white}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:24px}figure{margin:0;padding:12px;background:#24252b}img{width:100%}figcaption{padding:12px}</style><h1>AutoVision: the real console</h1><main>'+captures.map(c=>'<figure><a href="'+c.file+'"><img src="'+c.file+'" alt="'+c.caption+'"></a><figcaption>'+c.caption+'</figcaption></figure>').join('')+'</main>');
 }finally{if(original){const r=await page.request.put(base+'/api/v1/settings',{headers:{Origin:base},data:{inspection:original.inspection}});assert.ok(r.ok(),'Restore local inspection settings');}await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
