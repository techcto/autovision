'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export default function ConsoleNavigation({saas}:{saas:boolean}){
 const path=usePathname(),items=[{href:'/dashboard',label:'Dashboard'},{href:'/settings',label:'Settings'},...(saas?[{href:'/settings/billing',label:'Plans'}]:[])];
 return <nav className="av-console-links" aria-label="Console navigation">{items.map(i=>{const active=i.label==='Settings'?path.startsWith('/settings')&&!path.startsWith('/settings/billing'):i.label==='Plans'?path.startsWith('/settings/billing')||path==='/billing':path.startsWith(i.href);return <Link key={i.href} href={i.href} aria-current={active?'page':undefined}>{i.label}</Link>})}</nav>;
}
