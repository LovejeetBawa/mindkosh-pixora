import { cp, mkdir } from "node:fs/promises";
await mkdir("public/document-assets", { recursive: true });
await cp(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "public/document-assets/pdf.worker.min.mjs",
);
for (const folder of ["cmaps", "standard_fonts", "wasm"])
  await cp(
    `node_modules/pdfjs-dist/${folder}`,
    `public/document-assets/${folder}`,
    { recursive: true },
  );
console.log("Prepared local PDF renderer assets.");

for (const name of ["pdfjs-dist", "mammoth", "docx"])
  await cp(
    `node_modules/${name}/LICENSE`,
    `public/document-assets/${name}-LICENSE.txt`,
  );
