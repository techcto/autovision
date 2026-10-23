import Link from 'next/link';
import VerifyEmail from './verify-email';
export default async function VerifyEmailPage({searchParams}:{searchParams:Promise<{token?:string;next?:string}>}){const {token,next}=await searchParams;return <main className="min-vh-100 d-flex align-items-center justify-content-center"><section className="card g-card login-card"><div className="eyebrow">AutoVision control plane</div><h1>Verify your email.</h1><VerifyEmail token={token??''} next={next??''}/><p className="muted small" style={{marginTop:20}}><Link href="/login">Back to sign in</Link></p></section></main>}
