# MindKosh Pixora — coder handover

Snapshot date: 11 October 2026 (Asia/Kolkata).
Website: https://mindkoshpixora.in/
Repository: https://github.com/LovejeetBawa/mindkosh-pixora

## Start here / naya coder

ChatGPT access or previous chat history is not required. Read README.md for every tool's behaviour and limitations, and THIRD_PARTY.md for licences. The app is React 19 + TypeScript + Vite 7 + Tailwind CSS, deployed on Git-connected Cloudflare Pages.

1. Keep an untouched copy of the backup.
2. Install Node.js 24 LTS, npm and curl. Open a terminal in the project folder (the folder containing package.json).
3. On a new computer run `npm ci`. Included node_modules, if present in the full backup, were installed on Linux x64 and may not work on Windows/macOS; npm ci reinstalls the exact lockfile packages for your platform.
4. Run `npm run dev` for local development. For a production build run `npm run build`, then `npm run preview`.
5. Run `npm test` (25 tests) and `npx --no-install tsc --noEmit`.
6. For PDF browser checks, install Chromium, build and start preview on port 4173, then run `npm run test:pdf-browser`. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to your Chromium path if different from /usr/bin/chromium.

The included dist folder in a full backup is already built. An offline front-end preview can be served with `python -m http.server 8080 --directory dist`. Open http://localhost:8080. This does not run Cloudflare Pages Functions. On-device browser translation requires its own supported browser/model; online translation requires Internet/provider availability.

## Code map

- src/Site.tsx: homepage discovery, navigation, history, contact and privacy pages.
- src/pages.json: direct URLs and search metadata. scripts/generate-seo-pages.mjs: static HTML per route, 404 and generated sitemap.
- src/App.tsx: image conversion, resize and enhancement.
- src/photo-tools: passport crops, mouse/touch selection, lossless exports, mixed-size print layouts and AI/manual background refinement.
- src/pdf-tools: PDF merge plus 21 additional PDF utilities and OCR. catalog.ts defines added tools. ExtraPDFTools.tsx selects the component.
- src/document-tools: visual cleanup/PDF editor, HTML templates, document extraction and translation.
- src/toolkits: text, calculators, developer helpers and AI image tools.
- functions/api/translate.ts: Cloudflare Pages translation fallback; a static-only host will not run it.
- scripts/prepare-*-assets.mjs: verify/copy background models, PDF renderer assets and local OCR workers/models. These regenerate ignored public assets before dev/build.
- tests: unit tests and actual PDF/document/OCR browser export checks.

## Deployment and account access

Cloudflare Pages: framework None, root /, build command npm run build, output dist; production follows GitHub main. Build with dev dependencies installed. Asset preparation requires npm registry access and raw.githubusercontent.com for checksum-pinned OCR models on first build. Ordinary commits to main trigger production deployment. Use a feature branch/PR unless the owner authorizes a direct push; do not force-push.

The owner must retain GitHub, Cloudflare, domain registrar/DNS and Search Console access. Account credentials, platform authentication and browser-managed translation models are not backup files. User photos/documents are not stored as a server database. Full application backups contain dependencies and local model assets, not users' browser files.

## Verified status and remaining items

The main domain is public and HTTPS works. Cloudflare deployment of the PDF tools succeeded. All 39 direct routes/shared assets were verified; sitemap contains 37 indexable URLs. Search Console showed sitemap Success, and the owner submitted indexing requests for passport-photo-maker, pdf-merge and document-translator. Google controls crawling/indexing; track Pages and Performance in Search Console over time.

The www hostname could not be verified from this cloud environment (proxy CONNECT denied and DNS lookup returned no address). Do not claim it works until checked from the owner's browser or DNS dashboard. If desired, add www as a Cloudflare Pages custom domain, configure the DNS record exactly as Cloudflare instructs, wait for HTTPS activation and redirect www to the canonical https://mindkoshpixora.in/ while retaining paths/query strings.

Contact uses the existing public GitHub issue tracker; no private support email was provided. Privacy describes the current local processing, optional translation providers and hosting. Update it whenever services or data handling change.

Tool limitations are documented in README.md and each tool UI. In particular: online translation may hit free-provider quotas; real native browser translation inference was not verified in the cloud, though its API/error/UI contracts were tested. PDF image edits flatten pages; PDF Word/Excel exports extract selectable text; PPTX exports image slides; browser printing handles DOCX/XLSX/HTML-to-PDF. Visual signatures are not certificate signatures. OCR English/Hindi and English searchable exports were tested. Password lock/unlock, general repair, validated PDF/A, faithful PPTX-to-PDF and AI summarization are not advertised.

## Git history restore

A full portable backup includes BACKUP-GIT-HISTORY.bundle. Restore tracked history with `git clone BACKUP-GIT-HISTORY.bundle restored-source`; then set origin to the real repository URL. Copy generated public assets, dist and node_modules from the full backup if needed. Run npm ci on a different OS/architecture. BACKUP-MANIFEST.json records file SHA-256 checksums and symlink targets. A full workspace ZIP additionally preserves original .git metadata; avoid overwriting current remote work with old backup refs.
