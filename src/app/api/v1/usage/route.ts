import{NextRequest,NextResponse}from'next/server';import{operator}from'@/lib/operator';import{usageFor}from'@/lib/api-keys';export async function GET(req:NextRequest){const s=await operator(req);if(!s)return NextResponse.json({error:'unauthorized'},{status:401});return NextResponse.json(await usageFor(s.orgId))}

