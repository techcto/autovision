import {NextRequest,NextResponse} from 'next/server';
import {store} from '@/lib/store';
import {verifyPassword} from '@/lib/password';
import {normalizeEmail,sendVerificationEmail} from '@/lib/email-verification';
import {SignupError,requireEmailDelivery,limitAuthRequests,checkEmailDomain} from '@/lib/signup-policy';
import {readBody} from '@/lib/read-body';
// Existing users with no email must prove their password before attaching an address.
export async function POST(req:NextRequest){
 if(process.env.AUTOVISION_DEPLOYMENT_MODE!=='saas')return NextResponse.json({error:'Not available in private mode'},{status:403});
 try{
  requireEmailDelivery();await limitAuthRequests(req.headers,'resend');
  const input=JSON.parse(await readBody(req,4096));
  if(typeof input?.username!=='string'||input.username.length>40||typeof input.password!=='string'||input.password.length>256)throw new SignupError('Invalid email enrollment request');
  const email=normalizeEmail(input.email);if(!email)throw new SignupError('Enter a valid email address');checkEmailDomain(email);
  const user=await store.userByName(input.username),hash=user&&await store.password(user.id);
  if(!user||user.status!=='active'||!hash||!verifyPassword(input.password,hash))return NextResponse.json({error:'Invalid username or password'},{status:401});
  if(user.email)return NextResponse.json({error:'An email is already attached. Use the resend action.'},{status:409});
  if(!await store.claimUserEmail(user.id,email))return NextResponse.json({error:'Unable to attach this email. It may already be registered.'},{status:409});
  const verifyLink=await sendVerificationEmail(req,{...user,email,emailVerified:false},typeof input.next==='string'?input.next:undefined);
  return NextResponse.json({status:'verification-sent',...(verifyLink?{verifyLink}:{})});
 }catch(error){return NextResponse.json({error:error instanceof SignupError?error.message:'Unable to send verification email. Your account remains unverified; sign in and request a new link.'},{status:error instanceof SignupError?error.status:503});}
}
