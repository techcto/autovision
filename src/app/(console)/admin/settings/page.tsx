import {rootSession,saasMode} from '@/lib/admin';
import {Card,Facts,PageHeader} from '../admin-ui';
const configured=(v?:string)=>v?'Configured':'Not configured';
export default async function AdminSettings(){
 await rootSession();
 const e=process.env,saas=saasMode();
 const facts:[string,string][]=[
  ['Deployment mode',saas?'SaaS':'Private installation'],
  ['Data store',e.AUTOVISION_TABLE?(e.AUTOVISION_DYNAMODB_ENDPOINT?'DynamoDB local':'DynamoDB'):'In-memory (not persistent)'],
  ['Job retention','7 days'],
  ['Vision service',configured(e.AUTOVISION_VISION_URL)],
  ['Bedrock model',e.BEDROCK_MODEL_ID||'Not configured'],
  ['Event queue',configured(e.AUTOVISION_QUEUE_URL)],
  ['Public demo',e.AUTOVISION_PUBLIC_DEMO_ENABLED==='true'?'Enabled':'Disabled'],
  ...(saas?[['Stripe billing',configured(e.STRIPE_SECRET_KEY)] as [string,string]]:[]),
 ];
 return <><PageHeader eyebrow="System" title="Settings" description="Installation-wide configuration, read-only. Values come from deployment configuration; secrets are never displayed."/>
 <Card title="Installation"><Facts items={facts}/></Card>
 <p className="muted small">Organization settings such as API keys and object detection live under each organization&apos;s Settings.</p></>;
}
