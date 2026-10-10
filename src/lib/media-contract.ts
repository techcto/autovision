import {ObjectLabel,validateObjectLabels} from './detection-catalog';
export const MAX_BODY = 4_000_000;
export type Frame = {image: string; at_ms: number};
export type AnalysisInput = {frames: Frame[]; classify?: boolean; detection_labels?: ObjectLabel[]};
export class MediaError extends Error {
  constructor(message: string, public status = 400) {super(message);}
}
export function validateAnalysis(value: unknown): AnalysisInput {
  if (!value || typeof value !== 'object') throw new MediaError('Supply an image or frames');
  const v = value as Record<string, unknown>;
  const frames = v.frames ?? (typeof v.image === 'string' ? [{image: v.image, at_ms: 0}] : null);
  if (!Array.isArray(frames) || frames.length < 1 || frames.length > 12) throw new MediaError('Supply 1–12 frames');
  if (v.classify !== undefined && typeof v.classify !== 'boolean') throw new MediaError('classify must be boolean');
  let last = -1, size = 0;
  for (const frame of frames) {
    if (!frame || typeof frame !== 'object' || typeof frame.image !== 'string' || !Number.isFinite(frame.at_ms) || frame.at_ms <= last || frame.at_ms > 30_000) throw new MediaError('Frames require ordered timestamps within 30 seconds');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(frame.image) || !frame.image || frame.image.length > 1_500_000) throw new MediaError('Supply bounded base64 JPEG or PNG frames');
    const bytes = Buffer.from(frame.image, 'base64');
    if (!(bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) || bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))) throw new MediaError('JPEG or PNG frames only');
    size += frame.image.length; last = frame.at_ms;
  }
  if (size > 3_800_000) throw new MediaError('Frame batch exceeds 3.8 MB', 413);
  let labels: ObjectLabel[] | undefined;
  if (v.detection_labels !== undefined) {
    try {labels=validateObjectLabels(v.detection_labels);} catch {throw new MediaError('Invalid detection_labels; choose labels from the catalog');}
  }
  return {frames, classify: v.classify === true, ...(labels===undefined?{}:{detection_labels:labels})};
}
export async function readBoundedJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new MediaError('Use application/json', 415);
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new MediaError('Request too large', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new MediaError('Request body required');
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > MAX_BODY) {await reader.cancel(); throw new MediaError('Request too large', 413);} chunks.push(value);}
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw new MediaError('Invalid JSON');}
}
