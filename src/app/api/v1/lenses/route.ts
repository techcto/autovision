import {authenticateKey} from '@/lib/api-keys';
import {approvedModels,visionLenses} from '@/lib/vision-lenses';
export async function GET(request:Request){
 if(!await authenticateKey(request.headers.get('authorization')))return Response.json({error:'invalid API key'},{status:401});
 return Response.json({lenses:visionLenses,models:approvedModels().map(m=>({id:m.id,label:m.label,skills:m.skills})),note:'Implemented describes code support, not a runtime health guarantee. Planned lenses cannot be selected or executed.'},{headers:{'Cache-Control':'no-store'}});
}
