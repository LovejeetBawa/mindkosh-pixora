import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FlipHorizontal,
  FlipVertical,
  Image as ImageIcon,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Shield,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  DEFAULT_SETTINGS,
  ENHANCE_DEFAULTS,
  FORMATS,
  detectSupport,
  encodeCanvas,
  finalSize,
  formatBytes,
  getFormat,
  loadImageFile,
  renderImage,
  type FilterName,
  type Format,
  type Settings,
} from "./lib/processor";

interface Item {
  id: string;
  file: File;
  url: string;
  img: HTMLImageElement;
  w: number;
  h: number;
  status: "idle" | "working" | "done" | "error";
  blob?: Blob;
  resultUrl?: string;
  outW?: number;
  outH?: number;
  error?: string;
}

const SIZE_PRESETS = [
  { label: "HD 1280×720", w: "1280", h: "720" },
  { label: "Full HD 1920×1080", w: "1920", h: "1080" },
  { label: "4K 3840×2160", w: "3840", h: "2160" },
  { label: "Instagram 1080×1080", w: "1080", h: "1080" },
  { label: "Story 1080×1920", w: "1080", h: "1920" },
  { label: "Thumbnail 300", w: "300", h: "300" },
  { label: "Avatar 128", w: "128", h: "128" },
  { label: "Favicon 64", w: "64", h: "64" },
];

const ENHANCE_PRESETS: { name: string; emoji: string; v: Partial<Settings> }[] = [
  { name: "Original", emoji: "🖼️", v: {} },
  { name: "Auto Fix", emoji: "✨", v: { autoEnhance: true } },
  { name: "Vivid", emoji: "🌈", v: { saturation: 35, contrast: 15, sharpness: 20 } },
  { name: "HD Sharp", emoji: "🔍", v: { sharpness: 70, contrast: 10 } },
  { name: "Warm", emoji: "🌅", v: { warmth: 35, saturation: 10, brightness: 5 } },
  { name: "Cool", emoji: "🧊", v: { warmth: -35, contrast: 8 } },
  { name: "B&W", emoji: "⚫", v: { filter: "grayscale", contrast: 20 } },
  { name: "Vintage", emoji: "📷", v: { filter: "sepia", contrast: -10, brightness: 5 } },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const baseName = (n: string) => n.replace(/\.[^.]+$/, "") || "image";

const checker: React.CSSProperties = {
  backgroundColor: "#fff",
  backgroundImage:
    "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
};

function Slider({
  label,
  value,
  min = -100,
  max = 100,
  onChange,
  suffix = "",
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <button
          onClick={() => onChange(min < 0 ? 0 : min)}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-500 hover:bg-slate-200"
          title="Reset"
        >
          {value}
          {suffix}
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-indigo-600"
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<"format" | "resize" | "enhance">("format");
  const [support, setSupport] = useState<Record<Format, boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const [helper, setHelper] = useState<{ url: string; name: string; blob: Blob; message?: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const saveToDevice = async (blob: Blob, name: string) => {
    const pickerWindow = window as typeof window & {
      showSaveFilePicker?: (options: {
        suggestedName: string;
        types: { description: string; accept: Record<string, string[]> }[];
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Blob) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    };

    if (!pickerWindow.showSaveFilePicker) return false;
    try {
      const extension = `.${name.split(".").pop() || "bin"}`;
      const handle = await pickerWindow.showSaveFilePicker({
        suggestedName: name,
        types: [
          {
            description: blob.type.startsWith("image/") ? "Image file" : "MindKosh Pixora file",
            accept: { [blob.type || "application/octet-stream"]: [extension] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      // AbortError means the user intentionally closed the Save dialog.
      if (error instanceof DOMException && error.name === "AbortError") return true;
      return false;
    }
  };

  const startDownload = async (url: string, name: string, blob: Blob) => {
    setShowPreview(false);
    setDataUrl(null);
    const saved = await saveToDevice(blob, name);
    if (saved) {
      setHelper(null);
      return;
    }

    // Older browsers and restricted embeds use the standard download attribute.
    download(url, name);
    setHelper({
      url,
      name,
      blob,
      message:
        "Chrome ne native Save dialog allow nahi kiya. App ko preview/iframe ke bahar direct tab me kholkar phir try karein.",
    });
  };

  const canShare = (() => {
    if (!helper || typeof navigator === "undefined" || !navigator.canShare) return false;
    try {
      return navigator.canShare({ files: [new File([helper.blob], helper.name, { type: helper.blob.type })] });
    } catch {
      return false;
    }
  })();

  const shareFile = async () => {
    if (!helper) return;
    try {
      await navigator.share({
        files: [new File([helper.blob], helper.name, { type: helper.blob.type })],
        title: helper.name,
      });
    } catch {
      /* cancelled */
    }
  };

  const openPreview = () => {
    if (!helper) return;
    setShowPreview(true);
    if (!dataUrl) {
      const r = new FileReader();
      r.onload = () => setDataUrl(r.result as string);
      r.readAsDataURL(helper.blob);
    }
  };

  useEffect(() => {
    detectSupport().then(setSupport);
  }, []);

  const selected = items.find((i) => i.id === selectedId) ?? items[0];

  /* ---- settings (invalidates old results) ---- */
  const patch = useCallback((p: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...p }));
    setItems((prev) =>
      prev.map((i) => {
        if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
        return i.status === "idle"
          ? i
          : { ...i, status: "idle", blob: undefined, resultUrl: undefined, outW: undefined, outH: undefined, error: undefined };
      })
    );
  }, []);

  /* ---- add files ---- */
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    const bad: string[] = [];
    const added: Item[] = [];
    for (const file of list) {
      try {
        const l = await loadImageFile(file);
        added.push({ id: uid(), file, url: l.url, img: l.img, w: l.w, h: l.h, status: "idle" });
      } catch {
        bad.push(file.name);
      }
    }
    if (added.length) {
      setItems((p) => [...p, ...added]);
      setSelectedId((cur) => cur ?? added[0].id);
    }
    if (bad.length) {
      setErrors((e) => [
        ...e,
        ...bad.map((n) => `"${n}" could not be opened (format not supported by your browser).`),
      ]);
    }
  }, []);

  const removeItem = (id: string) => {
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) {
        URL.revokeObjectURL(it.url);
        if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
  };

  const clearAll = () => {
    items.forEach((it) => {
      URL.revokeObjectURL(it.url);
      if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
    });
    setItems([]);
    setSelectedId(null);
  };

  /* ---- paste support ---- */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  /* ---- live preview ---- */
  useEffect(() => {
    if (!selected) return;
    const t = setTimeout(() => {
      try {
        const c = renderImage(selected.img, selected.w, selected.h, settings, 900);
        const cv = previewRef.current;
        if (cv) {
          cv.width = c.width;
          cv.height = c.height;
          cv.getContext("2d")!.drawImage(c, 0, 0);
        }
      } catch {
        /* ignore */
      }
    }, 90);
    return () => clearTimeout(t);
  }, [selected?.id, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const outDims = useMemo(
    () => (selected ? finalSize(selected.w, selected.h, settings) : null),
    [selected, settings]
  );

  /* ---- convert ---- */
  const convertAll = async () => {
    if (!items.length || busy) return;
    setBusy(true);
    const snapshot = settings;
    const fmt = getFormat(snapshot.format);
    for (const it of itemsRef.current) {
      setItems((p) => p.map((x) => (x.id === it.id ? { ...x, status: "working" } : x)));
      await new Promise((r) => setTimeout(r, 30));
      try {
        const canvas = renderImage(it.img, it.w, it.h, snapshot);
        const blob = await encodeCanvas(canvas, snapshot);
        const resultUrl = URL.createObjectURL(new Blob([blob], { type: fmt.mime }));
        setItems((p) =>
          p.map((x) =>
            x.id === it.id
              ? { ...x, status: "done", blob, resultUrl, outW: canvas.width, outH: canvas.height, error: undefined }
              : x
          )
        );
      } catch (e) {
        setItems((p) =>
          p.map((x) =>
            x.id === it.id ? { ...x, status: "error", error: e instanceof Error ? e.message : "Failed" } : x
          )
        );
      }
    }
    setBusy(false);
  };

  const outName = (it: Item) => `${baseName(it.file.name)}.${getFormat(settings.format).ext}`;

  const downloadZip = async () => {
    const done = items.filter((i) => i.blob);
    if (!done.length) return;
    setZipping(true);
    const zip = new JSZip();
    const used = new Set<string>();
    for (const it of done) {
      let name = outName(it);
      let n = 1;
      while (used.has(name)) name = `${baseName(it.file.name)}-${n++}.${getFormat(settings.format).ext}`;
      used.add(name);
      zip.file(name, it.blob!);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    startDownload(url, "mindkosh-images.zip", blob);
    setZipping(false);
  };

  const doneCount = items.filter((i) => i.status === "done").length;
  const totalIn = items.reduce((a, i) => a + i.file.size, 0);
  const totalOut = items.reduce((a, i) => a + (i.blob?.size ?? 0), 0);
  const fmtInfo = getFormat(settings.format);
  const enhanceActive =
    settings.autoEnhance ||
    settings.brightness ||
    settings.contrast ||
    settings.saturation ||
    settings.warmth ||
    settings.sharpness ||
    settings.filter !== "none";

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50 text-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-indigo-200">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight">MindKosh Pixora</h1>
              <p className="text-xs text-slate-500">Convert • Resize • Enhance any image</p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
            <Shield className="h-3.5 w-3.5" /> 100% private – files never leave your device
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[1fr_380px]">
        {/* LEFT */}
        <div className="min-w-0 space-y-5">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed text-center transition ${
              dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white/80 hover:border-indigo-400 hover:bg-indigo-50/50"
            } ${items.length ? "p-4" : "p-12"}`}
          >
            <input
              ref={fileInput}
              type="file"
              accept="image/*,.ico,.bmp,.avif,.svg,.gif,.webp,.jfif,.tif,.tiff,.heic"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {items.length ? (
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-indigo-700">
                <Plus className="h-4 w-4" /> Add more images (or drop / paste them)
              </div>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-semibold">Drop your images here</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  Click to browse, drag &amp; drop, or paste (Ctrl+V). JPG, PNG, WEBP, GIF, BMP, AVIF, SVG, ICO – multiple files at once.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {FORMATS.map((f) => (
                    <span key={f.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {f.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {errors.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="mb-1 flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Some files were skipped
                </span>
                <button onClick={() => setErrors([])}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              {errors.map((e, i) => (
                <div key={i} className="text-xs">
                  {e}
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {selected && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="h-4 w-4 text-indigo-600" /> Live preview
                  <span className="max-w-[200px] truncate font-normal text-slate-500">{selected.file.name}</span>
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-mono">
                    {selected.w}×{selected.h}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span className="rounded-md bg-indigo-100 px-2 py-1 font-mono font-semibold text-indigo-700">
                    {outDims?.[0]}×{outDims?.[1]} {fmtInfo.label}
                  </span>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Original</div>
                  <div className="flex h-72 items-center justify-center overflow-hidden rounded-xl" style={checker}>
                    <img src={selected.url} alt="original" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{formatBytes(selected.file.size)}</div>
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-indigo-500">
                    <Sparkles className="h-3 w-3" /> Result
                  </div>
                  <div className="flex h-72 items-center justify-center overflow-hidden rounded-xl" style={checker}>
                    <canvas ref={previewRef} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {selected.blob ? `Converted size: ${formatBytes(selected.blob.size)}` : "Preview (reduced for speed – export is full quality)"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* File list */}
          {items.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold">
                  Images <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{items.length}</span>
                </h3>
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear all
                </button>
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map((it) => (
                  <li
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition ${
                      selected?.id === it.id ? "bg-indigo-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg" style={checker}>
                      <img src={it.url} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{it.file.name}</div>
                      <div className="text-xs text-slate-500">
                        {it.w}×{it.h} • {formatBytes(it.file.size)}
                        {it.status === "done" && it.blob && (
                          <span className="text-emerald-600">
                            {" "}
                            → {it.outW}×{it.outH} • {formatBytes(it.blob.size)}
                          </span>
                        )}
                        {it.status === "error" && <span className="text-red-500"> • {it.error}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {it.status === "working" && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
                      {it.status === "done" && it.resultUrl && (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startDownload(it.resultUrl!, outName(it), it.blob!);
                            }}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            <Download className="h-3.5 w-3.5" /> {fmtInfo.label}
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(it.id);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT – settings */}
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50 p-1.5 text-sm font-medium">
              {(
                [
                  ["format", "Convert", RefreshCw],
                  ["resize", "Resize", ImageIcon],
                  ["enhance", "Enhance", Sparkles],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                    tab === id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                  {id === "enhance" && enhanceActive ? <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> : null}
                </button>
              ))}
            </div>

            <div className="max-h-[58vh] space-y-5 overflow-y-auto p-4">
              {tab === "format" && (
                <>
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Convert to</div>
                    <div className="grid grid-cols-3 gap-2">
                      {FORMATS.map((f) => {
                        const ok = support ? support[f.id] : true;
                        return (
                          <button
                            key={f.id}
                            disabled={!ok}
                            onClick={() => patch({ format: f.id })}
                            className={`rounded-xl border py-2.5 text-sm font-bold transition ${
                              settings.format === f.id
                                ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                            } ${!ok ? "cursor-not-allowed opacity-40" : ""}`}
                            title={ok ? f.note : "Not supported in this browser"}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{fmtInfo.note}</p>
                  </div>

                  {fmtInfo.lossy && (
                    <Slider
                      label="Quality"
                      value={settings.quality}
                      min={1}
                      max={100}
                      suffix="%"
                      onChange={(v) => patch({ quality: v })}
                    />
                  )}

                  {fmtInfo.opaque && (
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                      <div>
                        <div className="text-sm font-medium">Background color</div>
                        <div className="text-xs text-slate-500">Used for transparent areas</div>
                      </div>
                      <input
                        type="color"
                        value={settings.bg}
                        onChange={(e) => patch({ bg: e.target.value })}
                        className="h-9 w-12 cursor-pointer rounded border border-slate-200"
                      />
                    </div>
                  )}
                </>
              )}

              {tab === "resize" && (
                <>
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-medium">
                    {(
                      [
                        ["original", "Original"],
                        ["percent", "Percentage"],
                        ["custom", "Custom px"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => patch({ resizeMode: id })}
                        className={`rounded-lg py-1.5 ${
                          settings.resizeMode === id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {settings.resizeMode === "percent" && (
                    <>
                      <Slider
                        label="Scale"
                        value={settings.percent}
                        min={5}
                        max={400}
                        suffix="%"
                        onChange={(v) => patch({ percent: v })}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {[25, 50, 75, 100, 150, 200, 300].map((p) => (
                          <Chip key={p} active={settings.percent === p} onClick={() => patch({ percent: p })}>
                            {p}%
                          </Chip>
                        ))}
                      </div>
                    </>
                  )}

                  {settings.resizeMode === "custom" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs font-medium text-slate-600">
                          Width (px)
                          <input
                            type="number"
                            min={1}
                            value={settings.width}
                            placeholder="auto"
                            onChange={(e) => patch({ width: e.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Height (px)
                          <input
                            type="number"
                            min={1}
                            value={settings.height}
                            placeholder="auto"
                            onChange={(e) => patch({ height: e.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                        </label>
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={settings.keepRatio}
                          onChange={(e) => patch({ keepRatio: e.target.checked })}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        Keep aspect ratio (fit inside box)
                      </label>
                      <div>
                        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Presets</div>
                        <div className="flex flex-wrap gap-1.5">
                          {SIZE_PRESETS.map((p) => (
                            <Chip
                              key={p.label}
                              active={settings.width === p.w && settings.height === p.h}
                              onClick={() => patch({ width: p.w, height: p.h })}
                            >
                              {p.label}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {outDims && selected && (
                    <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-800">
                      Output size for selected image:{" "}
                      <b>
                        {outDims[0]} × {outDims[1]} px
                      </b>
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Rotate &amp; flip</div>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => patch({ rotate: ((settings.rotate + 270) % 360) as Settings["rotate"] })}
                        className="flex items-center justify-center rounded-lg border border-slate-200 py-2 hover:bg-indigo-50"
                        title="Rotate left"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => patch({ rotate: ((settings.rotate + 90) % 360) as Settings["rotate"] })}
                        className="flex items-center justify-center rounded-lg border border-slate-200 py-2 hover:bg-indigo-50"
                        title="Rotate right"
                      >
                        <RotateCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => patch({ flipH: !settings.flipH })}
                        className={`flex items-center justify-center rounded-lg border py-2 ${
                          settings.flipH ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 hover:bg-indigo-50"
                        }`}
                        title="Flip horizontal"
                      >
                        <FlipHorizontal className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => patch({ flipV: !settings.flipV })}
                        className={`flex items-center justify-center rounded-lg border py-2 ${
                          settings.flipV ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 hover:bg-indigo-50"
                        }`}
                        title="Flip vertical"
                      >
                        <FlipVertical className="h-4 w-4" />
                      </button>
                    </div>
                    {settings.rotate !== 0 && (
                      <div className="mt-1.5 text-xs text-slate-500">Rotation: {settings.rotate}°</div>
                    )}
                  </div>
                </>
              )}

              {tab === "enhance" && (
                <>
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Quick presets</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {ENHANCE_PRESETS.map((p) => (
                        <button
                          key={p.name}
                          onClick={() => patch({ ...ENHANCE_DEFAULTS, ...p.v })}
                          className="rounded-lg border border-slate-200 bg-white px-1 py-2 text-center transition hover:border-indigo-300 hover:bg-indigo-50"
                        >
                          <div className="text-lg leading-none">{p.emoji}</div>
                          <div className="mt-1 text-[11px] font-medium text-slate-600">{p.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-indigo-800">
                        <Sparkles className="h-4 w-4" /> Auto enhance
                      </div>
                      <div className="text-xs text-indigo-700/70">Fixes levels, color &amp; sharpness automatically</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoEnhance}
                      onChange={(e) => patch({ autoEnhance: e.target.checked })}
                      className="h-5 w-5 accent-indigo-600"
                    />
                  </label>

                  <Slider label="Brightness" value={settings.brightness} onChange={(v) => patch({ brightness: v })} />
                  <Slider label="Contrast" value={settings.contrast} onChange={(v) => patch({ contrast: v })} />
                  <Slider label="Saturation" value={settings.saturation} onChange={(v) => patch({ saturation: v })} />
                  <Slider label="Warmth (cool ↔ warm)" value={settings.warmth} onChange={(v) => patch({ warmth: v })} />
                  <Slider
                    label="Sharpness"
                    value={settings.sharpness}
                    min={0}
                    max={100}
                    onChange={(v) => patch({ sharpness: v })}
                  />

                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Filter</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(["none", "grayscale", "sepia", "invert"] as FilterName[]).map((f) => (
                        <Chip key={f} active={settings.filter === f} onClick={() => patch({ filter: f })}>
                          {f === "none" ? "None" : f[0].toUpperCase() + f.slice(1)}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => patch({ ...ENHANCE_DEFAULTS })}
                    className="w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Reset enhancements
                  </button>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 border-t border-slate-100 bg-slate-50 p-4">
              {items.length > 0 && doneCount > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {doneCount}/{items.length} done
                  </span>
                  <span>
                    {formatBytes(totalIn)} → <b className="text-slate-700">{formatBytes(totalOut)}</b>
                  </span>
                </div>
              )}
              <button
                onClick={convertAll}
                disabled={!items.length || busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Converting…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Convert {items.length > 1 ? `${items.length} images` : "image"} to {fmtInfo.label}
                  </>
                )}
              </button>
              {doneCount > 0 && (
                <button
                  onClick={downloadZip}
                  disabled={zipping}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                  Download all as ZIP
                </button>
              )}
              {doneCount === 1 && items.length === 1 && items[0].resultUrl && (
                <button
                  onClick={() => startDownload(items[0].resultUrl!, outName(items[0]), items[0].blob!)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Download className="h-4 w-4" /> Download {fmtInfo.label}
                </button>
              )}
            </div>
          </div>
        </aside>
      </main>

      {helper && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Download className="h-4 w-4 text-emerald-600" /> File save nahi hui?
              </div>
              <div className="truncate text-xs text-slate-500">
                {helper.name} • {formatBytes(helper.blob.size)}
              </div>
              <div className="mt-1 text-xs text-amber-700">{helper.message}</div>
            </div>
            <button
              onClick={() => {
                setHelper(null);
                setShowPreview(false);
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-medium">
            <button
              onClick={() => startDownload(helper.url, helper.name, helper.blob)}
              className="rounded-lg bg-emerald-600 py-2 text-white hover:bg-emerald-700"
            >
              Save As dobara try karein
            </button>
            {canShare && (
              <button onClick={shareFile} className="rounded-lg border border-slate-200 py-2 hover:bg-slate-50">
                Share / Save
              </button>
            )}
            {helper.blob.type.startsWith("image/") && (
              <button onClick={openPreview} className="rounded-lg border border-slate-200 py-2 hover:bg-slate-50">
                Preview &amp; save
              </button>
            )}
          </div>
        </div>
      )}

      {helper && showPreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="max-h-full w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Image par right-click karo → "Save image as…" (mobile: long-press → Save)</div>
              <button onClick={() => setShowPreview(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center rounded-xl p-2" style={checker}>
              {dataUrl ? (
                <img src={dataUrl} alt={helper.name} className="max-h-[70vh] max-w-full object-contain" />
              ) : (
                <Loader2 className="my-10 h-6 w-6 animate-spin text-indigo-600" />
              )}
            </div>
            {dataUrl && (
              <a
                href={dataUrl}
                download={helper.name}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block rounded-lg bg-emerald-600 py-2 text-center text-sm font-medium text-white hover:bg-emerald-700"
              >
                Download link ({helper.name})
              </a>
            )}
          </div>
        </div>
      )}

      <footer className="pb-8 pt-2 text-center text-xs text-slate-400">
        MindKosh Pixora • Everything runs locally in your browser
      </footer>
    </div>
  );
}
