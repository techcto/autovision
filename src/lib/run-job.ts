import {consume} from './api-keys';
import {AnalysisInput,MediaError} from './media-contract';
import {analyzeMedia} from './media-analysis';
import {Actor,Job,newJob,saveJob} from './jobs';
import {store} from './store';
import {defaultInspection,type InspectionTool} from './inspection-config';
import {checkToolArgs,executeInspectionTool,inspectAutonomously,type InspectionResult} from './autonomous-inspection';
import type {PipelineContext,PipelineEvent} from './pipeline-events';
import {withUsageScope} from './usage-ledger';
import {randomUUID} from 'node:crypto';
export type ToolRequest={name:InspectionTool;args:Record<string,unknown>};
export async function runJob(orgId:string,actor:Actor,source:Job['source'],input:AnalysisInput,toolRequest?:ToolRequest,context:PipelineContext={}){
  const usageRunId=randomUUID();
  return withUsageScope(orgId,usageRunId,()=>runMeteredJob(orgId,actor,source,input,toolRequest,context,usageRunId));
}
async function runMeteredJob(orgId:string,actor:Actor,source:Job['source'],input:AnalysisInput,toolRequest:ToolRequest|undefined,context:PipelineContext,usageRunId:string){
  context.signal?.throwIfAborted();
  const settings=await store.settings(orgId);
  input={...input,detection_labels:input.detection_labels??settings.objectDetection?.labels};
  const inspectionConfig=settings.inspection??defaultInspection;
  const enhanced=toolRequest?false:input.enhanced??inspectionConfig.enabled;
  if(enhanced&&input.classify!==true)throw new MediaError('Enhanced inspection requires explicit classify:true consent');
  if(toolRequest)checkToolArgs(toolRequest.name,toolRequest.args,input,inspectionConfig);
  if(toolRequest?.name==='assess_scene'&&input.classify!==true)throw new MediaError('AI assessment requires explicit classify:true consent');
  if(!await consume(orgId,input.frames.length))throw new MediaError('Monthly image quota reached',429);
  const job={...newJob(orgId,actor,source,input.frames.length),usageRunId},start=Date.now();await saveJob(job);
  const pipelineEvents:PipelineEvent[]=[],notify=context.onEvent;let pipelineBytes=0;
  context={...context,onEvent:event=>{
    if((event.type.startsWith('step.')||event.type==='run.started')&&pipelineEvents.length<64){
      const safe=JSON.parse(JSON.stringify(event,(key,value)=>['preview','image','thumbnail','evidenceFrames'].includes(key)?undefined:value)) as PipelineEvent;
      let retained={...safe,elapsed_ms:Date.now()-start};
      if(Buffer.byteLength(JSON.stringify(retained))>8000||pipelineBytes+Buffer.byteLength(JSON.stringify(retained))>24000)retained={type:safe.type,step_id:safe.step_id,title:safe.title,summary:safe.summary,elapsed_ms:Date.now()-start};
      const size=Buffer.byteLength(JSON.stringify(retained));if(pipelineBytes+size<=28000){pipelineEvents.push(retained);pipelineBytes+=size;}
    }
    notify?.(event);
  }};
  try{
    context.onEvent?.({type:'run.started',job_id:job.id});
    context.onEvent?.({type:'step.started',step_id:'perception',title:'OpenCV 5 perception',summary:'Measuring supplied images; optional scene grounding follows consent.'});
    const initial=await analyzeMedia(toolRequest?{...input,classify:false}:input,context.signal);
    context.onEvent?.({type:'step.completed',step_id:'perception',title:'Initial evidence ready',data:{observations:initial.observations,engine_version:initial.engine_version,classification:initial.classification}});
    let inspection:InspectionResult={status:'not_requested',review_recommended:false,reason:'Enhanced inspection disabled.',trace:[],followup_count:0,images_sent_to_bedrock:false};
    if(toolRequest){
      let imagesSent=false;const toolStart=Date.now();
      const executed=await executeInspectionTool(toolRequest.name,toolRequest.args,input,initial,inspectionConfig,n=>consume(orgId,n),AbortSignal.timeout(15000),fetch,()=>{imagesSent=true});
      inspection={status:'tool_complete',review_recommended:true,reason:'Standalone lens evidence only; the consuming agent or human owns the next decision.',followup_count:1,images_sent_to_bedrock:imagesSent,trace:[{step:0,tool:toolRequest.name,status:'complete',duration_ms:Date.now()-toolStart,input:executed.traceInput,output:executed.output}]};
    }else if(enhanced)inspection=await inspectAutonomously(input,initial,inspectionConfig,n=>consume(orgId,n),context);
    const next_steps:string[]=[];
    if(!enhanced&&!toolRequest){
      const dark=initial.frames.some((f:{quality?:{brightness:number}})=>(f.quality?.brightness??255)<inspectionConfig.brightnessThreshold);
      const region=initial.frames.some((f:{detections:{source?:string}[]})=>f.detections.some(d=>d.source!=='bedrock'));
      if(dark&&inspectionConfig.tools.includes('enhance_low_light'))next_steps.push('Dark frame measured. Consider enhance_low_light with supplied frames and the dark frame_index; contrast enhancement cannot recover missing detail.');
      if(region&&inspectionConfig.tools.includes('inspect_region'))next_steps.push('OpenCV object region available. Consider inspect_region with supplied frames and a non-Bedrock detection_index.');
      if(dark||region)next_steps.push('For bounded agent-led follow-up, consider inspect_scene after explicit approval to send images to configured Bedrock models. Additional quota and inference costs apply.');
    }
    const result={...initial,inspection,next_steps,pipeline_events:pipelineEvents,usage_run_id:usageRunId};const thumbnail=result.thumbnail as string|undefined;delete result.thumbnail;
    result.privacy={...result.privacy,sent_to_bedrock:result.privacy.sent_to_bedrock||inspection.images_sent_to_bedrock===true,job_retention_days:7,thumbnail_stored:!!thumbnail};
    await saveJob({...job,status:'complete',durationMs:Date.now()-start,thumbnail,result});
    const response={...result,job_id:job.id};context.onEvent?.({type:'run.completed',job_id:job.id,data:response});return response;
  }
  catch(e){await saveJob({...job,status:'failed',durationMs:Date.now()-start,result:{pipeline_events:pipelineEvents},error:e instanceof MediaError?e.message:'Analysis failed'});throw e;}
}
