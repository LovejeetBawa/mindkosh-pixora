import { useState } from "react";
import JSZip from "jszip";
import { Toolkit, inputStyle, buttonStyle, saveFile } from "../toolkits/ui";
import {
  copyCanvas,
  pdfSheets,
  imageSheet,
  exportPDF,
  canvasPNG,
  removeDocxWatermark,
  checkFile,
  type Sheet,
} from "./files";
import { cleanRegion, bounds, initialRegion, type Region } from "./cleanup";
import RegionPreview from "./RegionPreview";
export default function VisualDocuments({
  watermark = false,
}: {
  watermark?: boolean;
}) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [original, setOriginal] = useState<Sheet[]>([]);
  const [index, setIndex] = useState(0);
  const [region, setRegion] = useState<Region>(initialRegion);
  const [mode, setMode] = useState("cover");
  const [colour, setColour] = useState("#ffffff");
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(24);
  const [textColour, setTextColour] = useState("#000000");
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [special, setSpecial] = useState<File | null>(null);
  const [phrase, setPhrase] = useState("");
  const [graphics, setGraphics] = useState(true);
  const [isPDF, setIsPDF] = useState(true);
  const current = sheets[index];
  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (files.length > 10) throw Error("Select up to 10 files.");
      if (
        watermark &&
        files.length === 1 &&
        /\.(docx|txt|md)$/i.test(files[0].name)
      ) {
        checkFile(files[0]);
        setSpecial(files[0]);
        setSheets([]);
        setOriginal([]);
        return;
      }
      let next: Sheet[] = [];
      let hasPDF = false;
      for (const file of files) {
        if (/\.pdf$/i.test(file.name)) {
          hasPDF = true;
          next.push(...(await pdfSheets(file)));
        } else if (watermark && file.type.startsWith("image/"))
          next.push(await imageSheet(file));
        else
          throw Error(
            watermark
              ? "Choose images, PDF, or one DOCX/TXT file."
              : "Choose PDF files.",
          );
        if (
          next.length > 30 ||
          next.reduce((sum, s) => sum + s.canvas.width * s.canvas.height, 0) >
            65000000
        )
          throw Error("Use up to 30 pages and a smaller collection.");
      }
      setSpecial(null);
      setSheets(next);
      setOriginal(next.map((s) => ({ ...s, canvas: copyCanvas(s.canvas) })));
      setIndex(0);
      setIsPDF(hasPDF);
      setRegion(initialRegion);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(kind: string) {
    if (!current) return;
    setError("");
    setNotice("");
    try {
      const targets = all ? sheets.map((_, i) => i) : [index];
      const next = [...sheets];
      for (const i of targets) {
        const s = sheets[i];
        const canvas = copyCanvas(s.canvas);
        if (kind === "clean") cleanRegion(canvas, region, mode, colour);
        else {
          if (!text.trim()) throw Error("Enter text to add.");
          if (!Number.isFinite(fontSize) || fontSize < 6 || fontSize > 200)
            throw Error("Use a font size from 6–200.");
          const ctx = canvas.getContext("2d")!;
          const r = bounds(region, canvas.width, canvas.height);
          ctx.font = `${(fontSize * canvas.width) / s.width}px sans-serif`;
          ctx.fillStyle = textColour;
          ctx.textBaseline = "top";
          const lineHeight = ((fontSize * canvas.width) / s.width) * 1.25;
          let y = r.y;
          for (const paragraph of text.split("\n")) {
            let line = "";
            for (const word of paragraph.split(" ")) {
              const test = line ? line + " " + word : word;
              if (ctx.measureText(test).width > r.width && line) {
                if (y + lineHeight > canvas.height)
                  throw Error(
                    "Text does not fit. Move the area up or reduce font size.",
                  );
                ctx.fillText(line, r.x, y);
                y += lineHeight;
                line = word;
              } else line = test;
            }
            if (y + lineHeight > canvas.height)
              throw Error(
                "Text does not fit. Move the area up or reduce font size.",
              );
            ctx.fillText(line, r.x, y);
            y += lineHeight;
          }
        }
        next[i] = { ...s, canvas };
      }
      setSheets(next);
      setNotice("Edit applied. Inspect the preview before downloading.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function rotate() {
    const s = current;
    if (!s) return;
    const c = document.createElement("canvas");
    c.width = s.canvas.height;
    c.height = s.canvas.width;
    const ctx = c.getContext("2d")!;
    ctx.translate(c.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(s.canvas, 0, 0);
    setSheets(
      sheets.map((v, i) =>
        i === index ? { ...v, canvas: c, width: s.height, height: s.width } : v,
      ),
    );
  }
  function move(direction: number) {
    const to = index + direction;
    if (to < 0 || to >= sheets.length) return;
    const next = [...sheets];
    [next[index], next[to]] = [next[to], next[index]];
    setSheets(next);
    setIndex(to);
  }
  async function download(kind: string) {
    setBusy(true);
    setError("");
    try {
      if (kind === "pdf")
        saveFile(await exportPDF(sheets), "mindkosh-edited.pdf");
      else if (sheets.length === 1)
        saveFile(await canvasPNG(current.canvas), "mindkosh-cleaned.png");
      else {
        const zip = new JSZip();
        for (let i = 0; i < sheets.length; i++)
          zip.file(`image-${i + 1}.png`, await canvasPNG(sheets[i].canvas));
        saveFile(
          await zip.generateAsync({ type: "blob" }),
          "mindkosh-cleaned-images.zip",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cleanSpecial() {
    if (!special) return;
    setBusy(true);
    setError("");
    try {
      if (/\.docx$/i.test(special.name)) {
        if (!graphics && !phrase)
          throw Error("Select header graphics or enter watermark text.");
        const result = await removeDocxWatermark(special, phrase, graphics);
        saveFile(result.blob, "cleaned-" + special.name);
        setNotice(`Removed ${result.removed} matching items.`);
      } else {
        if (!phrase) throw Error("Enter the exact watermark text.");
        const source = await special.text();
        if (!source.includes(phrase))
          throw Error("No matching watermark text found.");
        saveFile(
          new Blob([source.split(phrase).join("")], {
            type: "text/plain;charset=utf-8",
          }),
          "cleaned-" + special.name,
        );
        setNotice("Matching text removed.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Toolkit
      title={watermark ? "Watermark Remover" : "PDF Editor"}
      description={
        watermark
          ? "Select and clean watermark areas in images and PDFs, or remove matching text and header graphics from DOCX."
          : "Add text, cover areas, rotate, reorder and remove PDF pages. Combine multiple PDFs into one edited document."
      }
    >
      <label className="block text-sm font-semibold">
        {watermark ? "Upload files" : "Upload PDFs"}
        <input
          aria-label="Document files"
          className={inputStyle}
          type="file"
          multiple
          accept={
            watermark ? "image/*,.pdf,.docx,.txt,.md" : ".pdf,application/pdf"
          }
          disabled={busy}
          onChange={(e) => {
            void upload(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-3 text-xs text-slate-500">
        Up to 25 MB per file, 10 files and 30 visual pages.{" "}
        {watermark
          ? "Images export at original pixel dimensions. Cleanup blends nearby colours or covers the selected area; it cannot recover detail hidden by a watermark. Other file types are not supported."
          : ""}{" "}
        PDF edits export rendered pages, preserving page sizes but converting
        selectable text, links and forms into images. Covering is visual
        cleanup, not secure redaction.
      </p>
      {special && (
        <div className="mt-5 space-y-4">
          <p className="break-all font-semibold">{special.name}</p>
          <label className="block text-sm">
            Exact watermark text
            <input
              className={inputStyle}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
            />
          </label>
          {/\.docx$/i.test(special.name) && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={graphics}
                  onChange={(e) => setGraphics(e.target.checked)}
                />
                Remove header/footer graphics
              </label>
              <p className="text-xs text-slate-500">
                Removes header/footer pictures and shapes, including logos. Body
                images and text split across formatting runs are retained. Keep
                an original copy.
              </p>
            </>
          )}
          <button
            className={buttonStyle}
            disabled={busy}
            onClick={() => void cleanSpecial()}
          >
            Clean & download document
          </button>
        </div>
      )}
      {current && (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              className={buttonStyle}
              disabled={index === 0 || busy}
              onClick={() => setIndex(index - 1)}
            >
              Previous page
            </button>
            <span>
              Page {index + 1} of {sheets.length}
            </span>
            <button
              className={buttonStyle}
              disabled={index === sheets.length - 1 || busy}
              onClick={() => setIndex(index + 1)}
            >
              Next page
            </button>
          </div>
          <RegionPreview
            source={current.canvas}
            region={region}
            onChange={setRegion}
          />
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <label className="text-sm">
              Cleanup method
              <select
                aria-label="Cleanup method"
                className={inputStyle}
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="cover">Cover with colour</option>
                <option value="blend">Blend surrounding pixels</option>
              </select>
            </label>
            <label className="text-sm">
              Cover colour
              <input
                aria-label="Cover colour"
                className="ml-2"
                type="color"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
              />
            </label>
            <button
              className={buttonStyle}
              disabled={busy}
              onClick={() => edit("clean")}
            >
              {watermark ? "Remove selected watermark" : "Cover selected area"}
            </button>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
            />
            Apply cleanup or text to every page (same relative position)
          </label>
          {!watermark && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Text to add
                <textarea
                  aria-label="Text to add"
                  className={inputStyle}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <div>
                <label className="block text-sm">
                  Font size (points)
                  <input
                    className={inputStyle}
                    type="number"
                    min={6}
                    max={200}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  />
                </label>
                <label className="mt-3 block text-sm">
                  Text colour
                  <input
                    aria-label="Text colour"
                    type="color"
                    className="ml-3"
                    value={textColour}
                    onChange={(e) => setTextColour(e.target.value)}
                  />
                </label>
              </div>
              <button
                className={buttonStyle}
                disabled={busy}
                onClick={() => edit("text")}
              >
                Add text at selection
              </button>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className={buttonStyle} disabled={busy} onClick={rotate}>
              Rotate page 90°
            </button>
            <button
              className={buttonStyle}
              disabled={index === 0 || busy}
              onClick={() => move(-1)}
            >
              Move page earlier
            </button>
            <button
              className={buttonStyle}
              disabled={index === sheets.length - 1 || busy}
              onClick={() => move(1)}
            >
              Move page later
            </button>
            <button
              className={buttonStyle}
              disabled={sheets.length === 1 || busy}
              onClick={() => {
                setSheets(sheets.filter((_, i) => i !== index));
                setIndex(Math.min(index, sheets.length - 2));
              }}
            >
              Delete page
            </button>
            <button
              className="rounded-xl border px-4 py-2"
              disabled={busy}
              onClick={() => {
                setSheets(
                  original.map((s) => ({ ...s, canvas: copyCanvas(s.canvas) })),
                );
                setIndex(0);
                setNotice("Original pages restored.");
              }}
            >
              Reset all edits
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {(isPDF || !watermark) && (
              <button
                className={buttonStyle}
                disabled={busy}
                onClick={() => void download("pdf")}
              >
                Download edited PDF
              </button>
            )}
            {watermark && (
              <button
                className={buttonStyle}
                disabled={busy}
                onClick={() => void download("png")}
              >
                {sheets.length > 1
                  ? "Download PNG ZIP"
                  : "Download lossless PNG"}
              </button>
            )}
          </div>
        </div>
      )}
      {busy && (
        <p role="status" className="mt-4 text-indigo-700">
          Processing file…
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-indigo-700">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 break-words text-red-700">
          {error}
        </p>
      )}
    </Toolkit>
  );
}
