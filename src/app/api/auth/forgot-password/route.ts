import{NextRequest,NextResponse}from'next/server';import{browserOrigin,createResetToken}from'@/lib/session';import{store}from'@/lib/store';import{notifier}from'@/lib/notifications';
import {localAuthLinks} from '@/lib/signup-policy';
export async function POST(req:NextRequest){
  const {username}=await req.json() as {username?:string};
  const secret=process.env.AUTOVISION_SESSION_SECRET;
  let resetLink:string|undefined;
  if(secret&&username){
    const user=await store.userByName(username);
    if(user&&user.status==='active'){
      const token=await createResetToken(user.id,secret);
      const link=`${browserOrigin(req)}/login/reset-password?token=${token}`;
      // Accounts created before email was collected have nowhere to send the link; log it rather than mailing the username.
      if(user.email)await notifier().send({channel:'email',destination:user.email,subject:'Reset your AutoVision password',text:`A password reset was requested for your AutoVision account. This link expires in 15 minutes: ${link}`}).catch(e=>console.error(JSON.stringify({level:'error',message:'password reset email failed',userId:user.id,error:String(e)})));
      else console.warn(JSON.stringify({level:'warn',message:'password reset requested for account without email',userId:user.id}));
      if(localAuthLinks())resetLink=link;
    }
  }
  return NextResponse.json({status:'ok',...(resetLink?{resetLink}:{})});
}

