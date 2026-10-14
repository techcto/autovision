import type {PipelineEvent} from './pipeline-events';
export async function readPipeline(response:Response,onEvent:(event:PipelineEvent)=>void){
 if(!response.ok){const value=await response.json().catch(()=>({}));throw Error(value.error??`Analysis failed: ${response.status}`)}
 const reader=response.body?.getReader();if(!reader)throw Error('Streaming response unavailable');
 const decoder=new TextDecoder();let buffer='',complete=false;
 try{
  for(;;){const chunk=await reader.read();buffer+=decoder.decode(chunk.value??new Uint8Array(),{stream:!chunk.done});let split;
   while((split=buffer.indexOf('\n\n'))>=0){const packet=buffer.slice(0,split);buffer=buffer.slice(split+2);const data=packet.split('\n').filter(line=>line.startsWith('data: ')).map(line=>line.slice(6)).join('\n');if(!data)continue;const event=JSON.parse(data) as PipelineEvent;onEvent(event);if(event.type==='run.failed')throw Error(event.summary??'Analysis failed');if(event.type==='run.completed')complete=true;}
   if(chunk.done)break;
  }
  if(!complete)throw Error('Pipeline disconnected before completion. Retry explicitly; another run may consume budget.');
 }finally{reader.releaseLock()}
}
