import{NextRequest,NextResponse}from'next/server';import{createResetToken,isSecureRequest}from'@/lib/session';import{store}from'@/lib/store';import{notifier}from'@/lib/notifications';
export async function POST(req:NextRequest){
  const {username}=await req.json() as {username?:string};
  const secret=process.env.AUTOVISION_SESSION_SECRET;
  let resetLink:string|undefined;
  if(secret&&username){
    const user=await store.userByName(username);
    if(user&&user.status==='active'){
      const token=await createResetToken(user.id,secret);
      // The browser-facing Host, not the container's bind address; never X-Forwarded-Host, so a request cannot point the emailed link elsewhere.
      const origin=`${isSecureRequest(req)?'https:':'http:'}//${req.headers.get('host')}`;
      const link=`${origin}/login/reset-password?token=${token}`;
      await notifier().send({channel:'email',destination:user.username,subject:'Reset your AutoVision password',text:`A password reset was requested for your AutoVision account. This link expires in 15 minutes: ${link}`}).catch(()=>{});
      if(process.env.AUTOVISION_NOTIFICATION_MODE!=='aws')resetLink=link;
    }
  }
  return NextResponse.json({status:'ok',...(resetLink?{resetLink}:{})});
}

