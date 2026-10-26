import { execFileSync } from 'node:child_process';
import { readFile, readdir, lstat, mkdir, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
const blocked = path => path.split('/').some(name =>
  (name.startsWith('.') && name !== '.gitignore' && name !== '.env.example') ||
  /^(node_modules|dist|coverage|downloads)$/i.test(name) ||
  /\.(pem|key|pfx|p12|zip|bundle|bak)$/i.test(name)
);
async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (blocked(path) || entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}
async function exists(path) {
  try { return !(await lstat(path)).isSymbolicLink(); }
  catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
let files;
let commit = 'Unavailable - extracted source package';
let method = 'Source folders and configuration files';
try {
  const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  files = execFileSync('git', ['ls-files', '-z'], options)
    .split('\0').filter(Boolean);
  commit = execFileSync('git', ['rev-parse', 'HEAD'], options).trim();
  method = 'Git tracked files';
} catch (error) {
  if (error.code !== 'ENOENT' && error.status !== 128) throw error;
  files = [];
  for (const directory of ['src', 'scripts', 'tests', 'functions']) {
    if (await exists(directory)) files.push(...await walk(directory));
  }
  for (const entry of await readdir('.', { withFileTypes: true })) {
    if (!entry.isFile() || blocked(entry.name)) continue;
    if (
      ['.gitignore', '.env.example', 'index.html'].includes(entry.name) ||
      /^(package(-lock)?\.json|tsconfig[^/]*\.json|vite\.config\.[cm]?[jt]s|wrangler\.(toml|jsonc?)|README\.md|HANDOVER\.md|THIRD_PARTY\.md)$/i.test(entry.name)
    ) files.push(entry.name);
  }
  if (await exists('public')) {
    for (const entry of await readdir('public', { withFileTypes: true })) {
      if (entry.isFile()) files.push(`public/${entry.name}`);
    }
  }
  if (await exists('public/typing-tutor')) {
    files.push(...await walk('public/typing-tutor'));
  }
}
files = [...new Set(files)].filter(path => !blocked(path)).sort();
const zip = new JSZip();
let count = 0;
for (const path of files) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) continue;
  zip.file(`mindkosh-pixora/${path}`, await readFile(path));
  count++;
}
if (!count) throw new Error('No source files found; backup stopped.');
zip.file('mindkosh-pixora/BACKUP-INFO.txt',
  `Restorable source backup\nCommit: ${commit}\nMethod: ${method}\nFiles: ${count}\nRun npm ci, then npm run build to regenerate dependencies and model/PDF/OCR assets.\nIncludes application source and standalone typing tutor assets.\nGit history and installed dependencies are not included.\n`
);
const output = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 }
});
await JSZip.loadAsync(output, { checkCRC32: true });
await mkdir('dist/downloads', { recursive: true });
await writeFile('dist/downloads/mindkosh-pixora-source-backup.zip', output);
console.log(`Prepared and CRC-verified source backup (${count} files; ${method}).`);
