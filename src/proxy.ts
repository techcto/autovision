import{NextRequest,NextResponse}from'next/server';import{sessionCookie,verifySession}from'@/lib/session';
export async function proxy(req:NextRequest){const p=req.nextUrl.pathname;if(p.startsWith('/login')||p.startsWith('/api/auth/')||p==='/api/health'||p==='/api/v1/signals'||p==='/api/v1/detect'||p==='/api/billing/webhook')return NextResponse.next();const s=await verifySession(req.cookies.get(sessionCookie)?.value,process.env.AUTOVISION_SESSION_SECRET??'');if(s)return NextResponse.next();if(p.startsWith('/api/'))return NextResponse.json({error:'unauthorized'},{status:401});return NextResponse.redirect(new URL('/login',req.url))}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};


