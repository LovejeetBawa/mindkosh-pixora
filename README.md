# MindKosh Pixora

Multi-tool website built with React, TypeScript and Vite. The image converter, resizer and enhancer are the first available tools. Other categories are marked coming soon.

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
