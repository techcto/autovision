const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const base=process.env.AUTOVISION_TEST_URL||'http://localhost:8081';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Localhost only');
(async()=>{
 const dir=fs.readdirSync('/ms-playwright').find(n=>n.startsWith('chromium-'));
 const browser=await chromium.launch({executablePath:'/ms-playwright/'+dir+'/chrome-linux64/chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let analyses=0;page.on('request',r=>{if(r.url().endsWith('/api/demo/analyze'))analyses++});
  for(let attempt=0;;attempt++){
   try{await page.goto(base);break;}catch(e){if(attempt>=15||!String(e).includes('ERR_CONNECTION_REFUSED'))throw e;await page.waitForTimeout(1000);}
  }
  assert.equal(await page.getByRole('button',{name:/synthetic|generate.*analyze/i}).count(),0);
  console.log('Homepage loaded');
  assert.equal(await page.locator('.av-recorded-grid > section').count(),3,'Exactly three sample tiles');
  assert.deepEqual(await page.locator('.av-recorded-grid > section').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),['Dog at night video analysis demo','Backyard visitor video analysis demo','Package delivery video analysis demo']);
  assert.equal(await page.getByRole('region',{name:'Visitor at the door video analysis demo',exact:true}).count(),0);
  await page.waitForFunction(()=>Object.keys(document.querySelector('.av-hero-demo button')||{}).some(k=>k.startsWith('__reactProps$')));
  console.log('Homepage hydrated');
  const hero=page.getByRole('region',{name:'Doorbell camera video analysis demo'});
  const result=await(await page.request.get(base+'/demo/intruder-analysis.json')).json();
  console.log('Cached analysis loaded');
  await hero.getByRole('button',{name:'View analysis →',exact:true}).click();
  assert.equal(await hero.getByRole('status').textContent(),`Sample 1 of ${result.frames.length} · 0.0s`);
  assert.ok(await hero.getByRole('button',{name:'← Previous',exact:true}).isDisabled());
  for(let i=0;i<result.frames.length;i++){
   await hero.getByRole('button',{name:`Show analyzed sample ${(result.frames[i].at_ms/1000).toFixed(1)} seconds`,exact:true}).click();
   assert.equal(await hero.locator('.av-box').count(),result.frames[i].detections.length);
   assert.equal(await hero.locator('.av-hero-demo-sample').count(),1);
  }
  assert.ok(await hero.getByRole('button',{name:'Next →',exact:true}).isDisabled());
  await hero.getByRole('button',{name:'← Previous',exact:true}).click();
  assert.match(await hero.getByRole('status').textContent(),new RegExp('Sample '+(result.frames.length-1)+' of'));
  const video=hero.locator('video');
  assert.equal(await video.evaluate(v=>v.controls),false);
  assert.ok(await video.evaluate(v=>v.muted&&v.loop&&v.autoplay));
  await hero.getByRole('button',{name:'Back to video',exact:true}).click();
  await page.waitForTimeout(500);
  assert.equal(await hero.locator('.av-hero-demo-sample').count(),0);
  await video.evaluate(v=>v.pause());
  const dimensions=await video.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,ready:v.readyState}));
  assert.ok(dimensions.width>0&&dimensions.height>0&&dimensions.ready>=2);
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow at '+width);
  }
  // Show a real detected sample for visual verification.
  const boxed=result.frames.find(f=>f.detections.length);
  await hero.getByRole('button',{name:'View analysis →',exact:true}).click();
  await hero.getByRole('button',{name:`Show analyzed sample ${(boxed.at_ms/1000).toFixed(1)} seconds`,exact:true}).click();
  for(const [clip,title,label] of [['dognight','Dog at night','dog'],['package','Package delivery','package'],['backyardintruder','Backyard visitor','person']]){
   const card=page.getByRole('region',{name:`${title} video analysis demo`,exact:true});
   const recording=await(await page.request.get(base+`/demo/${clip}-analysis.json`)).json();
   await card.getByRole('button',{name:'View analysis →',exact:true}).click();
   assert.equal(await card.locator('video').evaluate(v=>v.controls),false);
   const detected=recording.frames.find(f=>f.detections.some(d=>d.label===label));
   assert.ok(detected,clip+' must contain actual '+label+' boxes');
   for(const f of recording.frames){
    await card.getByRole('button',{name:`Show analyzed sample ${(f.at_ms/1000).toFixed(1)} seconds`,exact:true}).click();
    assert.equal(await card.locator('.av-box').count(),f.detections.length);
   }
   await card.getByRole('button',{name:`Show analyzed sample ${(detected.at_ms/1000).toFixed(1)} seconds`,exact:true}).click();
   console.log('Cached sample passed: '+clip);
  }
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Audit overflow at '+width);
  }
  await page.screenshot({path:'/tmp/autovision-doorbell-home.png',fullPage:true});
  assert.equal(analyses,0,'Homepage must not spend inference quota on page load');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',samples:result.frames.length,boxes:result.frames.reduce((n,f)=>n+f.detections.length,0),dimensions,responsive:[390,768,1440],analysisRequestsOnLoad:analyses}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
