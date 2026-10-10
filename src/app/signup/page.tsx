import Link from 'next/link';
import {notFound} from 'next/navigation';
import LoginForm from '../login/login-form';
export const dynamic='force-dynamic';
export default function Signup(){
 if(process.env.AUTOVISION_DEPLOYMENT_MODE!=='saas')notFound();
 return <main className="min-vh-100 d-flex align-items-center justify-content-center"><section className="g-card login-card"><Link href="/">← AutoVision</Link><div className="eyebrow mt-3">Your visual intelligence workspace</div><h1>Create your account.</h1><p className="muted">Start with a free personal workspace. Run image and video analysis, review jobs, and create API keys for REST and MCP.</p><LoginForm allowSignup initialMode="signup"/></section></main>;
}
