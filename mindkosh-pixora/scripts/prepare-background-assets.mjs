import { readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const source = path.resolve('node_modules/@imgly/background-removal-data/dist');
const destination = path.resolve('public/background-assets');
const resources = JSON.parse(await readFile(path.join(source, 'resources.json'), 'utf8'));
const selected = Object.fromEntries(Object.entries(resources).filter(([key]) => key === '/models/medium' || /^\/onnxruntime-web\/ort-wasm(?:-simd)?(?:-threaded)?\.wasm$/.test(key)));
await mkdir(destination, {recursive:true});
const chunks = new Set(Object.values(selected).flatMap(resource => resource.chunks.map(chunk => chunk.hash)));
for (const hash of chunks) {
  const file = path.join(source, hash);
  const bytes = await readFile(file);
  if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error(`Background asset checksum mismatch: ${hash}`);
  await copyFile(file, path.join(destination, hash));
}
await writeFile(path.join(destination, 'resources.json'), JSON.stringify(selected));
console.log(`Prepared ${chunks.size} verified background model/runtime chunks.`);

await copyFile(path.resolve('node_modules/@imgly/background-removal/LICENSE.md'), path.join(destination, 'LICENSE.md'));
