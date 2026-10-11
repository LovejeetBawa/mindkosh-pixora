import { useEffect, useRef, useState } from "react";
import type { Worker, Word } from "tesseract.js";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  Toolkit,
  inputStyle,
  buttonStyle,
  saveFile,
  Output,
} from "../toolkits/ui";
import {
  openPDF,
  pdfSheets,
  imageSheet,
  type Sheet,
} from "../document-tools/files";
type OCRPage = { sheet: Sheet; text: string; words: Word[] };
export default function PDFOCR() {
  const [file, setFile] = useState<File | null>(null),
    [language, setLanguage] = useState("eng"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [pages, setPages] = useState<OCRPage[]>([]),
    [resultLanguage, setResultLanguage] = useState("eng");
  const worker = useRef<Worker | null>(null),
    generation = useRef(0),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      void worker.current?.terminate();
      worker.current = null;
    };
  }, []);
  function cancel() {
    generation.current++;
    void worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setStatus("Cancelled.");
    setPages([]);
  }
  async function recognize() {
    if (!file) return;
    const run = ++generation.current;
    setBusy(true);
    setPages([]);
    setError("");
    setStatus("Preparing pages…");
    let owned: Worker | null = null;
    const active = () => mounted.current && run === generation.current;
    try {
      let sheets: Sheet[];
      if (/\.pdf$/i.test(file.name)) {
        const pdf = await openPDF(file);
        try {
          if (pdf.numPages > 10)
            throw Error(
              "OCR supports up to 10 pages per run. Split larger PDFs first.",
            );
        } finally {
          await pdf.loadingTask.destroy();
        }
        sheets = await pdfSheets(file);
      } else {
        const image = await imageSheet(file);
        const scale = Math.min(
          595.28 / image.canvas.width,
          841.89 / image.canvas.height,
        );
        sheets = [
          {
            ...image,
            width: image.canvas.width * scale,
            height: image.canvas.height * scale,
          },
        ];
      }
      if (!active()) return;
      const { createWorker, OEM } = await import("tesseract.js");
      const initializing = createWorker(language, OEM.LSTM_ONLY, {
        workerPath: "/ocr-assets/worker.min.js",
        corePath: "/ocr-assets/core",
        langPath: "/ocr-assets",
        logger: (message) => {
          if (active())
            setStatus(
              `${message.status} — ${Math.round(message.progress * 100)}%`,
            );
        },
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        owned = await Promise.race([
          initializing,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  Error(
                    "OCR model loading timed out. Check your connection and try again.",
                  ),
                ),
              90000,
            );
          }),
        ]);
      } catch (e) {
        void initializing.then((w) => w.terminate()).catch(() => {});
        throw e;
      } finally {
        clearTimeout(timer);
      }
      if (!active()) return;
      worker.current = owned;
      const next: OCRPage[] = [];
      for (let i = 0; i < sheets.length; i++) {
        if (!active()) return;
        setStatus(`Recognizing page ${i + 1} of ${sheets.length}…`);
        let timeout: ReturnType<typeof setTimeout> | undefined;
        let data;
        try {
          ({ data } = await Promise.race([
            owned.recognize(sheets[i].canvas, {}, { text: true, blocks: true }),
            new Promise<never>((_, reject) => {
              timeout = setTimeout(
                () =>
                  reject(
                    Error(
                      "A page took too long to recognize. Use a clearer, smaller scan and try again.",
                    ),
                  ),
                120000,
              );
            }),
          ]));
        } finally {
          clearTimeout(timeout);
        }
        const words = (data.blocks ?? []).flatMap((b) =>
          b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
        );
        next.push({ sheet: sheets[i], text: data.text, words });
      }
      if (active()) {
        if (!next.some((p) => p.text.trim()))
          throw Error(
            "No text was recognized. Try a clear, upright scan and the correct language.",
          );
        setPages(next);
        setResultLanguage(language);
        setStatus(
          `Recognized ${next.length} page(s). Check the text for OCR mistakes.`,
        );
      }
    } catch (e) {
      if (active()) setError((e as Error).message);
    } finally {
      if (owned) await owned.terminate().catch(() => {});
      if (worker.current === owned) worker.current = null;
      if (active()) setBusy(false);
    }
  }
  async function docx() {
    setError("");
    try {
      const { Document, Paragraph, TextRun, Packer } = await import("docx");
      const document = new Document({
        sections: pages.map((p) => ({
          children: p.text
            .split("\n")
            .map((line) => new Paragraph({ children: [new TextRun(line)] })),
        })),
      });
      saveFile(await Packer.toBlob(document), "mindkosh-ocr.docx");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function searchable() {
    setError("");
    try {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      for (const recognized of pages) {
        const s = recognized.sheet;
        const page = pdf.addPage([s.width, s.height]);
        const image = await pdf.embedPng(s.canvas.toDataURL());
        page.drawImage(image, { x: 0, y: 0, width: s.width, height: s.height });
        for (const word of recognized.words) {
          let text = word.text;
          try {
            font.encodeText(text);
          } catch {
            text = text.replace(/[^\x20-\x7e]/g, "");
          }
          if (!text.trim()) continue;
          const x = (word.bbox.x0 * s.width) / s.canvas.width,
            y = s.height - (word.bbox.y1 * s.height) / s.canvas.height;
          const height =
            ((word.bbox.y1 - word.bbox.y0) * s.height) / s.canvas.height;
          const available =
            ((word.bbox.x1 - word.bbox.x0) * s.width) / s.canvas.width;
          const size = Math.max(
            1,
            Math.min(
              height,
              available / Math.max(font.widthOfTextAtSize(text, 1), 0.1),
            ),
          );
          page.drawText(text, { x, y, font, size, opacity: 0 });
        }
      }
      saveFile(
        new Blob([new Uint8Array(await pdf.save())], {
          type: "application/pdf",
        }),
        "mindkosh-searchable.pdf",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const text = pages.map((p, i) => `Page ${i + 1}\n${p.text}`).join("\n\n");
  return (
    <Toolkit
      title="OCR PDF"
      description="Recognize printed English or Hindi text in scanned PDFs and photos, locally in your browser."
    >
      <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm">
        Up to 10 PDF pages or one image. First use downloads the OCR model from
        this site; files stay on your device. Clear, upright printed text works
        best; handwriting and complex layouts may be inaccurate. English OCR can
        export a searchable PDF. Hindi/mixed OCR exports Unicode TXT or DOCX.
      </p>
      <label>
        Scanned PDF or photo
        <input
          className={inputStyle}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPages([]);
            setError("");
          }}
        />
      </label>
      <label className="mt-4 block">
        Text language
        <select
          className={inputStyle}
          value={language}
          disabled={busy}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="eng">English</option>
          <option value="hin">Hindi</option>
          <option value="eng+hin">English + Hindi</option>
        </select>
      </label>
      <div className="mt-4 flex gap-3">
        <button
          className={buttonStyle}
          disabled={!file || busy}
          onClick={() => void recognize()}
        >
          {busy ? "Recognizing…" : "Recognize text"}
        </button>
        {busy && (
          <button className="rounded-xl border px-4 py-2" onClick={cancel}>
            Cancel OCR
          </button>
        )}
      </div>
      {status && (
        <p role="status" className="mt-3 text-indigo-700">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-red-700">
          {error}
        </p>
      )}
      {pages.length > 0 && (
        <>
          <Output
            value={text}
            name="Recognized text"
            filename="mindkosh-ocr.txt"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button className={buttonStyle} onClick={() => void docx()}>
              Download Word (DOCX)
            </button>
            {resultLanguage === "eng" && (
              <button className={buttonStyle} onClick={() => void searchable()}>
                Download searchable PDF
              </button>
            )}
          </div>
        </>
      )}
    </Toolkit>
  );
}
