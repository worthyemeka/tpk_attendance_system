import assert from 'node:assert/strict';
import { clipArguments, clipFilename, clipValidation, MAX_CLIP_SECONDS, VIDEO_UPLOAD_BYTES } from '../src/lib/video-trim.ts';

assert.equal(clipValidation(1, 5, 10, VIDEO_UPLOAD_BYTES), '');
for (const [start, end, duration, budget] of [
  [-1, 5, 10, VIDEO_UPLOAD_BYTES], [5, 3, 10, VIDEO_UPLOAD_BYTES],
  [0, 11, 10, VIDEO_UPLOAD_BYTES], [0, .2, 10, VIDEO_UPLOAD_BYTES],
  [0, MAX_CLIP_SECONDS + 1, 200, VIDEO_UPLOAD_BYTES],
  [0, 5, Infinity, VIDEO_UPLOAD_BYTES], [0, 5, 10, 0], [NaN, 5, 10, VIDEO_UPLOAD_BYTES],
]) assert.notEqual(clipValidation(start, end, duration, budget), '');
assert.equal(clipFilename('Sunday clip.MOV'), 'Sunday clip-trimmed.mp4');
const args = clipArguments(2.5, 8);
assert.equal(args[args.indexOf('-ss') + 1], '2.500');
assert.equal(args[args.indexOf('-t') + 1], '5.500');
assert.ok(args.includes('0:a:0?'), 'Preserve audio when present, support silent videos.');
assert.ok(args.includes('yuv420p'), 'Create a broadly playable MP4.');
assert.ok(args.includes('-map_metadata'), 'Do not copy private location metadata.');
assert.equal(args.at(-1), 'trimmed.mp4');
console.log('Video trim validation, timing, audio and filename checks passed.');
