# Background removal notices

The passport photo background-removal integration uses IMG.LY's `@imgly/background-removal` and `@imgly/background-removal-data` version 1.4.5, supplied under GNU Affero General Public License v3. Their licence is served at `/background-assets/LICENSE.md` and linked from the tool.

- Upstream source: https://github.com/imgly/background-removal-js
- Published library: https://www.npmjs.com/package/@imgly/background-removal/v/1.4.5
- Published model/runtime data: https://www.npmjs.com/package/@imgly/background-removal-data/v/1.4.5
- Integration source and build instructions: https://github.com/LovejeetBawa/mindkosh-pixora

The background-removal integration is distributed under AGPL-3.0 in conjunction with these dependencies. Dependencies and their versions are recorded in package-lock.json. Unmodified assets are copied from the matching npm data package; chunk SHA-256 checksums are verified before copying. The library and runtime dependencies retain their own licence notices.

## Document tools

PDF rendering uses Mozilla PDF.js (`pdfjs-dist`, Apache-2.0). DOCX extraction uses Mammoth (BSD-2-Clause), and DOCX export uses docx (MIT). Their unmodified licence files are published under `/document-assets/pdfjs-dist-LICENSE.txt`, `/document-assets/mammoth-LICENSE.txt` and `/document-assets/docx-LICENSE.txt`. Exact versions are in package-lock.json. Translation is provided by MyMemory (https://mymemory.translated.net/), subject to its public service limits and privacy practices; no model is bundled for translation.
