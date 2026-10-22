import{NextRequest,NextResponse}from'next/server';import{operator}from'@/lib/operator';import{hasAllowedOrigin}from'@/lib/request-origin';import{DeletionBlocked,deleteOrganization}from'@/lib/admin';
export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(process.env.AUTOVISION_DEPLOYMENT_MODE!=='saas')return NextResponse.json({error:'Organizations are disabled in private mode'},{status:403});
  const session=await operator(req);
  if(!session||session.role!=='root'||!hasAllowedOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});
  if((await req.json().catch(()=>null))?.confirmation!=='DELETE')return NextResponse.json({error:'Type DELETE to confirm'},{status:400});
  try{if(!await deleteOrganization((await params).id))return NextResponse.json({error:'not found'},{status:404})}
  catch(e){if(e instanceof DeletionBlocked)return NextResponse.json({error:e.message},{status:409});throw e}
  return NextResponse.json({status:'deleted'});
}
