import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mcpSummary,progressMessage} from '../src/lib/mcp-output';
test('MCP prose contains evidence and recovery but no image previews',()=>{
 const image='data:image/jpeg;base64,'+'A'.repeat(100000);
 const summary=mcpSummary({job_id:'job',engine_version:'5.0.0',frames:[{quality:{brightness:30},preview:image}],observations:[{type:'person',detected:true}],next_steps:['Consider inspect_scene with consent.'],inspection:{status:'complete',review_recommended:true,trace:[{tool:'inspect_region',status:'failed',reason:'Only OpenCV regions'},{tool:'enhance_low_light',status:'complete',output:{preview:image,result:{observations:[{type:'person',detected:true}]}}},{tool:'finish',status:'complete',reason:'Review is appropriate.'}]}});
 assert.match(summary,/dark frame/);assert.match(summary,/inspect_region rejected/);assert.match(summary,/enhance_low_light: observed person/);assert.match(summary,/Human review recommended/);assert.match(summary,/Next step/);assert.ok(summary.length<2000);assert.ok(!summary.includes('base64'));assert.ok(!summary.includes('AAAA'));
});
test('progress messages contain step status and no serialized image data',()=>{
 assert.equal(progressMessage({type:'step.failed',title:'inspect_region',summary:'Invalid region',data:{preview:'secret'}}),'inspect region: failed — Invalid region');
});
