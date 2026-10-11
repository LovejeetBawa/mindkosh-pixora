import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const zip=new JSZip();
for(const path of files){if(path.startsWith('.env')&&path!=='.env.example')continue;zip.file(`mindkosh-pixora/${path}`,await readFile(path));}
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
zip.file('mindkosh-pixora/BACKUP-INFO.txt',`Restorable source backup\nCommit: ${commit}\nAll tracked application files, lockfile, tests, scripts and HANDOVER.md.\nRun npm ci, then npm run build to regenerate dependencies and local model/PDF assets.\nInstalled node_modules, .git history and generated assets are in the separate full backup.\n`);
await mkdir('dist/downloads',{recursive:true});
await writeFile('dist/downloads/mindkosh-pixora-source-backup.zip',await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}}));
console.log(`Prepared downloadable source backup (${files.length} tracked files).`);
