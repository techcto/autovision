import MarketplaceSubscribe from '../marketplace-subscribe';
import LoginForm from './login-form';
export default function Login(){return <main className="min-vh-100 d-flex align-items-center justify-content-center"><section className="g-card login-card"><div className="eyebrow">AutoVision control plane</div><h1>Understand your environment.</h1><p className="muted">Sign in with an existing account or create your AutoVision workspace.</p><LoginForm allowSignup={process.env.AUTOVISION_DEPLOYMENT_MODE==='saas'}/></section></main>}


