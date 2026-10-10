import { useEffect, useRef, useState } from "react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import {
  Toolkit,
  Output,
  inputStyle,
  buttonStyle,
  saveFile,
} from "../toolkits/ui";
import { extractText } from "./files";
import { languages, splitTranslation, readTranslation } from "./translation";
export default function DocumentTranslator() {
  const [source, setSource] = useState("en");
  const [target, setTarget] = useState("hi");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("translated-document");
  const abort = useRef<AbortController | null>(null);
  const [complete, setComplete] = useState(false);
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setProgress("Extracting document text…");
    try {
      const extracted = await extractText(file);
      setText(extracted);
      setResult("");
      setComplete(false);
      setFilename(file.name.replace(/\.[^.]+$/, ""));
      if (!extracted.trim()) throw Error("This document contains no text.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function translate() {
    setError("");
    setResult("");
    setComplete(false);
    if (!text.trim()) {
      setError("Upload a document or enter text.");
      return;
    }
    if (source === target) {
      setError("Choose two different languages.");
      return;
    }
    if ([...text].length > 5000) {
      setError(
        "Free translation accepts up to 5,000 characters per document. Split larger documents first.",
      );
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    const parts: string[] = [];
    try {
      const chunks = splitTranslation(text);
      for (let i = 0; i < chunks.length; i++) {
        if (controller.signal.aborted)
          throw new DOMException("Cancelled", "AbortError");
        setProgress(`Translating section ${i + 1} of ${chunks.length}…`);
        if (!chunks[i].trim()) {
          parts.push(chunks[i]);
          continue;
        }
        let translated = "";
        let direct: Response | undefined;
        try {
          const url = new URL("https://api.mymemory.translated.net/get");
          url.searchParams.set("q", chunks[i]);
          url.searchParams.set("langpair", `${source}|${target}`);
          direct = await fetch(url, {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(20000),
            ]),
            referrerPolicy: "no-referrer",
          });
        } catch (e) {
          if (controller.signal.aborted) throw e;
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunks[i], source, target }),
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(25000),
            ]),
          });
          const data = await response.json();
          if (!response.ok || typeof data.text !== "string")
            throw Error(
              data.error || "Free translation unavailable. Retry later.",
            );
          translated = data.text;
        }
        if (direct) {
          if (!direct.ok)
            throw Error(
              "Free translation service is unavailable or its quota has been reached.",
            );
          translated = readTranslation(await direct.json());
        }
        const el = document.createElement("textarea");
        el.innerHTML = translated;
        parts.push(el.value);
        setResult(parts.join("\n"));
      }
      setComplete(true);
    } catch (e) {
      setError(
        controller.signal.aborted
          ? "Translation cancelled. Any sections below are incomplete."
          : `${(e as Error).message} Any sections below are incomplete.`,
      );
    } finally {
      setBusy(false);
      setProgress("");
      abort.current = null;
    }
  }
  async function downloadDocx() {
    try {
      const doc = new Document({
        sections: [
          {
            children: result.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [new TextRun({ text: line, font: "Arial" })],
                  bidirectional: ["ar", "ur"].includes(target),
                }),
            ),
          },
        ],
      });
      saveFile(await Packer.toBlob(doc), `${filename}-${target}.docx`);
    } catch {
      setError("Could not export DOCX. Download TXT instead.");
    }
  }
  function print() {
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.width = "1px";
    frame.style.height = "1px";
    document.body.append(frame);
    const doc = frame.contentDocument;
    if (!doc) {
      frame.remove();
      return;
    }
    doc.open();
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8"><title>Translated document</title><style>body{font:16px Arial,sans-serif;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}@page{margin:20mm}</style></head><body></body></html>',
    );
    doc.close();
    doc.documentElement.lang = target;
    doc.body.dir = ["ar", "ur"].includes(target) ? "rtl" : "ltr";
    doc.body.textContent = result;
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 60000);
    }, 250);
  }
  return (
    <Toolkit
      local={false}
      title="Document Translator"
      description="Translate text from PDF, DOCX, TXT, Markdown, CSV or HTML into another language using the free MyMemory service."
    >
      <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        When you select Translate, document text is sent to MyMemory. Free
        quotas apply (usually 5,000 characters per day per IP). The original
        document remains on your device. Translation creates a new text
        document; original layouts, images and tables are not retained.
      </p>
      <label className="block text-sm">
        Upload document
        <input
          aria-label="Translation document"
          type="file"
          accept=".pdf,.docx,.txt,.md,.csv,.html,.htm"
          className={inputStyle}
          disabled={busy}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-2 text-xs text-slate-500">
        Up to 25 MB. PDFs need selectable text; scans need OCR first. Save
        legacy DOC files as DOCX. Review translations before official use.
      </p>
      <div className="my-5 grid gap-4 sm:grid-cols-2">
        {[
          ["Source language", source, setSource],
          ["Target language", target, setTarget],
        ].map(([name, value, change]) => (
          <label key={String(name)} className="text-sm">
            {String(name)}
            <select
              aria-label={String(name)}
              disabled={busy}
              className={inputStyle}
              value={String(value)}
              onChange={(e) => {
                (change as (v: string) => void)(e.target.value);
                setResult("");
                setComplete(false);
              }}
            >
              {Object.entries(languages).map(([code, label]) => (
                <option value={code} key={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <label className="block text-sm">
        Source text
        <textarea
          aria-label="Source text"
          disabled={busy}
          className={`${inputStyle} min-h-52`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult("");
            setComplete(false);
          }}
        />
      </label>
      <p className="mt-2 text-xs text-slate-500">
        {[...text].length.toLocaleString()} / 5,000 characters
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className={buttonStyle}
          disabled={busy}
          onClick={() => void translate()}
        >
          Translate document
        </button>
        {busy && abort.current && (
          <button
            className={buttonStyle}
            onClick={() => abort.current?.abort()}
          >
            Cancel translation
          </button>
        )}
      </div>
      {busy && (
        <p role="status" className="mt-4 text-indigo-700">
          {progress}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 break-words text-red-700">
          {error}
        </p>
      )}
      <Output
        name={
          complete
            ? "Translated text"
            : "Translated text (partial until complete)"
        }
        value={result}
        filename={`${filename}-${target}.txt`}
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className={buttonStyle}
          disabled={!complete || busy}
          onClick={() => void downloadDocx()}
        >
          Download translated DOCX
        </button>
        <button
          className={buttonStyle}
          disabled={!complete || busy}
          onClick={print}
        >
          Print / Save as PDF
        </button>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        For PDF output, choose “Save as PDF” in your browser’s print dialog.
        Service:{" "}
        <a
          className="underline"
          href="https://mymemory.translated.net/doc/usagelimits.php"
          target="_blank"
          rel="noreferrer"
        >
          MyMemory limits
        </a>
        . Input is not saved by this website.
      </p>
    </Toolkit>
  );
}
