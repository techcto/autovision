export type SampleScene='dog'|'visitor'|'delivery';
export const sampleScenes:{id:SampleScene;title:string;description:string;icon:string}[]=[{id:'dog',title:'Dog in the yard',description:'A pet crosses the garden.',icon:'🐕'},{id:'visitor',title:'Night-time visitor',description:'An unfamiliar figure approaches the porch.',icon:'🌙'},{id:'delivery',title:'Delivery at the door',description:'A courier arrives carrying a parcel.',icon:'📦'}];
export function drawSampleScene(c:CanvasRenderingContext2D,kind:SampleScene,t:number){
  const night=kind==='visitor',x=70+t*350;c.fillStyle=night?'#17223f':'#c8e9ef';c.fillRect(0,0,640,360);
  c.fillStyle=night?'#354361':'#88ae82';c.fillRect(0,240,640,120);c.fillStyle='#b7ab99';c.fillRect(410,70,195,210);c.fillStyle='#665c50';c.beginPath();c.moveTo(385,80);c.lineTo(505,20);c.lineTo(625,80);c.fill();c.fillStyle='#354653';c.fillRect(472,160,64,120);c.fillStyle='#f9ce72';c.fillRect(438,118,22,28);c.fillRect(553,118,22,28);c.fillStyle='#d9cdb8';c.fillRect(390,280,230,18);c.fillStyle='#87a4b0';c.fillRect(20,80,140,40);c.fillStyle='#fff';c.font='12px monospace';c.fillText('SYNTHETIC DEMO',30,105);
  c.fillStyle='#17203355';c.beginPath();c.ellipse(x+30,301,58,10,0,0,Math.PI*2);c.fill();
  if(kind==='dog'){
    c.fillStyle='#bf8b55';c.beginPath();c.ellipse(x+30,267,42,21,0,0,Math.PI*2);c.fill();c.beginPath();c.arc(x+68,247,21,0,Math.PI*2);c.fill();c.fillStyle='#805837';c.beginPath();c.moveTo(x+55,234);c.lineTo(x+49,265);c.lineTo(x+69,250);c.fill();c.fillStyle='#bf8b55';for(const dx of [5,48])c.fillRect(x+dx,278,10,25+Math.sin(t*35+dx)*4);c.strokeStyle='#bf8b55';c.lineWidth=10;c.beginPath();c.moveTo(x-5,263);c.lineTo(x-22,240+Math.sin(t*20)*10);c.stroke();c.fillStyle='#152335';c.beginPath();c.arc(x+76,244,3,0,Math.PI*2);c.fill();c.beginPath();c.arc(x+87,252,4,0,Math.PI*2);c.fill();
  }else{
    const y=225;c.fillStyle=kind==='delivery'?'#718cd5':'#68748d';c.fillRect(x,y,40,55);c.strokeStyle='#263650';c.lineWidth=12;for(const sign of [-1,1]){c.beginPath();c.moveTo(x+20+sign*11,y+50);c.lineTo(x+20+sign*(16+Math.sin(t*28)*9),305);c.stroke();}c.fillStyle='#d0a782';c.beginPath();c.arc(x+20,y-18,17,0,Math.PI*2);c.fill();c.strokeStyle=kind==='delivery'?'#718cd5':'#68748d';c.lineWidth=10;c.beginPath();c.moveTo(x+35,y+10);c.lineTo(x+60,y+35);c.stroke();if(kind==='delivery'){c.fillStyle='#c39b66';c.fillRect(x+41,y+20,36,27);c.strokeStyle='#8d6b3f';c.lineWidth=2;c.strokeRect(x+41,y+20,36,27);c.beginPath();c.moveTo(x+59,y+20);c.lineTo(x+59,y+47);c.stroke();}
  }
  c.fillStyle='#172033bb';c.fillRect(0,330,640,30);c.fillStyle='#fff';c.font='12px monospace';c.fillText('ILLUSTRATED SAMPLE · NOT REAL SECURITY FOOTAGE',15,350);
}
export async function createSampleClip(kind:SampleScene):Promise<File>{
  if(typeof MediaRecorder==='undefined')throw Error('This browser cannot generate sample video. Try an uploaded clip instead.');
  const type=['video/webm;codecs=vp8','video/webm','video/mp4'].find(v=>MediaRecorder.isTypeSupported(v));if(!type)throw Error('No supported sample-video codec');
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const c=canvas.getContext('2d')!,stream=canvas.captureStream(12),recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:500000}),chunks:BlobPart[]=[];
  const done=new Promise<Blob>((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType}));recorder.onerror=()=>reject(Error('Sample recording failed'));});
  drawSampleScene(c,kind,0);recorder.start();const start=performance.now();let timer:ReturnType<typeof setInterval>|undefined;
  try{timer=setInterval(()=>{const t=Math.min(1,(performance.now()-start)/3000);drawSampleScene(c,kind,t);if(t>=1){clearInterval(timer);recorder.stop();}},80);const blob=await done;return Object.assign(new File([blob],`autovision-${kind}-synthetic.${type.startsWith('video/mp4')?'mp4':'webm'}`,{type:blob.type.split(';')[0]}),{sampleDuration:3});}finally{clearInterval(timer);stream.getTracks().forEach(track=>track.stop());}
}
