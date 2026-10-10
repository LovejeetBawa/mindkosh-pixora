# MindKosh Pixora

Multi-tool website built with React, TypeScript and Vite. Includes image editing, passport photos, PDF merge, text tools, calculators, developer utilities and AI image tools. All advertised categories are available.

## Local development

```bash
npm ci
npm run dev
```

## Production build

```bash
npm run build
```

Cloudflare Pages: framework None, build command `npm run build`, output directory `dist`, root `/`.

## Deployment

Push to the connected GitHub `main` branch to trigger Cloudflare Pages deployment. Verify the editor after each deployment.

## Passport Photo Maker

Open **Passport Photo Maker** from the Image tools category. Upload a collection of images, then select each image to set its dimensions in millimetres, crop position, zoom, rotation and number of copies. Move the dotted crop box over the full image and resize it using any corner with a mouse or touch. The box preserves the selected output proportions, and a separate preview shows exactly what will be downloaded. Zoom up to 12× to isolate a person in a group photo; zoom buttons and position sliders are also available. Common size presets and custom dimensions support passport, visa, application and studio print workflows. Consult the issuing authority's current rules; this tool does not validate government acceptance.

Choose 4×6 inch, 5×7 inch, A4 or Letter paper, margins, spacing, orientation and optional cutting borders. Mixed sizes retain their physical dimensions and overflow onto additional sheets. Download an individual lossless PNG or highest-quality JPG, a ZIP of cropped photos, a print PDF or sheet images (multiple sheets are zipped). PDF pages preserve physical measurements: print at **Actual size / 100%**, without Fit to page. Original crop pixels is the default export resolution and PNG is the default format. This preserves original crop detail without reducing it to fixed print dimensions or adding JPEG compression. 300 DPI sizing remains an option. Sheets use 300 DPI sizing; PDFs embed crops at the selected resolution without JPEG recompression. Set the intended physical dimensions in image print software.

Processing stays in the browser. Collections are temporary and clear when leaving the tool. Limits: 20 images, 25 MB and 40 megapixels per input, 10–150 mm dimensions and 1–40 copies per photo. Small source crops show a print-quality warning.

Validation (Node 24):

```bash
node --test tests/photo-*.test.mjs
npx --no-install tsc --noEmit
npm run build
```

### Background removal

Crop tightly around one person, then select Remove background for a transparent cutout, or choose white, light blue, grey or a custom colour. The AI processes only the selected crop. The original image and crop settings are retained; Restore original reverses the background edit. Changing the crop restores the original and requires rerunning removal for the new selection. If other people or background remain, open Refine background: erase with a mouse/touch brush, restore original pixels, undo up to three strokes, reset edits, then apply. Cancel discards brush edits. Reprocess selected crop resets the cutout using AI. Applied cleanup affects previews and every export. Segmentation preserves original image dimensions and RGB detail but changes alpha at subject edges. Check hair, edges and document requirements. Small or blurry source faces cannot acquire missing detail by cropping. PNG supports transparency; JPG and print sheets flatten transparent areas onto white.

IMG.LY background-removal and model data are pinned together at 1.4.5. Build/dev hooks copy the medium model and compatible WASM assets from the verified npm package into ignored `public/background-assets`. The 4 MB chunks fit Cloudflare Pages per-file limits; no external AI API, credentials or external model CDN are required. First use downloads the model from the same site and runs locally. Keep dev dependencies installed during Cloudflare builds. Licence and source links are shown in the tool; see THIRD_PARTY.md.

## Additional toolkits

- **Text Tools:** Unicode word/character statistics, case conversion, whitespace cleanup, duplicate/empty line removal, line sorting and literal find/replace. Copy or download the processed text.
- **Calculators:** percentage operations, inclusive/exclusive GST, fixed-rate monthly EMI (including zero interest), adult BMI and length/weight/area/temperature conversion. Invalid inputs produce explanations; temperatures below absolute zero are rejected.
- **Developer Tools:** strict JSON formatting/minification, UTF-8 Base64, URL component and HTML escaping, SHA-256, cryptographically random passwords and UUIDs, HEX/RGB conversion. Base64 decoding expects standard padded UTF-8 input. Large JSON integer identifiers should be quoted.
- **AI Tools:** real on-device background removal, solid background replacement and black foreground silhouettes. Uses the same locally hosted model as Passport Photo Maker. Download native-dimension lossless PNGs. Multiple foreground people may remain; the passport tool offers crop and manual refinement for precise cleanup.

Inputs stay in memory in the browser. No API keys are required. Run all unit checks with `node --test tests/*.test.mjs`.

## Document and HTML tools

- **Watermark Remover:** select a rectangle using mouse/touch or percent fields. Cover it with colour or interpolate nearby image pixels. Multiple images export native-size PNG ZIPs; PDF pages export a new rendered PDF. DOCX can remove header/footer graphics (including logos) and exact watermark text in XML text runs. TXT/MD remove a literal phrase. Complex backgrounds cannot be reconstructed perfectly; unsupported formats are rejected.
- **PDF Editor:** Unicode text overlays, colour covers, rotation, page ordering/deletion, reset and multi-file import. Edited PDFs preserve physical page dimensions but rasterise pages; text, links and forms lose interactivity. This is an annotation/page editor, not an editor for existing PDF text objects. Covers are visual cleanup and not certified secure redaction. Maximum 30 pages, 10 files, 25 MB/file and 65 million total rendered pixels.
- **HTML Code Generator:** responsive landing page/portfolio templates, theme colour, content and CTA URL, sandboxed preview and complete HTML download. Content is escaped and CTA links only allow HTTP(S). No generative API needed.
- **Document Translator:** extracts selectable PDF text and DOCX/TXT/MD/CSV/HTML locally. Supports 21 languages, including Hindi and Punjabi, using free MyMemory or Google web translation. Input is limited to 5,000 characters per document; provider daily quotas apply. The Translate button sends text to the selected provider. Google web translation is a public web endpoint, with no availability guarantee. MyMemory direct requests use the user's IP quota; `/api/translate` is a same-origin Cloudflare Pages fallback for connection/CORS failures. Quota responses stop translation. Export TXT, Unicode DOCX or use Print/Save as PDF. Original document layout and graphics are not preserved. Scanned PDFs need OCR first; legacy DOC needs DOCX conversion.

Cloudflare Pages automatically deploys `functions/api/translate.ts` with the site. No translation secrets or paid API are required. In plain Vite local development the direct translation request works, but the Pages fallback requires a Pages Functions runtime. Build hooks copy the PDF worker, CMaps, fonts, WASM and licences locally to `public/document-assets` (ignored build output). PDF rendering does not upload document files.
