import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Toolkit, inputStyle, buttonStyle, saveFile } from "../toolkits/ui";
import { imageSheet, type Sheet } from "../document-tools/files";
import RegionPreview from "../document-tools/RegionPreview";
import { bounds, type Region } from "../document-tools/cleanup";
export default function ImagePDF({ scan = false }: { scan?: boolean }) {
  const [images, setImages] = useState<Sheet[]>([]),
    [index, setIndex] = useState(0),
    [paper, setPaper] = useState("A4"),
    [margin, setMargin] = useState(10),
    [region, setRegion] = useState<Region>({ x: 0, y: 0, width: 1, height: 1 }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tone, setTone] = useState("colour");
  const current = images[index];
  async function upload(files: File[]) {
    setBusy(true);
    setError("");
    try {
      if (images.length + files.length > 30)
        throw Error("Choose up to 30 photos.");
      const next = [...images];
      for (const file of files) {
        next.push(await imageSheet(file));
        if (
          next.reduce((a, s) => a + s.canvas.width * s.canvas.height, 0) >
          60000000
        )
          throw Error("Use a smaller collection, up to 60 megapixels total.");
      }
      setImages(next);
      setRegion({ x: 0, y: 0, width: 1, height: 1 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function crop() {
    if (!current) return;
    const r = bounds(region, current.canvas.width, current.canvas.height);
    const canvas = document.createElement("canvas");
    canvas.width = r.width;
    canvas.height = r.height;
    canvas
      .getContext("2d")!
      .drawImage(
        current.canvas,
        r.x,
        r.y,
        r.width,
        r.height,
        0,
        0,
        r.width,
        r.height,
      );
    setImages(images.map((s, i) => (i === index ? { ...s, canvas } : s)));
    setRegion({ x: 0, y: 0, width: 1, height: 1 });
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      if (!Number.isFinite(margin) || margin < 0 || margin > 40)
        throw Error("Use a margin from 0–40 mm.");
      const pdf = await PDFDocument.create();
      for (const s of images) {
        const canvas = document.createElement("canvas");
        canvas.width = s.canvas.width;
        canvas.height = s.canvas.height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(s.canvas, 0, 0);
        if (tone !== "colour") {
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < pixels.data.length; i += 4) {
            let g = Math.round(
              0.299 * pixels.data[i] +
                0.587 * pixels.data[i + 1] +
                0.114 * pixels.data[i + 2],
            );
            if (tone === "bw") g = g > 160 ? 255 : 0;
            pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = g;
          }
          ctx.putImageData(pixels, 0, 0);
        }
        const pad = (margin * 72) / 25.4;
        let [w, h] =
          paper === "A4"
            ? [595.28, 841.89]
            : paper === "Letter"
              ? [612, 792]
              : [
                  (canvas.width * 72) / 300 + 2 * pad,
                  (canvas.height * 72) / 300 + 2 * pad,
                ];
        if (paper === "A4 landscape") [w, h] = [841.89, 595.28];
        const image = await pdf.embedPng(canvas.toDataURL("image/png"));
        const scale = Math.min(
          (w - 2 * pad) / image.width,
          (h - 2 * pad) / image.height,
        );
        const page = pdf.addPage([w, h]);
        page.drawImage(image, {
          x: (w - image.width * scale) / 2,
          y: (h - image.height * scale) / 2,
          width: image.width * scale,
          height: image.height * scale,
        });
      }
      saveFile(
        new Blob([new Uint8Array(await pdf.save())], {
          type: "application/pdf",
        }),
        "mindkosh-images.pdf",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Toolkit
      title={scan ? "Scan to PDF" : "JPG to PDF"}
      description={
        scan
          ? "Capture document photos, select the page area and combine scans into a PDF."
          : "Combine JPG, PNG and WebP images into one PDF. Images retain their original pixel dimensions."
      }
    >
      <label className="block font-semibold">
        Add photos
        <input
          className={inputStyle}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>
      {scan && (
        <label className="mt-3 block">
          Take document photo
          <input
            className={inputStyle}
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            onChange={(e) => {
              void upload(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
      )}
      <p className="mt-3 text-sm text-slate-500">
        Up to 30 photos / 25 MB per file. Camera capture depends on your mobile
        browser. Cropping selects the page area; it does not straighten
        perspective automatically.
      </p>
      {current && (
        <div className="mt-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <label>
              Photo
              <select
                className={inputStyle}
                value={index}
                disabled={busy}
                onChange={(e) => {
                  setIndex(Number(e.target.value));
                  setRegion({ x: 0, y: 0, width: 1, height: 1 });
                }}
              >
                {images.map((_, i) => (
                  <option key={i} value={i}>
                    Photo {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={buttonStyle}
              disabled={busy || index === 0}
              onClick={() => {
                const next = [...images];
                [next[index], next[index - 1]] = [next[index - 1], next[index]];
                setImages(next);
                setIndex(index - 1);
              }}
            >
              Move earlier
            </button>
            <button
              className={buttonStyle}
              disabled={busy || index === images.length - 1}
              onClick={() => {
                const next = [...images];
                [next[index], next[index + 1]] = [next[index + 1], next[index]];
                setImages(next);
                setIndex(index + 1);
              }}
            >
              Move later
            </button>
            <button
              className={buttonStyle}
              disabled={busy}
              onClick={() => {
                setImages(images.filter((_, i) => i !== index));
                setIndex(Math.max(0, index - 1));
              }}
            >
              Remove photo
            </button>
          </div>
          <RegionPreview
            source={current.canvas}
            region={region}
            onChange={setRegion}
          />
          <button
            className={`${buttonStyle} mt-3`}
            disabled={busy}
            onClick={crop}
          >
            Crop selected photo
          </button>
        </div>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label>
          Page size
          <select
            className={inputStyle}
            value={paper}
            disabled={busy}
            onChange={(e) => setPaper(e.target.value)}
          >
            {["A4", "A4 landscape", "Letter", "Original at 300 DPI"].map(
              (p) => (
                <option key={p}>{p}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Margin (mm)
          <input
            className={inputStyle}
            type="number"
            min="0"
            max="40"
            value={margin}
            disabled={busy}
            onChange={(e) => setMargin(Number(e.target.value))}
          />
        </label>
        <label>
          Colour
          <select
            aria-label="Colour"
            className={inputStyle}
            value={tone}
            disabled={busy}
            onChange={(e) => setTone(e.target.value)}
          >
            <option value="colour">Original colours</option>
            <option value="gray">Grayscale</option>
            <option value="bw">Black and white</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      <button
        className={`${buttonStyle} mt-5`}
        disabled={busy || !images.length}
        onClick={() => void download()}
      >
        {busy ? "Processing…" : "Download PDF"}
      </button>
    </Toolkit>
  );
}
