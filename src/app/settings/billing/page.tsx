import BillingConsole from'../../billing/billing-console';export default function Billing(){return<main><section className="hero"><h1>Billing</h1></section>{process.env.AUTOVISION_DEPLOYMENT_MODE==='saas'?<BillingConsole/>:<p>Billing is disabled for private installations.</p>}</main>}

