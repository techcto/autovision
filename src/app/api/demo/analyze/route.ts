import type {ConverseCommand} from '@aws-sdk/client-bedrock-runtime';
import {analyzeMedia} from '@/lib/media-analysis';
import {hasAllowedOrigin} from '@/lib/request-origin';
import {publicBudget} from '@/lib/public-budget';
import {readBoundedJson, validateAnalysis, MediaError} from '@/lib/media-contract';
import {defaultInspection} from '@/lib/inspection-config';
import {inspectAutonomously} from '@/lib/autonomous-inspection';
import {pipelineStream} from '@/lib/pipeline-stream';
import type {PipelineContext} from '@/lib/pipeline-events';
import {createBedrockClient} from '@/lib/bedrock-client';
import {PUBLIC_DEMO_SCOPE,withUsageScope} from '@/lib/usage-ledger';
import {randomUUID} from 'node:crypto';
const bedrock=createBedrockClient();
// Anonymous planner calls also draw on the public allowance; customer billing scopes are not used here.
const budgetedSend=async(command:ConverseCommand,signal:AbortSignal)=>{if(!await publicBudget())throw new MediaError('Public demo daily allowance reached',429);return bedrock.send(command,{abortSignal:signal});};
export async function POST(request: Request) {
  try {
    if (!hasAllowedOrigin(request)) return Response.json({error:'Cross-origin demo is not allowed'},{status:403});
    const input = validateAnalysis(await readBoundedJson(request));
    if (!await publicBudget()) return Response.json({error:'Public demo daily allowance reached or disabled. Use your API key for integration.'},{status:429});
    // Anonymous demo inference is recorded under the operator scope, never a customer's.
    const run=(context:PipelineContext={})=>withUsageScope(PUBLIC_DEMO_SCOPE,randomUUID(),async()=>{
      context.onEvent?.({type:'run.started'});
      context.onEvent?.({type:'step.started',step_id:'perception',title:'OpenCV 5 perception'});
      const initial=await analyzeMedia(input,context.signal);
      context.onEvent?.({type:'step.completed',step_id:'perception',data:{observations:initial.observations,engine_version:initial.engine_version,classification:initial.classification}});
      const inspection=input.enhanced?await inspectAutonomously(input,initial,defaultInspection,publicBudget,{...context,send:budgetedSend}):{status:'not_requested',review_recommended:false,reason:'Enhanced inspection disabled.',followup_count:0,trace:[],images_sent_to_bedrock:false};
      const result={...initial,inspection,privacy:{...initial.privacy,sent_to_bedrock:initial.privacy.sent_to_bedrock||inspection.images_sent_to_bedrock===true,job_stored:false}};
      context.onEvent?.({type:'run.completed',data:result});return result;
    });
    if(request.headers.get('accept')?.includes('text/event-stream'))return pipelineStream(request,run);
    return Response.json(await run(),{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return Response.json({error:e instanceof MediaError?e.message:'Demo temporarily unavailable'}, {status:e instanceof MediaError?e.status:503});}
}
