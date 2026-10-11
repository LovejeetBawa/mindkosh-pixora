import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { Toolkit, inputStyle, buttonStyle, saveFile } from "../toolkits/ui";
import {
  pdfSheets,
  exportPDF,
  copyCanvas,
  imageSheet,
  type Sheet,
} from "../document-tools/files";
import RegionPreview from "../document-tools/RegionPreview";
import { initialRegion, bounds, type Region } from "../document-tools/cleanup";
import {
  pageSelection,
  readEditablePDF,
  selectedPDF,
  textRows,
} from "./operations";
import { pdfTools, type PDFToolId } from "./catalog";
async function jpegPDF(sheets: Sheet[], quality: number, dpi: number) {
  const pdf = await PDFDocument.create();
  for (const sheet of sheets) {
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, dpi / 144);
    canvas.width = Math.max(1, Math.round(sheet.canvas.width * ratio));
    canvas.height = Math.max(1, Math.round(sheet.canvas.height * ratio));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sheet.canvas, 0, 0, canvas.width, canvas.height);
    const image = await pdf.embedJpg(canvas.toDataURL("image/jpeg", quality));
    const page = pdf.addPage([sheet.width, sheet.height]);
    page.drawImage(image, {
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
export default function PDFUtilities({ mode }: { mode: PDFToolId }) {
  const tool = pdfTools.find((t) => t.id === mode)!;
  const [file, setFile] = useState<File | null>(null),
    [count, setCount] = useState(0),
    [ranges, setRanges] = useState(""),
    [sheets, setSheets] = useState<Sheet[]>([]),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [region, setRegion] = useState<Region>(initialRegion),
    [all, setAll] = useState(false),
    [quality, setQuality] = useState(0.7),
    [dpi, setDPI] = useState(110),
    [text, setText] = useState("CONFIDENTIAL"),
    [colour, setColour] = useState("#555555"),
    [opacity, setOpacity] = useState(0.25),
    [size, setSize] = useState(mode === "pdfnumbers" ? 12 : 30),
    [position, setPosition] = useState(
      mode === "pdfwatermark" ? "center" : "bottom-center",
    ),
    [start, setStart] = useState(1),
    [signature, setSignature] = useState<HTMLCanvasElement | null>(null);
  const [redactions, setRedactions] = useState<Record<number, Region[]>>({});
  const pad = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false);
  const current = sheets[index];
  const preview =
    current && mode === "pdfredact"
      ? copyCanvas(current.canvas)
      : current?.canvas;
  if (preview && current && mode === "pdfredact") {
    const ctx = preview.getContext("2d")!;
    ctx.fillStyle = "#000";
    for (const area of redactions[index] ?? []) {
      const r = bounds(area, preview.width, preview.height);
      ctx.fillRect(r.x, r.y, r.width, r.height);
    }
  }
  const visual = [
    "pdfcrop",
    "pdfredact",
    "pdfsign",
    "pdfwatermark",
    "pdfnumbers",
  ].includes(mode);
  useEffect(() => {
    if (mode !== "pdfsign" || !pad.current) return;
    const ctx = pad.current.getContext("2d")!;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#111";
    ctx.lineCap = "round";
  }, [mode]);
  async function upload(next: File) {
    setBusy(true);
    setError("");
    setNotice("");
    setFile(null);
    setSheets([]);
    setCount(0);
    setRedactions({});
    try {
      if (!/\.pdf$/i.test(next.name)) throw Error("Choose a PDF file.");
      const pdf = await readEditablePDF(next);
      if (visual) {
        setSheets(await pdfSheets(next));
        setIndex(0);
      }
      setCount(pdf.getPageCount());
      setFile(next);
      setRanges("");
      setRegion(initialRegion);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) * e.currentTarget.width) / box.width,
      y: ((e.clientY - box.top) * e.currentTarget.height) / box.height,
    };
  }
  async function exportFile() {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "pdfsplit" || mode === "pdfextract") {
        const source = await readEditablePDF(file);
        if (mode === "pdfextract") {
          saveFile(
            await selectedPDF(source, pageSelection(ranges, count)),
            "mindkosh-extracted.pdf",
          );
          setNotice(
            "Selected pages exported without rasterizing the document.",
          );
        } else {
          const groups = ranges.trim()
            ? ranges.split(";").map((g) => {
                if (!g.trim())
                  throw Error("Enter a page group after each semicolon.");
                return pageSelection(g, count);
              })
            : Array.from({ length: count }, (_, i) => [i]);
          const zip = new JSZip();
          for (let i = 0; i < groups.length; i++)
            zip.file(
              `part-${String(i + 1).padStart(3, "0")}.pdf`,
              await selectedPDF(source, groups[i]),
            );
          saveFile(
            await zip.generateAsync({ type: "blob" }),
            "mindkosh-split.zip",
          );
          setNotice(`${groups.length} PDF files exported.`);
        }
      } else if (
        mode === "pdfword" ||
        mode === "pdfexcel" ||
        mode === "pdfmarkdown"
      ) {
        const rows = await textRows(file);
        if (mode === "pdfword") {
          const { Document, Paragraph, TextRun, Packer } = await import("docx");
          const numbers = [...new Set(rows.map((r) => r.page))];
          const doc = new Document({
            sections: numbers.map((n) => ({
              children: rows
                .filter((r) => r.page === n)
                .map((r) => new Paragraph({ children: [new TextRun(r.text)] })),
            })),
          });
          saveFile(await Packer.toBlob(doc), "mindkosh-text.docx");
        } else if (mode === "pdfexcel") {
          const { default: writeXlsxFile } = await import(
            "write-excel-file/browser"
          );
          const data = rows.map((row) => [
            { value: row.page, type: Number },
            ...row.cells.map((value) => ({ value, type: String })),
          ]);
          saveFile(
            await writeXlsxFile(data, { sheet: "Extracted text" }).toBlob(),
            "mindkosh-extracted.xlsx",
          );
        } else {
          const content = [...new Set(rows.map((r) => r.page))]
            .map(
              (n) =>
                `## Page ${n}\n\n${rows
                  .filter((r) => r.page === n)
                  .map(
                    (r) =>
                      r.text.replace(/([\\`*_{}\[\]<>#+.!|~-])/g, "\\$1") +
                      "  ",
                  )
                  .join("\n")}`,
            )
            .join("\n\n");
          saveFile(
            new Blob([content], { type: "text/markdown;charset=utf-8" }),
            "mindkosh-text.md",
          );
        }
        setNotice(
          "Text exported. Review reading order and inferred columns; scanned text needs OCR.",
        );
      } else if (
        mode === "pdfcompress" ||
        mode === "pdfjpg" ||
        mode === "pdfppt"
      ) {
        const rendered = await pdfSheets(file);
        if (mode === "pdfcompress") {
          const blob = await jpegPDF(rendered, quality, dpi);
          if (blob.size >= file.size) {
            saveFile(file, "mindkosh-original.pdf");
            setNotice(
              "These settings did not make the PDF smaller. The original was downloaded without quality loss; try a lower resolution or quality.",
            );
          } else {
            saveFile(blob, "mindkosh-compressed.pdf");
            setNotice(
              `Size: ${(file.size / 1024).toFixed(0)} KB → ${(blob.size / 1024).toFixed(0)} KB (${Math.round((1 - blob.size / file.size) * 100)}% smaller). Inspect text and images before using.`,
            );
          }
        } else if (mode === "pdfjpg") {
          const indices = pageSelection(ranges, count);
          const zip = new JSZip();
          for (const i of indices) {
            const s = rendered[i];
            const c = document.createElement("canvas");
            const scale = dpi / 144;
            c.width = Math.max(1, Math.round(s.canvas.width * scale));
            c.height = Math.max(1, Math.round(s.canvas.height * scale));
            const ctx = c.getContext("2d")!;
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(s.canvas, 0, 0, c.width, c.height);
            const blob = await new Promise<Blob>((resolve, reject) =>
              c.toBlob(
                (b) => (b ? resolve(b) : reject(Error("JPEG export failed."))),
                "image/jpeg",
                quality,
              ),
            );
            zip.file(`page-${i + 1}.jpg`, blob);
          }
          saveFile(
            await zip.generateAsync({ type: "blob" }),
            "mindkosh-pdf-images.zip",
          );
          setNotice(`${indices.length} page images exported.`);
        } else {
          const { default: PptxGenJS } = await import("pptxgenjs");
          const pptx = new PptxGenJS();
          const first = rendered[0];
          pptx.defineLayout({
            name: "PDF",
            width: first.width / 72,
            height: first.height / 72,
          });
          pptx.layout = "PDF";
          pptx.author = "MindKosh Pixora";
          pptx.subject = "PDF page images";
          for (const s of rendered) {
            const slide = pptx.addSlide();
            const factor = Math.min(
              first.width / s.width,
              first.height / s.height,
            );
            slide.addImage({
              data: s.canvas.toDataURL("image/png"),
              x: (first.width - s.width * factor) / 144,
              y: (first.height - s.height * factor) / 144,
              w: (s.width * factor) / 72,
              h: (s.height * factor) / 72,
            });
          }
          const output = await pptx.write({ outputType: "blob" });
          saveFile(output as Blob, "mindkosh-presentation.pptx");
          setNotice(
            "One image per slide. Text and objects remain part of each page image, not editable slide elements.",
          );
        }
      } else {
        const next = sheets.map((s) => ({
          ...s,
          canvas: copyCanvas(s.canvas),
        }));
        const targets = all ? next.map((_, i) => i) : [index];
        if (mode === "pdfcrop") {
          for (const i of targets) {
            const s = next[i];
            const r = bounds(region, s.canvas.width, s.canvas.height);
            const c = document.createElement("canvas");
            c.width = r.width;
            c.height = r.height;
            c.getContext("2d")!.drawImage(
              s.canvas,
              r.x,
              r.y,
              r.width,
              r.height,
              0,
              0,
              r.width,
              r.height,
            );
            next[i] = {
              ...s,
              canvas: c,
              width: (s.width * r.width) / s.canvas.width,
              height: (s.height * r.height) / s.canvas.height,
            };
          }
        } else if (mode === "pdfredact") {
          const regions = Object.keys(redactions).length
            ? redactions
            : Object.fromEntries(targets.map((i) => [i, [region]]));
          for (const [key, areas] of Object.entries(regions)) {
            const s = next[Number(key)];
            for (const area of areas) {
              const r = bounds(area, s.canvas.width, s.canvas.height);
              const ctx = s.canvas.getContext("2d")!;
              ctx.fillStyle = "#000";
              ctx.fillRect(r.x, r.y, r.width, r.height);
            }
          }
        } else if (mode === "pdfsign") {
          if (
            !signature ||
            !signature
              .getContext("2d")!
              .getImageData(0, 0, signature.width, signature.height)
              .data.some((v, i) => i % 4 === 3 && v > 0)
          )
            throw Error("Draw or upload a signature first.");
          for (const i of targets) {
            const s = next[i];
            const r = bounds(region, s.canvas.width, s.canvas.height);
            const fit = Math.min(
              r.width / signature.width,
              r.height / signature.height,
            );
            s.canvas
              .getContext("2d")!
              .drawImage(
                signature,
                r.x + (r.width - signature.width * fit) / 2,
                r.y + (r.height - signature.height * fit) / 2,
                signature.width * fit,
                signature.height * fit,
              );
          }
        } else if (mode === "pdfwatermark" || mode === "pdfnumbers") {
          if (!Number.isFinite(size) || size < 6 || size > 100)
            throw Error("Use a font size from 6–100 pt.");
          if (
            mode === "pdfnumbers" &&
            (!Number.isInteger(start) || start < 0 || start > 100000)
          )
            throw Error("Enter a starting number from 0–100000.");
          if (mode === "pdfwatermark" && !text.trim())
            throw Error("Enter watermark text.");
          for (let i = 0; i < next.length; i++) {
            const s = next[i];
            const ctx = s.canvas.getContext("2d")!;
            const scale = s.canvas.width / s.width;
            ctx.save();
            ctx.fillStyle = colour;
            ctx.globalAlpha = mode === "pdfwatermark" ? opacity : 1;
            ctx.font = `${size * scale}px sans-serif`;
            ctx.textAlign = position.endsWith("left")
              ? "left"
              : position.endsWith("right")
                ? "right"
                : "center";
            ctx.textBaseline = "middle";
            const x = position.endsWith("left")
              ? 25 * scale
              : position.endsWith("right")
                ? s.canvas.width - 25 * scale
                : s.canvas.width / 2;
            const y = position.startsWith("top")
              ? 25 * scale
              : position.startsWith("bottom")
                ? s.canvas.height - 25 * scale
                : s.canvas.height / 2;
            ctx.fillText(
              mode === "pdfnumbers" ? String(start + i) : text,
              x,
              y,
              s.canvas.width - 50 * scale,
            );
            ctx.restore();
          }
        }
        saveFile(await exportPDF(next), `mindkosh-${tool.slug}.pdf`);
        setNotice(
          mode === "pdfredact"
            ? "New flattened PDF exported. Original text, form fields, attachments and metadata are not copied. Inspect every page to confirm all sensitive areas were selected."
            : "New flattened PDF exported. Original page sizes are preserved except for cropped pages.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Toolkit title={tool.name} description={tool.description}>
      <p className="mb-4 rounded-xl bg-indigo-50 p-4 text-sm">
        {mode === "pdfsplit" || mode === "pdfextract"
          ? "These tools copy original PDF pages without changing image resolution. Document-level forms, bookmarks and links may need review. Up to 100 source pages."
          : mode === "pdfword" || mode === "pdfexcel" || mode === "pdfmarkdown"
            ? "Selectable text only. Original fonts, images and page layout are not reconstructed. Spreadsheet columns are inferred from text positions, so check the result."
            : mode === "pdfppt"
              ? "Up to 30 pages. Each slide contains a page image; original slide text and objects are not recovered."
              : mode === "pdfsign"
                ? "Drawn/uploaded signatures are visual marks, not certificate-based digital signatures or a signature-request service. Output is flattened."
                : mode === "pdfredact"
                  ? "Each page is rendered to pixels and selected areas are blacked out. Source text, links, form fields and attachments are removed from the output. Redact every sensitive region before use."
                  : mode === "pdfcompress"
                    ? "Compression renders pages as JPEG images. Selectable text, links and forms are lost, and reduced resolution/quality can blur details. Best for image-heavy documents."
                    : "Up to 30 pages. Image-based exports are flattened and do not retain selectable text, links or interactive forms."}
      </p>
      <label className="block">
        PDF file
        <input
          className={inputStyle}
          type="file"
          accept=".pdf"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </label>
      {file && (
        <p className="mt-3 text-sm">
          {file.name} — {count} pages
        </p>
      )}
      {["pdfsplit", "pdfextract", "pdfjpg"].includes(mode) && (
        <label className="mt-4 block">
          {mode === "pdfsplit"
            ? "Page groups (semicolon between files)"
            : "Pages in output order"}
          <input
            className={inputStyle}
            value={ranges}
            disabled={busy}
            placeholder={mode === "pdfsplit" ? "1-3; 4-6; 7" : "1,3-5,2"}
            onChange={(e) => setRanges(e.target.value)}
          />
          <span className="text-sm text-slate-500">
            {mode === "pdfsplit"
              ? "Leave empty to create a separate PDF for each page."
              : "Leave empty to include all pages."}
          </span>
        </label>
      )}
      {["pdfcompress", "pdfjpg"].includes(mode) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>
            Resolution
            <select
              className={inputStyle}
              value={dpi}
              disabled={busy}
              onChange={(e) => setDPI(Number(e.target.value))}
            >
              <option value={72}>72 DPI — smaller</option>
              <option value={110}>110 DPI — balanced</option>
              <option value={144}>Up to 144 DPI — clearer</option>
            </select>
          </label>
          <label>
            JPEG quality ({Math.round(quality * 100)}%)
            <input
              className={inputStyle}
              type="range"
              min=".3"
              max="1"
              step=".05"
              value={quality}
              disabled={busy}
              onChange={(e) => setQuality(Number(e.target.value))}
            />
          </label>
        </div>
      )}
      {visual && current && (
        <div className="mt-5">
          <label>
            Preview page
            <select
              className={inputStyle}
              disabled={busy}
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
            >
              {sheets.map((_, i) => (
                <option key={i} value={i}>
                  Page {i + 1}
                </option>
              ))}
            </select>
          </label>
          {["pdfcrop", "pdfredact", "pdfsign"].includes(mode) ? (
            <>
              <RegionPreview
                source={preview!}
                region={region}
                onChange={setRegion}
              />
              <label className="mt-3 block">
                <input
                  type="checkbox"
                  checked={all}
                  disabled={busy}
                  onChange={(e) => setAll(e.target.checked)}
                />{" "}
                Apply this rectangle to all pages (relative position)
              </label>
            </>
          ) : (
            <img
              alt="PDF page preview"
              className="mx-auto mt-4 max-h-[50vh] max-w-full border"
              src={current.canvas.toDataURL()}
            />
          )}
        </div>
      )}
      {["pdfnumbers", "pdfwatermark"].includes(mode) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {mode === "pdfnumbers" ? (
            <label>
              Starting number
              <input
                className={inputStyle}
                type="number"
                value={start}
                disabled={busy}
                onChange={(e) => setStart(Number(e.target.value))}
              />
            </label>
          ) : (
            <label>
              Watermark text
              <input
                className={inputStyle}
                value={text}
                maxLength={200}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
          )}
          <label>
            Font size (pt)
            <input
              className={inputStyle}
              type="number"
              min="6"
              max="100"
              value={size}
              disabled={busy}
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </label>
          <label>
            Position
            <select
              className={inputStyle}
              disabled={busy}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              {[
                "top-left",
                "top-center",
                "top-right",
                "center",
                "bottom-left",
                "bottom-center",
                "bottom-right",
              ].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Text colour
            <input
              className={inputStyle}
              type="color"
              value={colour}
              disabled={busy}
              onChange={(e) => setColour(e.target.value)}
            />
          </label>
          {mode === "pdfwatermark" && (
            <label>
              Opacity ({Math.round(opacity * 100)}%)
              <input
                className={inputStyle}
                type="range"
                min=".05"
                max="1"
                step=".05"
                value={opacity}
                disabled={busy}
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
            </label>
          )}
        </div>
      )}
      {mode === "pdfredact" && current && (
        <div className="mt-4">
          <button
            className={buttonStyle}
            disabled={busy}
            onClick={() => {
              const targets = all ? sheets.map((_, i) => i) : [index];
              const next = { ...redactions };
              for (const i of targets)
                next[i] = [...(next[i] ?? []), { ...region }];
              setRedactions(next);
              setNotice("Area marked. Add more regions before downloading.");
            }}
          >
            Mark redaction area
          </button>
          <button
            className="ml-3 rounded-xl border px-4 py-2"
            disabled={busy}
            onClick={() => {
              setRedactions({});
              setNotice("Marked areas cleared.");
            }}
          >
            Clear marked areas
          </button>
          <p className="mt-2 text-sm">
            Marked areas:{" "}
            {Object.values(redactions).reduce(
              (n, areas) => n + areas.length,
              0,
            )}
            . Black areas in the preview will be removed. If no areas are
            marked, the current selection is used.
          </p>
        </div>
      )}
      {mode === "pdfsign" && (
        <div className="mt-4">
          <p>Draw your signature using a mouse or finger:</p>
          <canvas
            ref={pad}
            width={600}
            height={180}
            aria-label="Signature pad"
            aria-disabled={busy}
            className="mt-2 w-full touch-none rounded-xl border bg-white"
            onPointerDown={(e) => {
              if (busy) return;
              const p = point(e);
              drawing.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              const ctx = e.currentTarget.getContext("2d")!;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x + 0.1, p.y + 0.1);
              ctx.stroke();
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const p = point(e);
              const ctx = e.currentTarget.getContext("2d")!;
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
            }}
            onPointerUp={() => {
              if (!drawing.current) return;
              drawing.current = false;
              if (pad.current) setSignature(copyCanvas(pad.current));
            }}
            onPointerCancel={() => {
              drawing.current = false;
            }}
          />
          <button
            className="mt-3 rounded-xl border px-4 py-2"
            disabled={busy}
            onClick={() => {
              pad.current?.getContext("2d")?.clearRect(0, 0, 600, 180);
              setSignature(null);
            }}
          >
            Clear signature
          </button>
          <label className="mt-3 block">
            Or upload signature (transparent PNG recommended)
            <input
              className={inputStyle}
              type="file"
              accept="image/png,image/jpeg"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f)
                  try {
                    setSignature((await imageSheet(f)).canvas);
                  } catch (err) {
                    setError((err as Error).message);
                  }
                e.target.value = "";
              }}
            />
          </label>
          {signature && (
            <p className="mt-2 text-green-700">
              Signature ready. Select its placement rectangle on the PDF
              preview.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-indigo-700">
          {notice}
        </p>
      )}
      <button
        className={`${buttonStyle} mt-5`}
        disabled={!file || busy}
        onClick={() => void exportFile()}
      >
        {busy ? "Processing…" : "Process & Download"}
      </button>
    </Toolkit>
  );
}
