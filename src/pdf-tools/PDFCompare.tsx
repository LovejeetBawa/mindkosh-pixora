import { useState } from "react";
import { Toolkit, inputStyle, buttonStyle, saveFile } from "../toolkits/ui";
import { openPDF, type Sheet } from "../document-tools/files";
import { textRows } from "./operations";
type Comparison = { name: string; text: string[]; sheets: Sheet[] };
export default function PDFCompare() {
  const [docs, setDocs] = useState<(Comparison | null)[]>([null, null]),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load(file: File, side: number) {
    setBusy(true);
    setError("");
    setDocs((old) => old.map((d, i) => (i === side ? null : d)));
    try {
      const pdf = await openPDF(file);
      const sheets: Sheet[] = [];
      try {
        if (pdf.numPages > 20)
          throw Error("Compare up to 20 pages per document.");
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: Math.min(1, 1000 / Math.max(base.width, base.height)),
          });
          const c = document.createElement("canvas");
          c.width = Math.ceil(viewport.width);
          c.height = Math.ceil(viewport.height);
          await page.render({ canvas: c, viewport }).promise;
          sheets.push({
            canvas: c,
            width: viewport.width,
            height: viewport.height,
            id: String(i),
          });
        }
      } finally {
        await pdf.loadingTask.destroy();
      }
      let text: string[] = [];
      try {
        text = (await textRows(file)).map((r) => `Page ${r.page}: ${r.text}`);
      } catch (e) {
        if (!(e as Error).message.startsWith("No selectable")) throw e;
      }
      setDocs((old) =>
        old.map((d, i) => (i === side ? { name: file.name, text, sheets } : d)),
      );
      setIndex(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const left = new Set(docs[0]?.text),
    right = new Set(docs[1]?.text);
  const removed = docs[0]?.text.filter((t) => !right.has(t)) ?? [],
    added = docs[1]?.text.filter((t) => !left.has(t)) ?? [];
  return (
    <Toolkit
      title="Compare PDF"
      description="View documents side by side and compare their selectable text."
    >
      <p className="mb-4 text-sm text-slate-600">
        Line comparison ignores unchanged lines. It does not detect every
        graphic, font or layout change; inspect the page previews. Scanned PDFs
        show visual previews but need OCR for text comparison.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((side) => (
          <label key={side}>
            PDF {side === 0 ? "A (original)" : "B (updated)"}
            <input
              className={inputStyle}
              type="file"
              accept=".pdf"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void load(f, side);
                e.target.value = "";
              }}
            />
            {docs[side]?.name}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      {busy && <p role="status">Preparing comparison…</p>}
      {docs.some(Boolean) && (
        <>
          <label className="mt-5 block">
            Preview page
            <select
              className={inputStyle}
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
            >
              {Array.from(
                { length: Math.max(...docs.map((d) => d?.sheets.length ?? 0)) },
                (_, i) => (
                  <option key={i} value={i}>
                    Page {i + 1}
                  </option>
                ),
              )}
            </select>
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {docs.map((d, i) => (
              <div key={i} className="min-w-0 rounded-xl border p-3">
                <h2 className="font-bold">PDF {i === 0 ? "A" : "B"}</h2>
                {d?.sheets[index] ? (
                  <img
                    className="mt-2 w-full"
                    alt={`PDF ${i === 0 ? "A" : "B"} page ${index + 1}`}
                    src={d.sheets[index].canvas.toDataURL()}
                  />
                ) : (
                  <p>No page</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {docs.every(Boolean) && (
        <>
          <h2 className="mt-6 text-xl font-bold">Text differences</h2>
          {(!docs[0]?.text.length || !docs[1]?.text.length) && (
            <p className="mt-2 text-amber-800">
              At least one document has no selectable text. Use OCR to enable
              text comparison.
            </p>
          )}
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold">
                Only in PDF A ({removed.length})
              </h3>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-red-50 p-4 text-sm">
                {removed.join("\n") || "No removed lines found."}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold">Only in PDF B ({added.length})</h3>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-green-50 p-4 text-sm">
                {added.join("\n") || "No added lines found."}
              </pre>
            </div>
          </div>
          <button
            className={`${buttonStyle} mt-4`}
            onClick={() =>
              saveFile(
                new Blob(
                  [
                    `Removed / only in A\n${removed.join("\n")}\n\nAdded / only in B\n${added.join("\n")}`,
                  ],
                  { type: "text/plain;charset=utf-8" },
                ),
                "mindkosh-comparison.txt",
              )
            }
          >
            Download comparison
          </button>
        </>
      )}
    </Toolkit>
  );
}
