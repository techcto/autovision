import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pipelineStream} from '../src/lib/pipeline-stream';
import {readPipeline} from '../src/lib/browser-pipeline';
import type {PipelineEvent} from '../src/lib/pipeline-events';
test('pipeline streams ordered dynamic steps and terminal evidence to the browser',async()=>{
 const response=pipelineStream(new Request('http://localhost'),async context=>{
  for(const event of [{type:'run.started'},{type:'step.started',step_id:'perception'},{type:'step.completed',step_id:'perception'},{type:'step.added',step_id:'crop',title:'inspect_region'},{type:'step.started',step_id:'crop'},{type:'step.completed',step_id:'crop',data:{person:1}},{type:'run.completed',data:{inspection:{review_recommended:true}}}] as PipelineEvent[])context.onEvent?.(event);
 });
 assert.match(response.headers.get('content-type')??'',/text\/event-stream/);
 const events:PipelineEvent[]=[];await readPipeline(response,e=>events.push(e));
 assert.equal(events[3].type,'step.added');assert.equal(events[3].title,'inspect_region');assert.equal(events.at(-1)?.type,'run.completed');
});
test('streamed failures and truncated connections are explicit, not silent completions',async()=>{
 const failure=pipelineStream(new Request('http://localhost'),async()=>{throw Error('Unavailable')});
 await assert.rejects(()=>readPipeline(failure,()=>{}),/Analysis unavailable/);
 await assert.rejects(()=>readPipeline(new Response('data: {"type":"run.started"}\n\n'),()=>{}),/disconnected/);
});
