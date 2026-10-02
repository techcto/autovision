import Link from'next/link';import Keys from'./api-keys';export default function Settings(){return<main><section className="hero"><h1>Settings</h1><p>Manage access to your image detection API.</p></section><Keys/><Link href="/settings/billing">Manage payment plan</Link></main>}

