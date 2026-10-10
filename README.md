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

Open **Passport Photo Maker** from the Image tools category. Upload a collection of images, then select each image to set its dimensions in millimetres, crop position, zoom, rotation and number of copies. Drag the crop preview with a mouse or touch to reposition the image. Zoom up to 12× to isolate a person in a group photo; zoom buttons and position sliders are also available. Common size presets and custom dimensions support passport, visa, application and studio print workflows. Consult the issuing authority's current rules; this tool does not validate government acceptance or remove backgrounds.

Choose 4×6 inch, 5×7 inch, A4 or Letter paper, margins, spacing, orientation and optional cutting borders. Mixed sizes retain their physical dimensions and overflow onto additional sheets. Download an individual cropped JPG, a ZIP of cropped photos, a print PDF or sheet JPGs (multiple sheets are zipped). PDF pages preserve physical measurements: print at **Actual size / 100%**, without Fit to page. JPG pixel dimensions use 300 DPI sizing; set the intended physical dimensions in print software.

Processing stays in the browser. Collections are temporary and clear when leaving the tool. Limits: 20 images, 25 MB and 40 megapixels per input, 10–150 mm dimensions and 1–40 copies per photo. Small source crops show a print-quality warning.

Validation (Node 24):

```bash
node --test tests/photo-layout.test.mjs
npx --no-install tsc --noEmit
npm run build
```
