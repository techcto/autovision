import {MediaError} from './media-contract';
import type {PipelineContext,PipelineEvent} from './pipeline-events';
export function pipelineStream(request:Request,run:(context:PipelineContext)=>Promise<unknown>){
 const encoder=new TextEncoder(),abort=new AbortController(),start=Date.now();let cancelled=false,sequence=0;
 const signal=AbortSignal.any([request.signal,abort.signal]);
 const stream=new ReadableStream<Uint8Array>({
  start(controller){
   const send=(event:PipelineEvent)=>{signal.throwIfAborted();controller.enqueue(encoder.encode(`id: ${++sequence}\nevent: pipeline\ndata: ${JSON.stringify({...event,elapsed_ms:Date.now()-start})}\n\n`))};
   const heartbeat=setInterval(()=>{if(!cancelled&&!signal.aborted)controller.enqueue(encoder.encode(': heartbeat\n\n'))},5000);
   void run({onEvent:send,signal}).catch(error=>{if(!cancelled&&!signal.aborted)send({type:'run.failed',summary:error instanceof MediaError?error.message:'Analysis unavailable',data:{status:error instanceof MediaError?error.status:503}})}).finally(()=>{clearInterval(heartbeat);if(!cancelled)controller.close()});
  },
  cancel(){cancelled=true;abort.abort()}
 });
 return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-store','X-Accel-Buffering':'no'}});
}
