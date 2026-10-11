import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
GlobalWorkerOptions.workerSrc = "/document-assets/pdf.worker.min.mjs";
export const fileLimit = 25 * 1024 * 1024;
export type Sheet = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  id: string;
};
export function checkFile(file: File) {
  if (file.size > fileLimit) throw Error("Choose a file up to 25 MB.");
}
export function copyCanvas(source: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  c.getContext("2d")!.drawImage(source, 0, 0);
  return c;
}
export async function openPDF(file: File) {
  checkFile(file);
  return getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: "/document-assets/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/document-assets/standard_fonts/",
    wasmUrl: "/document-assets/wasm/",
  }).promise;
}
export async function pdfSheets(file: File) {
  const pdf = await openPDF(file);
  try {
    if (pdf.numPages > 30) throw Error("Choose a PDF with up to 30 pages.");
    const sheets: Sheet[] = [];
    let pixels = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(2, 2400 / Math.max(base.width, base.height)),
      });
      pixels += viewport.width * viewport.height;
      if (pixels > 65000000)
        throw Error(
          "This PDF is too large to edit in memory. Split it into smaller files.",
        );
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      sheets.push({
        canvas,
        width: base.width,
        height: base.height,
        id: crypto.randomUUID(),
      });
      page.cleanup();
    }
    return sheets;
  } finally {
    await pdf.loadingTask.destroy();
  }
}
export async function exportPDF(sheets: Sheet[]) {
  const pdf = await PDFDocument.create();
  for (const sheet of sheets) {
    const img = await pdf.embedPng(sheet.canvas.toDataURL("image/png"));
    const page = pdf.addPage([sheet.width, sheet.height]);
    page.drawImage(img, {
      x: 0,
      y: 0,
      width: sheet.width,
      height: sheet.height,
    });
  }
  return new Blob([new Uint8Array(await pdf.save())], {
    type: "application/pdf",
  });
}
export function canvasPNG(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Could not export image."))),
      "image/png",
    ),
  );
}
export async function imageSheet(file: File): Promise<Sheet> {
  checkFile(file);
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 40000000)
      throw Error("Choose an image up to 40 megapixels.");
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")!.drawImage(image, 0, 0);
    return {
      canvas,
      width: image.width,
      height: image.height,
      id: crypto.randomUUID(),
    };
  } finally {
    image.close();
  }
}
export async function extractText(file: File) {
  checkFile(file);
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    const pdf = await openPDF(file);
    try {
      if (pdf.numPages > 100) throw Error("Choose up to 100 PDF pages.");
      const pages = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) =>
              "str" in item
                ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
                : "",
            )
            .join(""),
        );
      }
      const text = pages.join("\n\n").trim();
      if (!text)
        throw Error(
          "No selectable text found. This scanned PDF needs OCR before translation.",
        );
      return text;
    } finally {
      await pdf.loadingTask.destroy();
    }
  }
  if (ext === "docx") {
    const { extractRawText } = await import("mammoth/mammoth.browser");
    return (await extractRawText({ arrayBuffer: await file.arrayBuffer() }))
      .value;
  }
  if (["txt", "md", "csv"].includes(ext || "")) return file.text();
  if (["html", "htm"].includes(ext || "")) {
    const doc = new DOMParser().parseFromString(await file.text(), "text/html");
    doc.querySelectorAll("script,style").forEach((el) => el.remove());
    return doc.body.textContent || "";
  }
  throw Error(
    "Supported: PDF with selectable text, DOCX, TXT, MD, CSV and HTML. Legacy DOC files must be saved as DOCX first.",
  );
}
export async function removeDocxWatermark(
  file: File,
  phrase: string,
  graphics: boolean,
) {
  checkFile(file);
  const zip = await JSZip.loadAsync(file);
  if (!zip.file("word/document.xml")) throw Error("Not a valid DOCX file.");
  let removed = 0;
  const parts = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header\d+|footer\d+)\.xml$/.test(name),
  );
  for (const name of parts) {
    const xml = await zip.file(name)!.async("string");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror"))
      throw Error("Could not read DOCX XML.");
    if (graphics && /header|footer/.test(name)) {
      for (const node of [
        ...doc.getElementsByTagNameNS("*", "pict"),
        ...doc.getElementsByTagNameNS("*", "drawing"),
      ]) {
        node.remove();
        removed++;
      }
    }
    if (phrase) {
      for (const node of Array.from(doc.getElementsByTagNameNS("*", "t"))) {
        const text = node.textContent || "";
        if (text.includes(phrase)) {
          removed += text.split(phrase).length - 1;
          node.textContent = text.split(phrase).join("");
        }
      }
    }
    zip.file(name, new XMLSerializer().serializeToString(doc));
  }
  if (!removed)
    throw Error(
      "No matching watermark found. Text split across runs or body images need editing in a word processor.",
    );
  return {
    blob: await zip.generateAsync({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    removed,
  };
}
