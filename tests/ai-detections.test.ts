import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enabledAiLabels,parseGrounding} from '../src/lib/ai-detections';
test('configured labels are allowlisted and deduplicated',()=>assert.deepEqual(enabledAiLabels('package,smoke,fire,unknown,package'),['package','smoke','fire']));
test('AI package grounding normalizes boxes and preserves provenance',()=>{
 const result=parseGrounding(JSON.stringify({summary:'A parcel.',frames:[{frame_index:0,detections:[{label:'package',box:[100,200,500,800]}]}]}),['package'],[0]);
 assert.deepEqual(result.frames[0].detections[0],{label:'package',source:'bedrock',advisory:true,box:{x:0.1,y:0.2,width:0.4,height:0.6}});
});
test('reject hallucinated categories, invalid boxes, omitted and unrequested frames',()=>{
 for(const frame of [{frame_index:0,detections:[{label:'weapon',box:[1,2,3,4]}]},{frame_index:0,detections:[{label:'package',box:[1,2,1001,4]}]},{frame_index:0,detections:[{label:'package',box:[5,2,3,4]}]},{frame_index:1,detections:[]}])assert.throws(()=>parseGrounding(JSON.stringify({summary:'Test',frames:[frame]}),['package'],[0]));
 assert.throws(()=>parseGrounding(JSON.stringify({summary:'Test',frames:[]}),['package'],[0]));
});
