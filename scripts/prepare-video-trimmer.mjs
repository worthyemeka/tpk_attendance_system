// Serve the pinned processor from TPK, not a third-party CDN. No media is sent
// to this tool or anywhere else while the user trims a clip.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, 'public/vendor/video-trimmer');
await mkdir(target, { recursive: true });
const wrapper = join(root, 'node_modules/@ffmpeg/ffmpeg/dist/esm');
for (const file of await readdir(wrapper)) {
  if (file.endsWith('.js')) await copyFile(join(wrapper, file), join(target, file));
}
for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  await copyFile(join(root, 'node_modules/@ffmpeg/core/dist/esm', file), join(target, file));
}
console.log('Private, on-device video trimmer assets prepared.');
