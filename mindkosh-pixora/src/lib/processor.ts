import { GIFEncoder, quantize, applyPalette } from "gifenc";

export type Format =
  | "png"
  | "jpeg"
  | "webp"
  | "avif"
  | "gif"
  | "bmp"
  | "ico"
  | "svg"
  | "pdf";

export interface FormatInfo {
  id: Format;
  label: string;
  ext: string;
  mime: string;
  lossy: boolean;
  opaque: boolean;
  note?: string;
}

export const FORMATS: FormatInfo[] = [
  { id: "png", label: "PNG", ext: "png", mime: "image/png", lossy: false, opaque: false, note: "Lossless, supports transparency." },
  { id: "jpeg", label: "JPG", ext: "jpg", mime: "image/jpeg", lossy: true, opaque: true, note: "Small size, best for photos." },
  { id: "webp", label: "WEBP", ext: "webp", mime: "image/webp", lossy: true, opaque: false, note: "Modern web format, tiny files." },
  { id: "avif", label: "AVIF", ext: "avif", mime: "image/avif", lossy: true, opaque: false, note: "Next-gen, smallest files (browser support needed)." },
  { id: "gif", label: "GIF", ext: "gif", mime: "image/gif", lossy: false, opaque: false, note: "256 colors, first frame only." },
  { id: "bmp", label: "BMP", ext: "bmp", mime: "image/bmp", lossy: false, opaque: true, note: "Uncompressed bitmap." },
  { id: "ico", label: "ICO", ext: "ico", mime: "image/x-icon", lossy: false, opaque: false, note: "Icon file, auto-fit to max 256px." },
  { id: "svg", label: "SVG", ext: "svg", mime: "image/svg+xml", lossy: false, opaque: false, note: "Raster image wrapped inside SVG." },
  { id: "pdf", label: "PDF", ext: "pdf", mime: "application/pdf", lossy: true, opaque: true, note: "One image per PDF page." },
];

export const getFormat = (id: Format) => FORMATS.find((f) => f.id === id)!;

export type FilterName = "none" | "grayscale" | "sepia" | "invert";

export interface Settings {
  format: Format;
  quality: number; // 1-100
  bg: string;
  resizeMode: "original" | "percent" | "custom";
  percent: number;
  width: string;
  height: string;
  keepRatio: boolean;
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sharpness: number;
  filter: FilterName;
  autoEnhance: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  format: "png",
  quality: 90,
  bg: "#ffffff",
  resizeMode: "original",
  percent: 100,
  width: "",
  height: "",
  keepRatio: true,
  rotate: 0,
  flipH: false,
  flipV: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  sharpness: 0,
  filter: "none",
  autoEnhance: false,
};

export const ENHANCE_DEFAULTS = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  sharpness: 0,
  filter: "none" as FilterName,
  autoEnhance: false,
};

const MAX_SIDE = 12000;

export function finalSize(nw: number, nh: number, s: Settings): [number, number] {
  const swap = s.rotate === 90 || s.rotate === 270;
  const rw = swap ? nh : nw;
  const rh = swap ? nw : nh;
  let tw = rw;
  let th = rh;
  if (s.resizeMode === "percent") {
    tw = rw * (s.percent / 100);
    th = rh * (s.percent / 100);
  } else if (s.resizeMode === "custom") {
    const w = Number(s.width) || 0;
    const h = Number(s.height) || 0;
    if (w || h) {
      if (s.keepRatio) {
        const k = w && h ? Math.min(w / rw, h / rh) : w ? w / rw : h / rh;
        tw = rw * k;
        th = rh * k;
      } else {
        tw = w || rw;
        th = h || rh;
      }
    }
  }
  tw = Math.max(1, Math.round(tw));
  th = Math.max(1, Math.round(th));
  const over = Math.max(tw, th) / MAX_SIDE;
  if (over > 1) {
    tw = Math.max(1, Math.round(tw / over));
    th = Math.max(1, Math.round(th / over));
  }
  return [tw, th];
}

export function hasAdjustments(s: Settings) {
  return (
    s.autoEnhance ||
    s.brightness !== 0 ||
    s.contrast !== 0 ||
    s.saturation !== 0 ||
    s.warmth !== 0 ||
    s.sharpness !== 0 ||
    s.filter !== "none"
  );
}

function applyAdjustments(ctx: CanvasRenderingContext2D, w: number, h: number, s: Settings) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const n = w * h;

  // Auto enhance: histogram stretch on luminance
  let lo = 0;
  let scale = 1;
  if (s.autoEnhance) {
    const hist = new Uint32Array(256);
    const step = Math.max(1, Math.floor(n / 200000));
    let count = 0;
    for (let p = 0; p < n; p += step) {
      const i = p * 4;
      if (d[i + 3] === 0) continue;
      hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
      count++;
    }
    if (count > 0) {
      let acc = 0;
      let hi = 255;
      let foundLo = false;
      for (let v = 0; v < 256; v++) {
        acc += hist[v];
        if (!foundLo && acc >= count * 0.005) {
          lo = v;
          foundLo = true;
        }
        if (acc >= count * 0.995) {
          hi = v;
          break;
        }
      }
      if (hi - lo > 10) scale = 255 / (hi - lo);
      else lo = 0;
    }
  }

  const sat = 1 + (s.saturation + (s.autoEnhance ? 15 : 0)) / 100;
  const bri = s.brightness * 2.55;
  const c = s.contrast * 2.55;
  const cf = (259 * (c + 255)) / (255 * (259 - c));
  const warm = s.warmth * 0.5;
  const filter = s.filter;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    if (scale !== 1) {
      r = (r - lo) * scale;
      g = (g - lo) * scale;
      b = (b - lo) * scale;
    }
    if (sat !== 1) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * sat;
      g = gray + (g - gray) * sat;
      b = gray + (b - gray) * sat;
    }
    if (warm !== 0) {
      r += warm;
      b -= warm;
    }
    if (bri !== 0) {
      r += bri;
      g += bri;
      b += bri;
    }
    if (c !== 0) {
      r = cf * (r - 128) + 128;
      g = cf * (g - 128) + 128;
      b = cf * (b - 128) + 128;
    }
    if (filter === "grayscale") {
      const gr = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = gr;
    } else if (filter === "sepia") {
      const nr = 0.393 * r + 0.769 * g + 0.189 * b;
      const ng = 0.349 * r + 0.686 * g + 0.168 * b;
      const nb = 0.272 * r + 0.534 * g + 0.131 * b;
      r = nr;
      g = ng;
      b = nb;
    } else if (filter === "invert") {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }

  const sharp = s.sharpness + (s.autoEnhance ? 20 : 0);
  if (sharp > 0 && w > 2 && h > 2) {
    const a = (Math.min(sharp, 100) / 100) * 1.2;
    const src = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
      const yu = Math.max(y - 1, 0) * w;
      const yd = Math.min(y + 1, h - 1) * w;
      const yc = y * w;
      for (let x = 0; x < w; x++) {
        const xl = Math.max(x - 1, 0);
        const xr = Math.min(x + 1, w - 1);
        const i = (yc + x) * 4;
        const iu = (yu + x) * 4;
        const id = (yd + x) * 4;
        const il = (yc + xl) * 4;
        const ir = (yc + xr) * 4;
        for (let k = 0; k < 3; k++) {
          d[i + k] = src[i + k] * (1 + 4 * a) - a * (src[iu + k] + src[id + k] + src[il + k] + src[ir + k]);
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export function renderImage(
  img: HTMLImageElement,
  nw: number,
  nh: number,
  s: Settings,
  previewMax?: number
): HTMLCanvasElement {
  let [tw, th] = finalSize(nw, nh, s);
  if (previewMax) {
    const k = Math.min(1, previewMax / Math.max(tw, th));
    tw = Math.max(1, Math.round(tw * k));
    th = Math.max(1, Math.round(th * k));
  }
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  if (getFormat(s.format).opaque) {
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, tw, th);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const swap = s.rotate === 90 || s.rotate === 270;
  const dw = swap ? th : tw;
  const dh = swap ? tw : th;
  ctx.save();
  ctx.translate(tw / 2, th / 2);
  ctx.rotate((s.rotate * Math.PI) / 180);
  ctx.scale(s.flipH ? -1 : 1, s.flipV ? -1 : 1);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  if (hasAdjustments(s)) applyAdjustments(ctx, tw, th, s);
  return canvas;
}

/* ---------------- Encoding ---------------- */

function canvasBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encoding failed"))),
      mime,
      quality
    );
  });
}

export async function detectSupport(): Promise<Record<Format, boolean>> {
  const c = document.createElement("canvas");
  c.width = c.height = 2;
  const test = async (mime: string) => {
    try {
      const b = await canvasBlob(c, mime, 0.8);
      return b.type === mime;
    } catch {
      return false;
    }
  };
  const [webp, avif] = await Promise.all([test("image/webp"), test("image/avif")]);
  return {
    png: true,
    jpeg: true,
    webp,
    avif,
    gif: true,
    bmp: true,
    ico: true,
    svg: true,
    pdf: true,
  };
}

function toBmp(canvas: HTMLCanvasElement): Blob {
  const w = canvas.width;
  const h = canvas.height;
  const data = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const imgSize = rowSize * h;
  const buf = new ArrayBuffer(54 + imgSize);
  const v = new DataView(buf);
  v.setUint8(0, 0x42);
  v.setUint8(1, 0x4d);
  v.setUint32(2, 54 + imgSize, true);
  v.setUint32(10, 54, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, w, true);
  v.setInt32(22, h, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  v.setUint32(34, imgSize, true);
  v.setInt32(38, 2835, true);
  v.setInt32(42, 2835, true);
  const out = new Uint8Array(buf);
  for (let y = 0; y < h; y++) {
    const rowStart = 54 + (h - 1 - y) * rowSize;
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const a = data[si + 3] / 255;
      const di = rowStart + x * 3;
      // composite on white if any transparency remains
      out[di] = data[si + 2] * a + 255 * (1 - a);
      out[di + 1] = data[si + 1] * a + 255 * (1 - a);
      out[di + 2] = data[si] * a + 255 * (1 - a);
    }
  }
  return new Blob([buf], { type: "image/bmp" });
}

async function toIco(canvas: HTMLCanvasElement): Promise<Blob> {
  let c = canvas;
  const max = Math.max(canvas.width, canvas.height);
  if (max > 256) {
    const k = 256 / max;
    c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(canvas.width * k));
    c.height = Math.max(1, Math.round(canvas.height * k));
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
  }
  const png = new Uint8Array(await (await canvasBlob(c, "image/png")).arrayBuffer());
  const header = new ArrayBuffer(22);
  const v = new DataView(header);
  v.setUint16(0, 0, true);
  v.setUint16(2, 1, true);
  v.setUint16(4, 1, true);
  v.setUint8(6, c.width >= 256 ? 0 : c.width);
  v.setUint8(7, c.height >= 256 ? 0 : c.height);
  v.setUint8(8, 0);
  v.setUint8(9, 0);
  v.setUint16(10, 1, true);
  v.setUint16(12, 32, true);
  v.setUint32(14, png.length, true);
  v.setUint32(18, 22, true);
  return new Blob([header, png as unknown as BlobPart], { type: "image/x-icon" });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function toSvg(canvas: HTMLCanvasElement): Promise<Blob> {
  const url = await blobToDataUrl(await canvasBlob(canvas, "image/png"));
  const { width: w, height: h } = canvas;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n<image width="${w}" height="${h}" xlink:href="${url}" href="${url}"/>\n</svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

function toGif(canvas: HTMLCanvasElement): Blob {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
  const palette = quantize(data, 256, { format: "rgba4444", oneBitAlpha: true });
  const index = applyPalette(data, palette, "rgba4444");
  let transparentIndex = -1;
  for (let i = 0; i < palette.length; i++) {
    if (palette[i].length > 3 && palette[i][3] === 0) {
      transparentIndex = i;
      break;
    }
  }
  const gif = GIFEncoder();
  gif.writeFrame(index, w, h, {
    palette,
    transparent: transparentIndex >= 0,
    transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
  });
  gif.finish();
  return new Blob([gif.bytes() as unknown as BlobPart], { type: "image/gif" });
}

async function toPdf(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const jpg = new Uint8Array(
    await (await canvasBlob(canvas, "image/jpeg", quality / 100)).arrayBuffer()
  );
  const w = canvas.width;
  const h = canvas.height;
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (d: Uint8Array | string) => {
    const b = typeof d === "string" ? enc.encode(d) : d;
    parts.push(b);
    len += b.length;
  };
  push("%PDF-1.4\n");
  offsets[1] = len;
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offsets[2] = len;
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  offsets[3] = len;
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );
  offsets[4] = len;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`
  );
  push(jpg);
  push("\nendstream\nendobj\n");
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  offsets[5] = len;
  push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  const xref = len;
  let x = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) x += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  push(x);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as unknown as BlobPart[], { type: "application/pdf" });
}

export async function encodeCanvas(canvas: HTMLCanvasElement, s: Settings): Promise<Blob> {
  const q = s.quality / 100;
  switch (s.format) {
    case "png":
      return canvasBlob(canvas, "image/png");
    case "jpeg":
      return canvasBlob(canvas, "image/jpeg", q);
    case "webp":
    case "avif": {
      const mime = getFormat(s.format).mime;
      const b = await canvasBlob(canvas, mime, q);
      if (b.type !== mime) throw new Error(`${s.format.toUpperCase()} is not supported by this browser`);
      return b;
    }
    case "bmp":
      return toBmp(canvas);
    case "ico":
      return toIco(canvas);
    case "svg":
      return toSvg(canvas);
    case "gif":
      return toGif(canvas);
    case "pdf":
      return toPdf(canvas, s.quality);
  }
}

/* ---------------- Loading ---------------- */

export interface LoadedImage {
  img: HTMLImageElement;
  url: string;
  w: number;
  h: number;
}

export function loadImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (!w || !h) {
        w = 1024;
        h = 1024;
      }
      resolve({ img, url, w, h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unsupported"));
    };
    img.src = url;
  });
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
