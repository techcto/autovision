import{NextRequest,NextResponse}from'next/server';import{randomUUID}from'node:crypto';import{operator}from'@/lib/operator';import{store}from'@/lib/store';import type{MembershipRole,OrgMembership}from'@/lib/model';import{hashPassword}from'@/lib/password';import{normalizeEmail}from'@/lib/email-verification';
import {sendVerificationEmail} from '@/lib/email-verification';
import {SignupError,checkEmailDomain,requireEmailDelivery} from '@/lib/signup-policy';
import {requestOrigin} from '@/lib/session';
export async function GET(req:NextRequest){
  const session=await operator(req);
  if(!session)return NextResponse.json({error:'unauthorized'},{status:401});
  const members=await store.membersOfOrg(session.orgId);
  return NextResponse.json(members.map(({membership,user})=>({id:user.id,username:user.username,displayName:user.displayName,role:membership.role,status:membership.status,createdAt:membership.createdAt})));
}
export async function POST(req:NextRequest){
  const session=await operator(req);
  if(!session||!['root','admin'].includes(session.role)||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});
  const v=await req.json() as {username?:string;displayName?:string;email?:string;role?:MembershipRole;password?:string};
  if(!v.username||!v.role||!['admin','operator','viewer'].includes(v.role))return NextResponse.json({error:'Invalid user or role'},{status:400});
  const now=new Date().toISOString();
  let user=await store.userByName(v.username);
  if(user){
    const existing=await store.membership(session.orgId,user.id);
    if(existing)return NextResponse.json({error:'user is already a member of this organization'},{status:409});
  }else{
    if(!v.displayName||!v.password||v.password.length<12)return NextResponse.json({error:'Invalid user or password shorter than 12 characters'},{status:400});
    const requireVerification=process.env.AUTOVISION_DEPLOYMENT_MODE==='saas';
    const email=v.email?normalizeEmail(v.email):undefined;if(email===null||requireVerification&&!email)return NextResponse.json({error:'Enter a valid email address'},{status:400});
    if(requireVerification){try{requireEmailDelivery();checkEmailDomain(email!);}catch(e){return NextResponse.json({error:e instanceof SignupError?e.message:'Email verification unavailable'},{status:e instanceof SignupError?e.status:503});}}
    user={id:randomUUID(),username:v.username.trim(),displayName:v.displayName.trim(),...(email?{email}:{}),...(requireVerification?{emailVerified:false}:{}),status:'active',createdAt:now,updatedAt:now};
    if(!await store.createUser(user,hashPassword(v.password)))return NextResponse.json({error:'This email is already taken'},{status:409});
  }
  const membership:OrgMembership={id:randomUUID(),orgId:session.orgId,userId:user.id,role:v.role,status:'active',invitedByUserId:session.id,createdAt:now,updatedAt:now};
  await store.putMembership(membership);
  if(user.emailVerified===false){try{await sendVerificationEmail(req,user);}catch(e){return NextResponse.json({error:e instanceof SignupError?e.message:'Unable to send verification email. The account remains unverified.'},{status:503});}}
  return NextResponse.json({id:user.id,username:user.username,displayName:user.displayName,role:membership.role,status:membership.status,createdAt:membership.createdAt},{status:201});
}

