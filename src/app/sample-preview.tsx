'use client';
import {useEffect, useRef} from 'react';
import {drawSampleScene, type SampleScene} from '@/lib/sample-clips';

export default function SamplePreview({scene}: {scene: SampleScene}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false, animation = 0;
    const draw = (time: number) => {
      drawSampleScene(context, scene, (time % 3600) / 3600);
      if (visible && !motion.matches && !document.hidden) animation = requestAnimationFrame(draw);
    };
    const update = () => {
      cancelAnimationFrame(animation);
      drawSampleScene(context, scene, 0.45);
      if (visible && !motion.matches && !document.hidden) animation = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {visible = entry.isIntersecting; update();});
    observer.observe(canvas);
    motion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      cancelAnimationFrame(animation); observer.disconnect();
      motion.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [scene]);
  return <canvas ref={ref} width={640} height={360} className="av-sample-preview" aria-hidden="true"/>;
}
