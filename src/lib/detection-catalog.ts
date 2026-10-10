// COCO's 80 common object labels plus advisory scene categories.
export const objectGroups = {
  People: ['person'],
  Transport: ['bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light','fire hydrant','stop sign','parking meter'],
  Animals: ['bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe'],
  Accessories: ['backpack','umbrella','handbag','tie','suitcase'],
  Sports: ['frisbee','skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket'],
  Kitchen: ['bottle','wine glass','cup','fork','knife','spoon','bowl','microwave','oven','toaster','sink','refrigerator'],
  Food: ['banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake'],
  Home: ['bench','chair','couch','potted plant','bed','dining table','toilet','tv','laptop','mouse','remote','keyboard','cell phone','book','clock','vase','scissors','teddy bear','hair drier','toothbrush'],
  'Additional AI categories': ['package','smoke','fire'],
} as const;
export type ObjectLabel = typeof objectGroups[keyof typeof objectGroups][number];
export const objectLabels: ObjectLabel[] = Object.values(objectGroups).flat();
export const detectionPresets = {
  smartdetector: ['person','dog','cat','bird','car','bicycle','motorcycle','truck','package'],
  transport: ['person','bicycle','car','motorcycle','bus','train','truck','traffic light','stop sign'],
  all: objectLabels,
} satisfies Record<string,ObjectLabel[]>;
export function validateObjectLabels(value: unknown): ObjectLabel[] {
  if (!Array.isArray(value) || value.length > objectLabels.length || value.some(v => typeof v !== 'string' || !objectLabels.includes(v as ObjectLabel))) throw Error('Choose labels from the detection catalog');
  return [...new Set(value)] as ObjectLabel[];
}
