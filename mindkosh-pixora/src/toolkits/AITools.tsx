import { useEffect, useRef, useState } from "react";
import { Toolkit, Tabs, inputStyle, buttonStyle, saveFile } from "./ui";
function png(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Image export failed."))),
      "image/png",
    ),
  );
}
export default function AITools() {
  const [tab, setTab] = useState("Background Remover");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cutout, setCutout] = useState<HTMLImageElement | null>(null);
  const [colour, setColour] = useState("#ffffff");
  const [transparent, setTransparent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("photo");
  const canvas = useRef<HTMLCanvasElement>(null);
  const urls = useRef(new Set<string>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  function render() {
    if (!cutout) return null;
    const output = document.createElement("canvas");
    output.width = cutout.naturalWidth;
    output.height = cutout.naturalHeight;
    const ctx = output.getContext("2d")!;
    ctx.drawImage(cutout, 0, 0);
    if (tab === "Subject Mask") {
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, output.width, output.height);
    } else if (tab === "Background Changer" || !transparent) {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, output.width, output.height);
    }
    return output;
  }
  useEffect(() => {
    const output = render();
    if (!output || !canvas.current) return;
    const preview = canvas.current;
    const scale = Math.min(1, 600 / Math.max(output.width, output.height));
    preview.width = Math.round(output.width * scale);
    preview.height = Math.round(output.height * scale);
    preview
      .getContext("2d")!
      .drawImage(output, 0, 0, preview.width, preview.height);
  }, [cutout, tab, colour, transparent]);
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") || file.size > 25 * 1024 * 1024) {
      setError("Choose an image up to 25 MB.");
      return;
    }
    setBusy(true);
    setProgress("Reading image…");
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    try {
      const next = new Image();
      next.src = url;
      await next.decode();
      if (!alive.current) return;
      if (next.naturalWidth * next.naturalHeight > 40000000)
        throw Error("Resize images larger than 40 megapixels first.");
      urls.current.forEach((previous) => {
        if (previous !== url) {
          URL.revokeObjectURL(previous);
          urls.current.delete(previous);
        }
      });
      setImage(next);
      setCutout(null);
      setName(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) {
        setBusy(false);
        setProgress("");
      }
    }
  }
  async function process() {
    if (!image) return;
    setBusy(true);
    setError("");
    setProgress("Loading AI model…");
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(image.src, {
        publicPath: new URL("/background-assets/", location.origin).href,
        model: "medium",
        proxyToWorker: false,
        output: { format: "image/png", quality: 1 },
        progress: (key, current, total) => {
          if (alive.current)
            setProgress(
              key.startsWith("compute:")
                ? "Finding the foreground subject…"
                : `Loading AI tools: ${total ? Math.round((current / total) * 100) : 0}%`,
            );
        },
      });
      if (!alive.current) return;
      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      const next = new Image();
      next.src = url;
      await next.decode();
      if (
        next.naturalWidth !== image.naturalWidth ||
        next.naturalHeight !== image.naturalHeight
      )
        throw Error("Unexpected output dimensions. Original retained.");
      if (!alive.current) return;
      if (cutout) {
        URL.revokeObjectURL(cutout.src);
        urls.current.delete(cutout.src);
      }
      setCutout(next);
    } catch {
      if (alive.current)
        setError(
          "Could not process this photo. Retry with a clear subject and an internet connection for the first model download.",
        );
    } finally {
      if (alive.current) {
        setBusy(false);
        setProgress("");
      }
    }
  }
  return (
    <Toolkit
      title="AI Tools"
      description="AI Image Studio: remove backgrounds, replace colours and create subject silhouettes using a real AI model on your device."
    >
      <Tabs
        tabs={["Background Remover", "Background Changer", "Subject Mask"]}
        value={tab}
        onChange={setTab}
      />
      <label className="block text-sm font-semibold">
        Upload image
        <input
          aria-label="AI image upload"
          type="file"
          accept="image/*"
          disabled={busy}
          className={inputStyle}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-3 text-xs text-slate-500">
        Up to 25 MB / 40 megapixels. First use downloads the AI model from this
        site. For group photos needing precise cleanup, use Passport Photo
        Maker’s crop and refinement brush.
      </p>
      {image && (
        <div className="mt-5 grid min-w-0 gap-5 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Original</h2>
            <img
              src={image.src}
              alt="Original uploaded photo"
              className="max-h-80 w-full rounded-xl object-contain"
            />
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">AI result</h2>
            {cutout ? (
              <canvas
                ref={canvas}
                aria-label="AI result preview"
                className="mx-auto max-h-80 max-w-full object-contain"
                style={{
                  backgroundImage:
                    "repeating-conic-gradient(#cbd5e1 0% 25%, white 0% 50%)",
                  backgroundSize: "16px 16px",
                }}
              />
            ) : (
              <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">
                Process the image to see the result.
              </p>
            )}
          </div>
        </div>
      )}
      {tab !== "Subject Mask" && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {tab === "Background Remover" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(e) => setTransparent(e.target.checked)}
              />
              Transparent background
            </label>
          )}
          <label className="flex items-center gap-3 text-sm">
            Replacement colour
            <input
              aria-label="AI replacement colour"
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
            />
          </label>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className={buttonStyle}
          disabled={!image || busy}
          onClick={() => void process()}
        >
          {busy ? "Processing…" : "Process image"}
        </button>
        <button
          className={buttonStyle}
          disabled={!cutout || busy}
          onClick={async () => {
            try {
              const output = render();
              if (output)
                saveFile(
                  await png(output),
                  `${name}-${tab.toLowerCase().replace(/ /g, "-")}.png`,
                );
            } catch {
              setError("Download failed. Please retry.");
            }
          }}
        >
          Download lossless PNG
        </button>
      </div>
      {busy && (
        <p role="status" className="mt-3 text-sm text-indigo-700">
          {progress}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mt-5 text-xs text-slate-500">
        Output retains original pixel dimensions. AI can miss fine edges or keep
        multiple people; inspect the result before use. Subject Mask creates a
        black silhouette of the detected foreground on transparency.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Background removal by IMG.LY ·{" "}
        <a className="underline" href="/background-assets/LICENSE.md">
          AGPL licence
        </a>{" "}
        ·{" "}
        <a
          className="underline"
          href="https://github.com/LovejeetBawa/mindkosh-pixora"
        >
          Source code
        </a>
      </p>
    </Toolkit>
  );
}
