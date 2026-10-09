import {analyzeMedia} from '@/lib/media-analysis';
import {hasAllowedOrigin} from '@/lib/request-origin';
import {publicBudget} from '@/lib/public-budget';
import {readBoundedJson, validateAnalysis, MediaError} from '@/lib/media-contract';
export async function POST(request: Request) {
  try {
    if (!hasAllowedOrigin(request)) return Response.json({error:'Cross-origin demo is not allowed'},{status:403});
    const input = validateAnalysis(await readBoundedJson(request));
    if (!await publicBudget()) return Response.json({error:'Public demo daily allowance reached or disabled. Use your API key for integration.'},{status:429});
    return Response.json(await analyzeMedia(input),{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return Response.json({error:e instanceof MediaError?e.message:'Demo temporarily unavailable'}, {status:e instanceof MediaError?e.status:503});}
}
