import PublicShell from '@/app/public-shell';
import PipelineDemo from '@/app/pipeline-demo';
import Link from 'next/link';
export const metadata={title:'AutoVision — inspect the autonomous vision pipeline',description:'Replay a real OpenCV 5 and Bedrock inspection trace, tool evidence, and human-review recommendation.'};
export default function PipelinePage(){return <PublicShell><main className="av-main"><Link href="/#pipeline">← Back to demo</Link><PipelineDemo standalone/></main></PublicShell>}
