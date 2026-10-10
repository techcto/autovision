import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import './public.css';
import './console-nav.css';
export const metadata={metadataBase:new URL('https://autovision.dev'),title:'AutoVision',description:'Visual signals for connected applications'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}


