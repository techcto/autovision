import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAnalysis} from '../src/lib/media-contract';
import {defaultInspection,validateInspection} from '../src/lib/inspection-config';
import {checkToolArgs,executeInspectionTool,inspectAutonomously} from '../src/lib/autonomous-inspection';
import {MediaError} from '../src/lib/media-contract';
import {approvedModels,resolveModel,visionLenses} from '../src/lib/vision-lenses';
const image=Buffer.from([255,216,255,0]).toString('base64');
const input={frames:[{image,at_ms:0}],classify:true};
const evidence={engine_version:'5.0.0',frames:[{at_ms:0,quality:{brightness:35},detections:[{label:'person',score:.6,box:{x:.1,y:.1,width:.2,height:.4}}]}],observations:[{type:'person',detected:true,value:1}]};
const request=(name:string,args:Record<string,unknown>)=>({output:{message:{role:'assistant',content:[{toolUse:{toolUseId:'call',name,input:args}}]}}});
test('rejected Bedrock crop is returned as tool error; Decider recovers within two attempts',async()=>{
 process.env.AUTOVISION_VISION_MODEL_ID='test-model';let turns=0,charged=0;const progress:string[]=[];
 const grounded={...evidence,frames:[{...evidence.frames[0],detections:[...evidence.frames[0].detections,{label:'package',source:'bedrock',box:{x:.5,y:.5,width:.2,height:.2}}]}]};
 try{
 const result=await inspectAutonomously(input,grounded,defaultInspection,async n=>{charged+=n;return true},{onEvent:e=>progress.push(e.type),send:async command=>{
  if(turns++===0)return request('inspect_region',{frame_index:0,detection_index:1});
  if(turns===2){assert.match(JSON.stringify(command.input.messages),/"status":"error"/);assert.match(JSON.stringify(command.input.messages),/Only OpenCV/);return request('enhance_low_light',{frame_index:0});}
  assert.match(JSON.stringify(command.input.messages),/0.94/);return request('finish',{review_recommended:true,reason:'Recovered measurement requires review.'});
 },fetcher:async()=>Response.json({result:{engine_version:'5.0.0',frames:[{detections:[{label:'person',score:.94}]}]}})});
 assert.equal(result.status,'complete');assert.equal(turns,3);assert.equal(charged,1);assert.equal(result.followup_count,1);assert.equal(result.review_recommended,true);
 assert.deepEqual(result.trace.map(t=>[t.tool,t.status]),[['inspect_region','failed'],['enhance_low_light','complete'],['finish','complete']]);assert.ok(progress.includes('step.failed'));
 }finally{delete process.env.AUTOVISION_VISION_MODEL_ID;}
});
test('two rejected tool attempts cannot loop indefinitely or finish without successful evidence',async()=>{
 process.env.AUTOVISION_VISION_MODEL_ID='test-model';let turns=0;
 try{const result=await inspectAutonomously(input,evidence,defaultInspection,async()=>assert.fail('Invalid requests must not charge'),{send:async()=>{turns++;return request('inspect_region',{frame_index:0,detection_index:99});}});assert.ok(turns<=3);assert.equal(result.review_recommended,true);assert.equal(result.followup_count,0);assert.equal(result.trace.filter(t=>t.status==='failed').length,2);}finally{delete process.env.AUTOVISION_VISION_MODEL_ID;}
});
test('approved lens models resolve by capability and planned adapters are not executable',()=>{
 const before=process.env.AUTOVISION_AI_MODELS_JSON;
 try{process.env.AUTOVISION_AI_MODELS_JSON=JSON.stringify([{id:'detail',label:'Detailed scene',modelId:'test-approved-model',skills:['scene','package']}]);assert.equal(resolveModel('detail','scene'),'test-approved-model');assert.equal(resolveModel('detail','planning'),undefined);assert.ok(approvedModels().some(m=>m.id==='detail'));assert.equal(validateInspection({...defaultInspection,sceneModel:'detail'},['deployment_default','detail']).sceneModel,'detail');assert.throws(()=>validateInspection({...defaultInspection,tools:['ocr']}));assert.ok(visionLenses.some(l=>l.id==='ocr'&&l.status==='planned'));process.env.AUTOVISION_AI_MODELS_JSON='[{"id":"bad"}]';assert.throws(()=>approvedModels())}finally{if(before===undefined)delete process.env.AUTOVISION_AI_MODELS_JSON;else process.env.AUTOVISION_AI_MODELS_JSON=before}
});
test('API requires explicit AI consent, validates flag and bounds settings',()=>{
 assert.throws(()=>validateAnalysis({...input,classify:false,enhanced:true}),/consent/);
 assert.throws(()=>validateAnalysis({...input,enhanced:'yes'}),/boolean/);
 assert.equal(validateAnalysis({...input,enhanced:false}).enhanced,false);
 assert.equal(validateAnalysis(input).enhanced,undefined);
 assert.throws(()=>validateInspection({...defaultInspection,maxSteps:3}));
 assert.throws(()=>validateInspection({...defaultInspection,model:'arbitrary-model'}));
 assert.throws(()=>validateInspection({...defaultInspection,cropPadding:-1}));
});
test('OpenCV evidence changes planner tool call and follow-up evidence changes review decision',async()=>{
 process.env.AUTOVISION_VISION_MODEL_ID='test-model';let calls=0,charged=0;
 const result=await inspectAutonomously(input,evidence,defaultInspection,async n=>{charged+=n;return true},{send:async command=>{
  const text=JSON.stringify(command.input.messages);
  if(calls++===0){assert.match(text,/brightness/);assert.match(text,/person/);return request('enhance_low_light',{frame_index:0})}
  assert.match(text,/toolResult/);assert.match(text,/0.94/);return request('finish',{review_recommended:false,reason:'Follow-up person observation is clear; no additional review requested under this demo policy.'});
 },fetcher:async(_url,init)=>{assert.equal(JSON.parse(String(init?.body)).operation,'enhance_low_light');return Response.json({result:{engine_version:'5.0.0',frames:[{detections:[{label:'person',score:.94}]}]}})}});
 assert.equal(result.status,'complete');assert.equal(result.review_recommended,false);assert.equal(charged,1);assert.deepEqual(result.trace.map(t=>t.tool),['enhance_low_light','finish']);
});
test('quota, unavailable tools, disabled tools, invalid crops and unsupported planner output recommend review',async()=>{
 process.env.AUTOVISION_VISION_MODEL_ID='test-model';
 for(const [name,args]of [['inspect_region',{frame_index:0,detection_index:8}],['unknown',{}]] as const){const result=await inspectAutonomously(input,evidence,defaultInspection,async()=>true,{send:async()=>request(name,args)});assert.equal(result.review_recommended,true);assert.equal(result.followup_count,0)}
 const quota=await inspectAutonomously(input,evidence,defaultInspection,async()=>false,{send:async()=>request('inspect_region',{frame_index:0,detection_index:0})});assert.equal(quota.status,'quota_exhausted');
 const failed=await inspectAutonomously(input,evidence,defaultInspection,async()=>true,{send:async()=>{throw Error('timeout')}});assert.equal(failed.status,'unavailable');assert.equal(failed.review_recommended,true);
 const off=await inspectAutonomously(input,{engine_version:'5.0.0',frames:[],observations:[]},defaultInspection,async()=>true);assert.equal(off.status,'not_triggered');
 delete process.env.AUTOVISION_VISION_MODEL_ID;
 const missing=await inspectAutonomously(input,evidence,defaultInspection,async()=>true);assert.equal(missing.status,'unavailable');
});
test('a bounded batch of lens calls executes sequentially and all evidence returns before the next decision',async()=>{
 process.env.AUTOVISION_VISION_MODEL_ID='test-model';let rounds=0,charges=0;
 const result=await inspectAutonomously(input,evidence,defaultInspection,async()=>{charges++;return true},{send:async command=>{
  if(rounds++===0)return{output:{message:{role:'assistant',content:[{toolUse:{toolUseId:'enhance',name:'enhance_low_light',input:{frame_index:0}}},{toolUse:{toolUseId:'crop',name:'inspect_region',input:{frame_index:0,detection_index:0}}}]}}};
  assert.equal(command.input.messages?.at(-1)?.content?.length,2);return request('finish',{review_recommended:true,reason:'Combined lens evidence needs review.'});
 },fetcher:async()=>Response.json({result:{engine_version:'5.0.0',frames:[]}})});
 assert.equal(result.status,'complete');assert.equal(charges,2);assert.deepEqual(result.trace.map(t=>t.step),[0,1,2]);
 delete process.env.AUTOVISION_VISION_MODEL_ID;
});
test('standalone lens arguments are rejected before quota and models must match their lens skill',()=>{
 const before=process.env.AUTOVISION_AI_MODELS_JSON;
 try{
  assert.throws(()=>checkToolArgs('inspect_region',{frame_index:5,detection_index:0},input,defaultInspection),/frame index/);
  assert.throws(()=>checkToolArgs('inspect_region',{frame_index:0,detection_index:20},input,defaultInspection),/detector region/);
  assert.throws(()=>checkToolArgs('assess_scene',{frame_index:0,focus:'identity'},input,defaultInspection),/focus/);
  assert.throws(()=>checkToolArgs('enhance_low_light',{frame_index:0},input,{...defaultInspection,tools:['inspect_region']}),/disabled/);
  assert.equal(checkToolArgs('inspect_region',{frame_index:0,detection_index:0},input,defaultInspection).index,0);
  process.env.AUTOVISION_AI_MODELS_JSON=JSON.stringify([{id:'detail',label:'Detailed scene',modelId:'test-approved-model',skills:['scene','package']}]);
  assert.throws(()=>validateInspection({...defaultInspection,model:'detail'},['deployment_default','detail']));
  assert.throws(()=>validateInspection({...defaultInspection,activityModel:'detail'},['deployment_default','detail']));
  assert.equal(validateInspection({...defaultInspection,packageModel:'detail'},['deployment_default','detail']).packageModel,'detail');
  process.env.AUTOVISION_AI_MODELS_JSON='[{"id":"bad"}]';
  assert.throws(()=>checkToolArgs('assess_scene',{frame_index:0},input,defaultInspection),/model unavailable/);
 }finally{if(before===undefined)delete process.env.AUTOVISION_AI_MODELS_JSON;else process.env.AUTOVISION_AI_MODELS_JSON=before}
});
test('an invalid model registry or exhausted planner allowance keeps initial evidence and recommends review',async()=>{
 const before=process.env.AUTOVISION_AI_MODELS_JSON;process.env.AUTOVISION_VISION_MODEL_ID='test-model';
 try{
  const budget=await inspectAutonomously(input,evidence,defaultInspection,async()=>true,{send:async()=>{throw new MediaError('Public demo daily allowance reached',429)}});
  assert.equal(budget.status,'quota_exhausted');assert.equal(budget.review_recommended,true);
  process.env.AUTOVISION_AI_MODELS_JSON='[{"id":"bad"}]';
  const result=await inspectAutonomously(input,evidence,defaultInspection,async()=>true,{send:async()=>assert.fail('planner must not run')});
  assert.equal(result.status,'unavailable');assert.equal(result.review_recommended,true);
 }finally{delete process.env.AUTOVISION_VISION_MODEL_ID;if(before===undefined)delete process.env.AUTOVISION_AI_MODELS_JSON;else process.env.AUTOVISION_AI_MODELS_JSON=before}
});
test('advisory Bedrock boxes cannot be cropped for YOLOX re-detection and are not charged',async()=>{
 const grounded={...evidence,frames:[{...evidence.frames[0],detections:[...evidence.frames[0].detections,{label:'package',source:'bedrock',box:{x:.5,y:.5,width:.2,height:.2}}]}]};let charged=0;
 await assert.rejects(executeInspectionTool('inspect_region',{frame_index:0,detection_index:1},input,grounded,defaultInspection,async n=>{charged+=n;return true},AbortSignal.timeout(1000),async()=>assert.fail('vision must not run')),/Only OpenCV/);
 assert.equal(charged,0);
});
test('crop re-detection uses the same default labels as the initial pass',async()=>{
 const before=process.env.AUTOVISION_AI_DETECTIONS;process.env.AUTOVISION_AI_DETECTIONS='person,car,package';let sent:unknown;
 try{
  const cars={...evidence,frames:[{...evidence.frames[0],detections:[{label:'car',score:.9,box:{x:.1,y:.1,width:.2,height:.2}}]}]};
  await executeInspectionTool('inspect_region',{frame_index:0,detection_index:0},{frames:input.frames},cars,defaultInspection,async()=>true,AbortSignal.timeout(1000),async(_url,init)=>{sent=JSON.parse(String(init?.body)).detection_labels;return Response.json({result:{engine_version:'5.0.0',frames:[]}})});
  assert.deepEqual(sent,['person','car','package']);
 }finally{if(before===undefined)delete process.env.AUTOVISION_AI_DETECTIONS;else process.env.AUTOVISION_AI_DETECTIONS=before}
});
