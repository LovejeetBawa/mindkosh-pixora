import { PDFDocument } from "pdf-lib";
import { openPDF, checkFile } from "../document-tools/files";
export { pageSelection } from "./selection";
export async function readEditablePDF(file: File) {
  checkFile(file);
  try {
    const pdf = await PDFDocument.load(await file.arrayBuffer());
    if (pdf.getPageCount() > 100) throw Error("Choose up to 100 pages.");
    return pdf;
  } catch (e) {
    if ((e as Error).message.includes("encrypted"))
      throw Error(
        "Password-protected PDFs are not supported. Open and export an unprotected copy with your PDF reader first.",
      );
    throw e;
  }
}
export async function selectedPDF(source: PDFDocument, indices: number[]) {
  if (!indices.length) throw Error("Select at least one page.");
  const result = await PDFDocument.create();
  for (const page of await result.copyPages(source, indices))
    result.addPage(page);
  return new Blob([new Uint8Array(await result.save())], {
    type: "application/pdf",
  });
}
export type PDFRow = { page: number; cells: string[]; text: string };
export async function textRows(file: File): Promise<PDFRow[]> {
  const pdf = await openPDF(file);
  const rows: PDFRow[] = [];
  try {
    if (pdf.numPages > 100) throw Error("Choose up to 100 pages.");
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const items = content.items
        .filter((item) => "str" in item && item.str.trim())
        .map((item) => {
          if (!("str" in item)) throw Error("Invalid PDF text");
          return {
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height,
          };
        });
      const lines: { y: number; items: typeof items }[] = [];
      for (const item of items) {
        let line = lines.find(
          (l) =>
            Math.abs(l.y - item.y) < Math.max(2, Math.min(5, item.height / 3)),
        );
        if (!line) {
          line = { y: item.y, items: [] };
          lines.push(line);
        }
        line.items.push(item);
      }
      for (const line of lines.sort((a, b) => b.y - a.y)) {
        const sorted = line.items.sort((a, b) => a.x - b.x);
        const cells: string[] = [];
        let previous: (typeof sorted)[number] | undefined;
        for (const item of sorted) {
          const gap = previous ? item.x - previous.x - previous.width : 0;
          if (!previous || gap > Math.max(10, item.height * 1.2))
            cells.push(item.str);
          else cells[cells.length - 1] += " " + item.str;
          previous = item;
        }
        rows.push({ page: n, cells, text: cells.join("    ") });
      }
      page.cleanup();
    }
    if (!rows.length)
      throw Error(
        "No selectable text found. Run OCR PDF first for a scanned document.",
      );
    if (rows.length > 20000)
      throw Error("Too much text. Split the PDF into smaller parts.");
    return rows;
  } finally {
    await pdf.loadingTask.destroy();
  }
}
export function escapeHTML(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function safePrintableHTML(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll(
      "script,iframe,object,embed,link,meta,base,form,input,button,video,audio,source,svg,math",
    )
    .forEach((e) => e.remove());
  for (const element of Array.from(doc.querySelectorAll("*"))) {
    for (const attr of Array.from(element.attributes)) {
      if (
        attr.name.startsWith("on") ||
        [
          "srcset",
          "href",
          "action",
          "formaction",
          "style",
          "background",
        ].includes(attr.name)
      )
        element.removeAttribute(attr.name);
      if (
        attr.name === "src" &&
        !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(attr.value)
      )
        element.removeAttribute(attr.name);
    }
  }
  doc.querySelectorAll("style").forEach((e) => e.remove());
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>@page{size:A4;margin:14mm}body{font:14px/1.5 Arial,sans-serif;color:#111;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;font-size:11px}td,th{border:1px solid #aaa;padding:5px}thead{display:table-header-group}tr,img{break-inside:avoid}h1,h2{break-after:avoid}section{break-after:page}section:last-child{break-after:auto}</style></head><body>${doc.body.innerHTML}</body></html>`;
}
