import type {Frame} from './media-contract';
function wait(target: EventTarget, event: string) {
  return new Promise<void>((resolve, reject)=> {
    const timer = setTimeout(()=>finish(new Error('Media decoding timed out')),10_000);
    const ok = ()=>finish(), bad = ()=>finish(new Error('Your browser cannot decode this media'));
    function finish(error?: Error) {clearTimeout(timer);target.removeEventListener(event,ok);target.removeEventListener('error',bad);error?reject(error):resolve();}
    target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true});
  });
}
function capture(source: CanvasImageSource, width: number, height: number, at_ms: number): Frame {
  if (!width || !height || width*height>40_000_000) throw Error('Invalid or oversized media dimensions');
  const canvas=document.createElement('canvas'),ratio=Math.min(1,640/width,640/height);
  canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
  canvas.getContext('2d')!.drawImage(source,0,0,canvas.width,canvas.height);
  return {image:canvas.toDataURL('image/jpeg',0.8).split(',')[1],at_ms};
}
export async function sampleUpload(file: File, progress: (value: string)=>void): Promise<Frame[]> {
  if(file.size>20*1024*1024)throw Error('Choose a file smaller than 20 MB');
  if(['image/jpeg','image/png','image/webp'].includes(file.type)) {
    const bitmap=await createImageBitmap(file);
    try{return[capture(bitmap,bitmap.width,bitmap.height,0)];}finally{bitmap.close();}
  }
  if(!['video/mp4','video/webm','video/quicktime'].includes(file.type))throw Error('Choose JPEG, PNG, WebP, MP4, WebM, or MOV');
  const url=URL.createObjectURL(file),video=document.createElement('video');video.muted=true;video.preload='auto';
  try {
    const loaded=wait(video,'loadeddata');video.src=url;await loaded;
    let duration=video.duration;
    if(!Number.isFinite(duration)){
      const known=(file as File & {sampleDuration?:number}).sampleDuration;
      if(known)duration=known;
      else{const end=wait(video,'seeked');video.currentTime=1e10;await end;duration=Number.isFinite(video.duration)?video.duration:video.currentTime;}
    }
    if(!Number.isFinite(duration)||duration<=0||duration>30)throw Error('Choose a video up to 30 seconds long');
    const frames:Frame[]=[],count=Math.min(12,Math.max(2,Math.ceil(duration)+1));
    for(let i=0;i<count;i++) {
      const at=Math.min(Math.max(0,duration-0.05),i*duration/(count-1));
      if(Math.abs(video.currentTime-at)>0.001){const ready=wait(video,'seeked');video.currentTime=at;await ready;}
      frames.push(capture(video,video.videoWidth,video.videoHeight,Math.round(at*1000)));progress(`Sampling frame ${i+1} of ${count}`);
    }
    return frames;
  } finally {video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
export function syntheticFrames(): Frame[] {
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const c=canvas.getContext('2d')!;
  return Array.from({length:8},(_,i)=>{c.fillStyle='#101c32';c.fillRect(0,0,640,360);c.strokeStyle='#253653';for(let x=0;x<640;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,360);c.stroke();}c.fillStyle='#73efc3';c.fillRect(40+i*65,120,70,100);return{image:canvas.toDataURL('image/jpeg',0.8).split(',')[1],at_ms:i*1000};});
}
