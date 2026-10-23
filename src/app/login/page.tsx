import LoginForm from './login-form';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{verify?:string}>}){const {verify}=await searchParams;return <main className="min-vh-100 d-flex align-items-center justify-content-center"><section className="g-card login-card"><div className="eyebrow">AutoVision control plane</div><h1>Understand your environment.</h1><p className="muted">{process.env.AUTOVISION_DEPLOYMENT_MODE==='saas'?'Sign in to your workspace, or create an account to get started.':'Sign in with your deployment credentials to manage API keys and settings.'}</p>{verify==='done'&&<div className="notice" role="status"><strong>Email verified</strong><span>Your email address is confirmed. Sign in to continue.</span></div>}<LoginForm allowSignup={process.env.AUTOVISION_DEPLOYMENT_MODE==='saas'}/></section></main>}


