import {hasAllowedOrigin} from '@/lib/request-origin';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {z} from 'zod';import {authenticateKey} from './api-keys';import {runJob} from './run-job';import {validateAnalysis,readBoundedJson} from './media-contract';
export async function mcpRequest(request:Request){
  if(!hasAllowedOrigin(request))return Response.json({error:'Invalid origin'},{status:403});
  const key=await authenticateKey(request.headers.get('authorization'));if(!key)return Response.json({error:'Supply an AutoVision API key for MCP'},{status:401,headers:{'WWW-Authenticate':'Bearer'}});
  const server=new McpServer({name:'autovision',version:'0.1.0'});
  const tool=async(input:unknown)=>{try{const result=await runJob(key.tenantId,{kind:'api_key',id:key.hash.slice(0,12),label:key.label},'mcp',validateAnalysis(input));return{content:[{type:'text' as const,text:JSON.stringify(result)}],structuredContent:result};}catch(e){return{isError:true,content:[{type:'text' as const,text:e instanceof Error?e.message:'Analysis failed'}]};}};
  server.registerTool('analyze_image',{title:'Analyze an image',description:'Analyze supplied base64 JPEG/PNG bytes. Returns measured pedestrian observations and optional Bedrock scene summary. Not a safety alarm. Charges image quota and records a private job. Does not accept URLs.',inputSchema:{image:z.string().max(1_500_000),classify:z.boolean().default(true)},outputSchema:z.object({job_id:z.string()}).passthrough(),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true}},tool);
  server.registerTool('analyze_video_frames',{title:'Analyze a sampled video',description:'Analyze 1–12 ordered JPEG/PNG frames spanning up to 30 seconds. Returns motion timeline and optional AI summary, records private history, and charges one quota unit per frame. Sampling may miss events.',inputSchema:{frames:z.array(z.object({image:z.string().max(1_500_000),at_ms:z.number().min(0).max(30000)})).min(1).max(12),classify:z.boolean().default(true)},outputSchema:z.object({job_id:z.string()}).passthrough(),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true}},tool);
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  try{await server.connect(transport);const parsedBody=request.method==='POST'?await readBoundedJson(request):undefined;return await transport.handleRequest(request,{parsedBody});}finally{await server.close();}
}
