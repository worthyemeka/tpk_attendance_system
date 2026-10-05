import type { FFmpeg } from '@ffmpeg/ffmpeg';

export const VIDEO_UPLOAD_BYTES = 20 * 1024 * 1024;
export const TOTAL_UPLOAD_BYTES = 25 * 1024 * 1024;
export const VIDEO_SOURCE_BYTES = 100 * 1024 * 1024;
export const MAX_CLIP_SECONDS = 120;

export function clipValidation(start: number, end: number, duration: number, budget: number): string {
  if (![start, end, duration, budget].every(Number.isFinite) || duration <= 0) return 'Wait for the video preview to load.';
  if (start < 0 || end > duration + .05 || end - start < .5) return 'Choose an end time after the start time (at least half a second).';
  if (end - start > MAX_CLIP_SECONDS + .05) return 'Choose a clip of two minutes or less. Shorter clips save faster on phones.';
  if (budget < 128 * 1024) return 'There is not enough attachment space. Remove another attachment before trimming.';
  return '';
}

export function clipFilename(name: string): string {
  return `${name.replace(/\.[^.]+$/, '').slice(0, 160) || 'assembly'}-trimmed.mp4`;
}

export function clipArguments(start: number, end: number): string[] {
  return ['-ss', start.toFixed(3), '-i', 'input-video', '-t', (end - start).toFixed(3),
    '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn', '-map_metadata', '-1',
    // Re-encoding cuts accurately, including between keyframes. Preserve aspect
    // ratio, keep up to full HD, and never stretch or upscale a small source.
    '-vf', 'scale=w=min(1920\\,iw):h=min(1080\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'trimmed.mp4'];
}

export async function trimVideo(file: File, start: number, end: number, duration: number, budget: number,
  signal: AbortSignal, onProgress: (message: string) => void): Promise<File> {
  const invalid = clipValidation(start, end, duration, budget);
  if (invalid) throw new Error(invalid);
  if (file.size > VIDEO_SOURCE_BYTES) throw new Error('This source video is over 100 MB. Shorten it in your phone’s video editor first.');
  let processor: FFmpeg | undefined;
  let stage: 'load' | 'encode' = 'load';
  let sizeError = '';
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => processor?.terminate();
  signal.addEventListener('abort', cancel, { once: true });
  const checkCancelled = () => { if (signal.aborted) throw new DOMException('Cancelled', 'AbortError'); };
  try {
    checkCancelled();
    onProgress('Loading the video editor… The first use downloads about 32 MB.');
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    checkCancelled();
    processor = new FFmpeg();
    // Single-threaded worker works without changing site isolation or proxy
    // headers. Terminating the worker cancels work and frees its media buffers.
    const base = new URL('/vendor/video-trimmer/', window.location.origin).href;
    timeout = setTimeout(cancel, 120_000);
    await processor.load({ classWorkerURL: `${base}worker.js`, coreURL: `${base}ffmpeg-core.js`, wasmURL: `${base}ffmpeg-core.wasm` });
    clearTimeout(timeout); timeout = undefined;
    checkCancelled();
    await processor.writeFile('input-video', new Uint8Array(await file.arrayBuffer()));
    checkCancelled();
    stage = 'encode';
    onProgress('Preparing your clip… Keep this page open.');
    processor.on('progress', ({ time }) => {
      if (!signal.aborted) onProgress(`Preparing your clip… ${Math.min(99, Math.max(0, Math.round(time / 1_000_000 / (end - start) * 100)))}%`);
    });
    timeout = setTimeout(cancel, 300_000);
    if (await processor.exec(clipArguments(start, end), 300_000) !== 0) throw new Error('ENCODE_FAILED');
    checkCancelled();
    const bytes = await processor.readFile('trimmed.mp4');
    if (typeof bytes === 'string' || !bytes.length) throw new Error('ENCODE_FAILED');
    const output = new File([new Uint8Array(bytes).buffer], clipFilename(file.name), { type: 'video/mp4' });
    if (output.size > Math.min(VIDEO_UPLOAD_BYTES, budget)) {
      sizeError = `The clip is ${(output.size / 1024 / 1024).toFixed(1)} MB; ${(Math.min(VIDEO_UPLOAD_BYTES, budget) / 1024 / 1024).toFixed(1)} MB is available. Choose a shorter clip to keep good quality.`;
      throw new Error(sizeError);
    }
    return output;
  } catch (error) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (sizeError) throw new Error(sizeError);
    throw new Error(stage === 'load' ? 'The video editor could not load. Check your connection and try again.' : 'This video could not be trimmed on this device. Try a shorter clip or use your phone’s video editor.');
  } finally {
    if (timeout) clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
    processor?.terminate();
  }
}
