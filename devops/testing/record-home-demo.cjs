// Run against localhost after placing an authorized clip in public/intruder.mp4.
// Uses the same browser sampler and /api/demo/analyze route as the Live Lab.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=require('playwright');
const base=process.env.AUTOVISION_TEST_URL||'http://localhost:8081';
const clip=process.argv[2]||'intruder';
const enhanced=process.env.AUTOVISION_RECORD_INSPECTION==='true';
if(!['intruder','dognight','package','backyardintruder'].includes(clip))throw Error('Unknown demo clip');
const inputPath=`public/${clip}.mp4`,outputPath=`public/demo/${clip}-analysis.json`;
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Localhost only');
async function main(){
 let executablePath=process.env.CHROMIUM_PATH;
 if(!executablePath&&fs.existsSync('/ms-playwright'))for(const dir of fs.readdirSync('/ms-playwright')){
  const candidate='/ms-playwright/'+dir+'/chrome-linux64/chrome';
  if(fs.existsSync(candidate))executablePath=candidate;
 }
 const browser=await chromium.launch({executablePath,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  page.setDefaultTimeout(120000);
  for(let attempt=0;;attempt++){
   try{await page.goto(base);break;}catch(e){if(attempt>=15||!String(e).includes('ERR_CONNECTION_REFUSED'))throw e;await page.waitForTimeout(1000);}
  }
  const ts=require('typescript');
  const sampler=ts.transpileModule(fs.readFileSync('src/lib/browser-media.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const framesInput=await page.evaluate(async({sampler,clip})=>{
   const exports={};new Function('exports',sampler)(exports);
   const response=await fetch('/'+clip+'.mp4');if(!response.ok)throw Error('Clip unavailable');
   return exports.sampleUpload(new File([await response.blob()],clip+'.mp4',{type:'video/mp4'}),()=>{});
  },{sampler,clip});
  console.log('Sampled '+framesInput.length+' frames; submitting to localhost analysis');
  const data={frames:framesInput,classify:true,enhanced};
  if(clip!=='intruder')data.detection_labels=clip==='dognight'?['dog','person']:clip==='package'?['package','person']:['person'];
  const r=await page.request.post(base+'/api/demo/analyze',{headers:{Origin:base},data,timeout:180000}),result=await r.json();
  if(!r.ok())throw Error('Analysis failed: '+JSON.stringify(result));
  if(result.classification?.status!=='complete')throw Error('AI grounding did not complete: '+result.classification?.status);
  if(enhanced&&!['complete','needs_review','not_triggered','budget_exhausted'].includes(result.inspection?.status))throw Error('Inspection unavailable: '+result.inspection?.status);
  const frames=result.frames.map(f=>({at_ms:f.at_ms,preview:f.preview,observations:f.observations,detections:f.detections.map(d=>({...d,source:d.source||'opencv'}))}));
  if(!frames.some(f=>f.detections.length))throw Error('No detection boxes returned; do not fabricate boxes');
  const record={source:`/${clip}.mp4`,sha256:createHash('sha256').update(fs.readFileSync(inputPath)).digest('hex'),recordedAt:new Date().toISOString(),frames,classification:result.classification,engine:result.engine,engine_version:result.engine_version,detector_version:result.detector_version,metrics:result.metrics,observations:result.observations,...(enhanced?{inspection:result.inspection}:{})};
  fs.mkdirSync('public/demo',{recursive:true});
  fs.writeFileSync(outputPath,JSON.stringify(record,null,2)+'\n');
  if(process.env.AUTOVISION_KEEP_POSTER!=='true')fs.writeFileSync(`public/demo/${clip}-poster.jpg`,Buffer.from(frames[0].preview,'base64'));
  console.log(JSON.stringify({clip,frames:frames.length,boxes:frames.reduce((n,f)=>n+f.detections.length,0),classification:result.classification.status,engine:result.engine,output:outputPath}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
