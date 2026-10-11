import { useState, useRef, useEffect } from "react";
import { Toolkit, inputStyle, buttonStyle } from "../toolkits/ui";
import { checkFile } from "../document-tools/files";
import { safePrintableHTML, escapeHTML } from "./operations";
export default function DocumentPDF({
  kind,
}: {
  kind: "wordpdf" | "excelpdf" | "htmlpdf";
}) {
  const [html, setHTML] = useState(""),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    setReady(false);
  }, [html]);
  async function upload(file: File) {
    setBusy(true);
    setError("");
    setHTML("");
    try {
      checkFile(file);
      let content = "";
      if (kind === "wordpdf") {
        if (!/\.docx$/i.test(file.name))
          throw Error("Choose DOCX. Legacy DOC must be saved as DOCX first.");
        const { convertToHtml } = await import("mammoth/mammoth.browser");
        content = (
          await convertToHtml({ arrayBuffer: await file.arrayBuffer() })
        ).value;
      } else if (kind === "excelpdf") {
        if (!/\.xlsx$/i.test(file.name))
          throw Error("Choose XLSX. Legacy XLS must be saved as XLSX first.");
        const { default: readXlsxFile } = await import(
          "read-excel-file/browser"
        );
        const sheets = await readXlsxFile(file);
        if (sheets.length > 20) throw Error("Choose up to 20 worksheets.");
        let total = 0;
        for (const sheet of sheets) {
          const name = sheet.sheet,
            rows = sheet.data;
          total += rows.length;
          if (total > 5000)
            throw Error("Use up to 5,000 rows. Split larger spreadsheets.");
          if (rows.some((row) => row.length > 30))
            throw Error("Use up to 30 columns per worksheet.");
          content += `<section><h2>${escapeHTML(name)}</h2><table><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHTML(cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
        }
      } else {
        if (!/\.(html?|txt)$/i.test(file.name))
          throw Error("Choose HTML or TXT.");
        content = await file.text();
      }
      setHTML(safePrintableHTML(content));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Toolkit
      title={
        kind === "wordpdf"
          ? "Word to PDF"
          : kind === "excelpdf"
            ? "Excel to PDF"
            : "HTML to PDF"
      }
      description="Prepare a printable preview, then choose Save as PDF in your browser print dialog."
    >
      <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm">
        {kind === "wordpdf"
          ? "DOCX text, headings, tables and embedded images are supported. Fonts, exact pagination, headers and advanced layouts may change."
          : kind === "excelpdf"
            ? "XLSX worksheet values are printed as tables. Formula results use saved values; charts, macros, formulas and original styling are not recreated. Choose landscape in the print dialog for wide tables."
            : "Upload local HTML or paste code. Scripts, external assets and custom styles are removed. This tool does not fetch website URLs."}{" "}
        Preview the document before saving. Browser printing must be available
        on your device.
      </p>
      <label className="block">
        Choose document
        <input
          className={inputStyle}
          disabled={busy}
          type="file"
          accept={
            kind === "wordpdf"
              ? ".docx"
              : kind === "excelpdf"
                ? ".xlsx"
                : ".html,.htm,.txt"
          }
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
      </label>
      {kind === "htmlpdf" && (
        <>
          <label className="mt-4 block">
            HTML code
            <textarea
              className={`${inputStyle} min-h-40 font-mono`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <button
            className={`${buttonStyle} mt-3`}
            disabled={!input.trim() || busy}
            onClick={() => {
              setError("");
              setHTML(safePrintableHTML(input));
            }}
          >
            Prepare preview
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      {busy && <p role="status">Preparing preview…</p>}
      {html && (
        <>
          <iframe
            title="Printable document preview"
            ref={frame}
            sandbox="allow-modals allow-same-origin"
            srcDoc={html}
            onLoad={() => setReady(true)}
            className="mt-5 h-[65vh] w-full border bg-white"
          />
          <button
            className={`${buttonStyle} mt-4`}
            disabled={!ready}
            onClick={() => {
              try {
                frame.current?.contentWindow?.focus();
                frame.current?.contentWindow?.print();
              } catch {
                setError(
                  "Printing is unavailable in this browser. Download the preview and print it from a browser that supports Save as PDF.",
                );
              }
            }}
          >
            Print / Save as PDF
          </button>
          <button
            className="ml-3 mt-4 rounded-xl border px-4 py-2"
            onClick={() => {
              const blob = new Blob([html], {
                type: "text/html;charset=utf-8",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "mindkosh-print-preview.html";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }}
          >
            Download print preview
          </button>
        </>
      )}
    </Toolkit>
  );
}
