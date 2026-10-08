import { useState } from "react";
import { PDFDocument } from "pdf-lib";

export default function PDFMerge() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function mergePDFs() {
    if (files.length < 2) {
      setError("Please select at least two PDF files.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const merged = await PDFDocument.create();
      for (const file of files) {
        const pdf = await PDFDocument.load(await file.arrayBuffer());
        const pages = await merged.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      }
      const bytes = await merged.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "MindKosh-Pixora-Merged.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Could not merge PDFs. Check that files are valid and not password protected.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-lg">
      <h2 className="mb-3 text-3xl font-bold">Merge PDF Files</h2>
      <p className="mb-6 text-gray-600">
        Combine multiple PDF documents into one. Files are processed in your browser.
      </p>
      <input
        type="file"
        accept=".pdf,application/pdf"
        multiple
        onChange={(e) => {
          setFiles(Array.from(e.target.files || []));
          setError("");
        }}
        className="mb-5 block w-full"
      />
      {files.length > 0 && (
        <div className="mb-5 rounded-lg bg-gray-100 p-4">
          <p className="font-semibold">Selected files: {files.length}</p>
          {files.map((file, index) => (
            <p key={index} className="mt-2 text-sm">
              {index + 1}. {file.name}
            </p>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mb-4 text-red-600">{error}</p>}
      <button
        onClick={mergePDFs}
        disabled={loading || files.length < 2}
        className="w-full rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white disabled:opacity-50"
      >
        {loading ? "Merging PDFs..." : "Merge & Download PDF"}
      </button>
    </div>
  );
}