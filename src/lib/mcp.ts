import {approvedModels,visionLenses} from './vision-lenses';
import {hasAllowedOrigin} from '@/lib/request-origin';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {z} from 'zod';import {authenticateKey} from './api-keys';import {runJob,type ToolRequest} from './run-job';import {validateAnalysis,readBoundedJson} from './media-contract';
import type {RequestHandlerExtra} from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {ServerRequest,ServerNotification} from '@modelcontextprotocol/sdk/types.js';
import {mcpSummary,progressMessage} from './mcp-output';
type Extra=RequestHandlerExtra<ServerRequest,ServerNotification>;
export async function mcpRequest(request:Request){
  if(!hasAllowedOrigin(request))return Response.json({error:'Invalid origin'},{status:403});
  const key=await authenticateKey(request.headers.get('authorization'));if(!key)return Response.json({error:'Supply an AutoVision API key for MCP'},{status:401,headers:{'WWW-Authenticate':'Bearer'}});
  const server=new McpServer({name:'autovision',version:'0.1.0'});
  const runTool=async(input:unknown,extra:Extra,selected?:ToolRequest)=>{
    let progress=0,notifications=Promise.resolve();const progressToken=extra._meta?.progressToken;
    try{
      const result=await runJob(key.tenantId,{kind:'api_key',id:key.hash.slice(0,12),label:key.label},'mcp',validateAnalysis(input),selected,{signal:AbortSignal.any([extra.signal,request.signal]),onEvent:event=>{
        if(progressToken===undefined)return;
        const value=++progress,message=progressMessage(event);
        notifications=notifications.then(()=>extra.sendNotification({method:'notifications/progress',params:{progressToken,progress:value,message}})).catch(()=>{});
      }});
      await notifications;
      return{content:[{type:'text' as const,text:mcpSummary(result)}],structuredContent:result};
    }catch(e){await notifications;return{isError:true,content:[{type:'text' as const,text:e instanceof Error?e.message:'Analysis failed'}]};}
  };
  const tool=(input:unknown,extra:Extra)=>runTool(input,extra);
  const lensInput={frames:z.array(z.object({image:z.string().max(1_500_000),at_ms:z.number().min(0).max(30000)})).min(1).max(12),frame_index:z.number().int().min(0).max(11),detection_labels:z.array(z.string()).max(83).optional()};
  const lensAnnotations={readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true};
  server.registerTool('inspect_region',{description:'Remeasure supplied frames, crop an existing OpenCV detection by index and rerun OpenCV 5 YOLOX; advisory Bedrock boxes are rejected. Uses organization crop padding. No Bedrock. Charges initial frames plus one follow-up, saves private job evidence. Returns evidence only; caller owns decisions.',inputSchema:{...lensInput,detection_index:z.number().int().min(0).max(19)},annotations:lensAnnotations},async (input,extra)=>runTool({...input,classify:false,enhanced:false},extra,{name:'inspect_region',args:{frame_index:input.frame_index,detection_index:input.detection_index}}));
  server.registerTool('enhance_low_light',{description:'Measure supplied frames, apply configured CLAHE to a dark frame and rerun OpenCV 5 YOLOX. Rejects frames above the organization brightness threshold. No Bedrock. Charges initial frames plus one follow-up and saves private evidence. Not night vision.',inputSchema:lensInput,annotations:lensAnnotations},async (input,extra)=>runTool({...input,classify:false,enhanced:false},extra,{name:'enhance_low_light',args:{frame_index:input.frame_index}}));
  server.registerTool('assess_scene',{description:'Explicitly send a supplied frame to the organization-approved Bedrock scene, package or activity lens after OpenCV measurement. Advisory evidence only, not identity/intent/danger. Charges initial frames plus one follow-up and retains a private job. No external actions.',inputSchema:{...lensInput,focus:z.enum(['scene','package','activity']).default('scene')},annotations:lensAnnotations},async (input,extra)=>runTool({...input,classify:true,enhanced:false},extra,{name:'assess_scene',args:{frame_index:input.frame_index,focus:input.focus}}));
  server.registerTool('analyze_image',{title:'Analyze an image',description:'Analyze supplied base64 JPEG/PNG bytes. Returns OpenCV YOLOX object observations (person plus requested COCO labels) and optional Bedrock scene summary. Not a safety alarm. Charges image quota and records a private job. Does not accept URLs.',inputSchema:{image:z.string().max(1_500_000),classify:z.boolean().default(true),enhanced:z.boolean().optional(),detection_labels:z.array(z.string()).max(83).optional()},outputSchema:z.object({job_id:z.string()}).passthrough(),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true}},tool);
  server.registerTool('analyze_video_frames',{title:'Analyze a sampled video',description:'Analyze 1–12 ordered JPEG/PNG frames spanning up to 30 seconds. Returns motion timeline, OpenCV YOLOX object observations per frame and optional AI summary, records private history, and charges one quota unit per frame. Sampling may miss events.',inputSchema:{frames:z.array(z.object({image:z.string().max(1_500_000),at_ms:z.number().min(0).max(30000)})).min(1).max(12),classify:z.boolean().default(true),enhanced:z.boolean().optional(),detection_labels:z.array(z.string()).max(83).optional()},outputSchema:z.object({job_id:z.string()}).passthrough(),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true}},tool);
  server.registerTool('inspect_scene',{title:'Autonomous scene inspection',description:'Opt-in bounded inspection. Runs initial OpenCV 5 measurements, then a Bedrock planner chooses crop/re-detection, low-light enhancement or focused assessment. Returns an auditable trace and advisory human-review recommendation. Uses extra image quota and retains private sampled evidence. No notifications or external actions.',inputSchema:{frames:z.array(z.object({image:z.string().max(1_500_000),at_ms:z.number().min(0).max(30000)})).min(1).max(12),detection_labels:z.array(z.string()).max(83).optional()},outputSchema:z.object({job_id:z.string()}).passthrough(),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true}},async (input,extra)=>tool({...input,classify:true,enhanced:true},extra));
  server.registerTool('list_vision_lenses',{title:'List vision lenses',description:'Discover implemented, separate-API and planned lenses plus approved AI model keys and skills. No inference, quota charge or job creation.',inputSchema:{},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async()=>({content:[{type:'text' as const,text:JSON.stringify({lenses:visionLenses,models:approvedModels().map(m=>({id:m.id,label:m.label,skills:m.skills}))})}]}));
  const parsedBody=request.method==='POST'?await readBoundedJson(request):undefined;
  const progressRequested=!!parsedBody&&typeof parsedBody==='object'&&!Array.isArray(parsedBody)&&'params' in parsedBody&&!!(parsedBody.params as {_meta?:{progressToken?:unknown}})?._meta&&((parsedBody.params as {_meta:{progressToken?:unknown}})._meta.progressToken!==undefined);
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:!progressRequested});
  try{
    await server.connect(transport);const response=await transport.handleRequest(request,{parsedBody});
    if(!response.body||!response.headers.get('content-type')?.includes('text/event-stream')){await server.close();return response;}
    const reader=response.body.getReader();
    return new Response(new ReadableStream({async pull(controller){try{const part=await reader.read();if(part.done){controller.close();await server.close();}else controller.enqueue(part.value);}catch(error){controller.error(error);await server.close();}},async cancel(){await reader.cancel();await server.close();}}),{status:response.status,headers:response.headers});
  }catch(error){await server.close();throw error;}
}
