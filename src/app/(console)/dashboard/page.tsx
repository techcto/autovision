import Console from '../../platform-console';
export default function Dashboard(){return <><section className="hero compact-hero"><div className="eyebrow">AutoVision console</div><h1>Analysis jobs</h1><p className="muted">Track your visual API usage and run an analysis.</p></section><Console showBilling={process.env.AUTOVISION_DEPLOYMENT_MODE==='saas'}/></>;}
