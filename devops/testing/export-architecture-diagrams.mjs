import {writeFile} from 'node:fs/promises';
import sharp from 'sharp';
const root=new URL('../../',import.meta.url);
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
function canvas(title,sub){return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" viewBox="0 0 1800 1200" role="img"><title>${escape(title)}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10" fill="#ed3049"/></marker></defs><rect width="1800" height="1200" fill="#101114"/><g font-family="DejaVu Sans,Arial,sans-serif"><text x="70" y="90" fill="white" font-size="44" font-weight="700">${escape(title)}</text><text x="70" y="140" fill="#b7bac3" font-size="23">${escape(sub)}</text>`;}
function fit(text,width,size){return text.length*size*.58>width?` textLength="${width}" lengthAdjust="spacingAndGlyphs"`:'';}
function box(x,y,w,h,title,lines,accent=false){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${accent?'#301720':'#202229'}" stroke="${accent?'#ed3049':'#50535f'}" stroke-width="2"/><text x="${x+24}" y="${y+42}" fill="white" font-size="26" font-weight="700"${fit(title,w-48,26)}>${escape(title)}</text>`+lines.map((s,i)=>`<text x="${x+24}" y="${y+82+i*30}" fill="#c8cbd3" font-size="21"${fit(s,w-48,21)}>${escape(s)}</text>`).join('');}
function arrow(points,label,x,y){return `<polyline points="${points}" fill="none" stroke="#ed3049" stroke-width="3" marker-end="url(#arrow)"/>`+(label?`<text x="${x}" y="${y}" fill="#ff8c9c" font-size="19">${escape(label)}</text>`:'');}
function note(y,text){return `<text x="70" y="${y}" fill="#b7bac3" font-size="21">${escape(text)}</text>`;}
let aws=canvas('AutoVision / AWS deployment architecture','Standalone service • hosted SaaS or private AWS account • logical architecture, not a packet-level network map');
aws+=box(70,205,380,150,'Applications + agents',['Web console / REST / MCP','Organization-scoped credentials']);
aws+=box(560,205,470,150,'HTTPS Application Load Balancer',['Web UI + API + MCP routing','Health-based service routing'],true);
aws+=box(1140,205,590,150,'Deployment + operations',['CloudFormation / IAM / Secrets Manager','CloudWatch logs + structured traces']);
aws+=arrow('450,280 550,280');
aws+=box(70,455,380,180,'Web / Fargate',['Next.js + React console','Uploads, jobs and settings','Browser samples bounded video']);
aws+=box(560,455,560,180,'API / Fargate',['Tenant auth, quota and job orchestration','Bedrock Decider + vision sidecar','Private COOL backend can replace sidecar'],true);
aws+=box(1240,455,490,180,'Amazon Bedrock',['Approved planner + assessment models','Optional consented image delegation','Structured tool results, not hidden reasoning']);
aws+=arrow('690,355 690,395 260,395 260,445');aws+=arrow('840,355 840,445');aws+=arrow('1120,540 1230,540','model calls',1135,520);
aws+=box(70,760,380,170,'DynamoDB + private S3',['Tenant jobs / settings / usage','Bounded previews + evidence where used','Retention and access controls']);
aws+=box(560,760,360,170,'SQS + dead-letter queue',['Asynchronous incident path','Not every vision request uses SQS']);
aws+=box(1030,760,360,170,'Worker / Fargate',['Background incident processing','OpenCV sidecar / optional AI','Configured notifications']);
aws+=box(1460,760,270,170,'Optional COOL',['Private licensed backend','Graviton / Arm execution','Separate host + evidence']);
aws+=arrow('650,635 650,690 270,690 270,750');aws+=arrow('840,635 840,750');aws+=arrow('920,845 1020,845');aws+=arrow('1120,625 1170,625 1170,700 1595,700 1595,750','selected backend',1320,684);
aws+=note(1010,'Standard mode: bundled OpenCV 5 sidecars. COOL mode: separately provisioned compatible private service.');
aws+=note(1055,'Private-install templates and delivery tooling are built and contract-tested. AutoVision Marketplace listing: coming soon.');
aws+=note(1100,'COOL configuration is not proof of acceleration. Submit actual runtime, Graviton workload trace and baseline comparison.');
aws+='</g></svg>';
let flow=canvas('AutoVision / evidence-driven agent inspection','OpenCV measures → Decider chooses → tool executes → returned evidence informs the next step');
flow+=box(70,210,400,170,'1 / PERCEIVE',['Consented image or sampled frames','OpenCV 5: objects, motion, brightness','Keep initial evidence'],true);
flow+=box(600,210,500,170,'2 / DECIDE',['Trigger policy + approved tool catalog','Bedrock evaluates accumulated evidence','Choose frame, region or assessment focus'],true);
flow+=box(1230,210,500,170,'3 / ACT: inspect deeper',['Validated allowlisted tool call','Frame / region / consent / quota checks','No arbitrary commands or external actions'],true);
flow+=arrow('470,295 590,295');flow+=arrow('1100,295 1220,295');
flow+=box(70,525,470,180,'Crop + re-detect',['inspect_region','Crop an existing OpenCV detection','Rerun pinned YOLOX; preserve context']);
flow+=box(665,525,470,180,'Enhance + remeasure',['enhance_low_light','Bounded CLAHE luminance enhancement','Rerun YOLOX; missing detail stays missing']);
flow+=box(1260,525,470,180,'Focused model assessment',['assess_scene','Scene / package / activity lens','Resolves to an operator-approved model']);
flow+=arrow('1480,380 1480,455 305,455 305,515');flow+=arrow('1480,455 900,455 900,515');flow+=arrow('1480,455 1495,515');
flow+=box(600,845,600,140,'4 / EVALUATE ACTUAL TOOL RESULTS',['Measurements return to the Decider before next turn','Another tool if useful and within the remaining budget'],true);
flow+=arrow('305,705 305,790 720,790 720,835');flow+=arrow('900,705 900,835');flow+=arrow('1495,705 1495,790 1080,790 1080,835');
flow+=arrow('600,920 35,920 35,180 850,180 850,200','Evidence feedback: add a useful next step',95,894);
flow+=box(1290,845,440,140,'FINISH / HUMAN CONTROL',['Advisory review recommendation','Failures retain evidence and request review']);flow+=arrow('1200,915 1280,915');
flow+=note(1050,'Bounded internal loop: ≤2 follow-ups • ≤3 planner calls • 35-second inspection budget, plus initial analysis.');
flow+=note(1095,'Models are configured per lens—not arbitrary model downloads, autonomous retraining or a performance bake-off.');
flow+=note(1140,'No trigger ≠ safe or empty. External agents composing individual MCP tools own their own cross-call budget.');flow+='</g></svg>';
for(const [name,svg]of [['aws-stack',aws],['agent-flow',flow]]){await writeFile(new URL('public/'+name+'.svg',root),svg);await sharp(Buffer.from(svg)).png().toFile(new URL('public/'+name+'.png',root).pathname);}
// Preserve the old architecture URL with the current AWS diagram.
await writeFile(new URL('public/architecture.svg',root),aws);
console.log('Exported AWS stack and agent workflow diagrams (SVG + 1800x1200 PNG).');
