import { useEffect, useMemo, useRef, useState } from 'react';
import CropSelection from './CropSelection';
import { Download, Plus, Trash2, Camera, ShieldCheck } from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { arrange, pixels, points } from './layout';

type Photo = { id: string; name: string; image: HTMLImageElement; url: string; width: number; height: number; copies: number; zoom: number; x: number; y: number; rotation: number; preset: number };
const presets = [
  { name: '2 × 2 inch — 50.8 × 50.8 mm', width: 50.8, height: 50.8 },
  { name: '35 × 45 mm', width: 35, height: 45 },
  { name: '35 × 35 mm', width: 35, height: 35 },
  { name: '30 × 40 mm', width: 30, height: 40 },
  { name: '50 × 70 mm — Canada passport size', width: 50, height: 70 },
  { name: '51 × 51 mm', width: 51, height: 51 },
  { name: '33 × 48 mm', width: 33, height: 48 },
  { name: 'Custom size', width: 0, height: 0 },
];
const papers = [ { name: '4 × 6 inch', width: 101.6, height: 152.4 }, { name: 'A4', width: 210, height: 297 }, { name: '5 × 7 inch', width: 127, height: 177.8 }, { name: 'Letter', width: 215.9, height: 279.4 } ];
const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900';
const action = 'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50 hover:bg-indigo-700';

function crop(photo: Photo, preview = false) {
  const rotated = photo.rotation % 180 !== 0;
  const sourceWidth = rotated ? photo.image.naturalHeight : photo.image.naturalWidth;
  const sourceHeight = rotated ? photo.image.naturalWidth : photo.image.naturalHeight;
  const ratio = photo.width / photo.height;
  const w = Math.min(sourceWidth, sourceHeight * ratio) / photo.zoom;
  const h = w / ratio;
  const canvas = document.createElement('canvas');
  canvas.width = preview ? 320 : pixels(photo.width);
  canvas.height = preview ? Math.round(320 / ratio) : pixels(photo.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  // Transform directly into the output canvas without allocating a full-size rotated copy.
  ctx.scale(canvas.width / w, canvas.height / h);
  ctx.translate(-(sourceWidth - w) * photo.x / 100, -(sourceHeight - h) * photo.y / 100);
  ctx.translate(sourceWidth / 2, sourceHeight / 2);
  ctx.rotate(photo.rotation * Math.PI / 180);
  ctx.drawImage(photo.image, -photo.image.naturalWidth / 2, -photo.image.naturalHeight / 2);
  return { canvas, sourceWidth: w, sourceHeight: h };
}
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function canvasBlob(canvas: HTMLCanvasElement) { return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Unable to export image.')), 'image/jpeg', 0.95)); }

export default function PassportPhoto() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState('');
  const [defaultPreset, setDefaultPreset] = useState(0);
  const [paperIndex, setPaperIndex] = useState(0);
  const [landscape, setLandscape] = useState(false);
  const [margin, setMargin] = useState(5);
  const [gap, setGap] = useState(2);
  const [guides, setGuides] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const urls = useRef(new Set<string>());
  const preview = useRef<HTMLCanvasElement>(null);
  const photo = photos.find(p => p.id === selected);
  const paper = papers[paperIndex];
  const paperWidth = landscape ? paper.height : paper.width, paperHeight = landscape ? paper.width : paper.height;
  let layout: ReturnType<typeof arrange> = [], layoutError = '';
  try { layout = arrange(photos, paperWidth, paperHeight, margin, gap); } catch (e) { layoutError = (e as Error).message; }
  const valid = !!photo && Number.isFinite(photo.width) && Number.isFinite(photo.height) && photo.width >= 10 && photo.height >= 10 && photo.width <= 150 && photo.height <= 150;
  useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    if (!photo || !valid || !preview.current) return;
    const { canvas } = crop(photo, true); const target = preview.current;
    target.width = canvas.width; target.height = canvas.height; target.getContext('2d')!.drawImage(canvas, 0, 0);
  }, [photo, valid]);
  const patch = (update: Partial<Photo>) => setPhotos(list => list.map(p => p.id === selected ? { ...p, ...update } : p));
  async function addFiles(files: FileList | null) {
    if (!files) return;
    setLoading(true); setError(''); setNotice('');
    const added: Photo[] = [], failures: string[] = [];
    const available = Math.max(0, 20 - photos.length);
    if (files.length > available) failures.push('Maximum 20 photos per collection. Extra files were skipped.');
    for (const file of Array.from(files).slice(0, available)) {
      if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) { failures.push(`${file.name}: choose a supported image under 25 MB.`); continue; }
      const url = URL.createObjectURL(file); urls.current.add(url);
      try {
        const image = new Image(); image.src = url; await image.decode();
        if (image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Image exceeds 40 megapixels. Resize it first.');
        const size = presets[defaultPreset];
        added.push({ id: crypto.randomUUID(), name: file.name, image, url, width: size.width || 35, height: size.height || 45, copies: 4, zoom: 1, x: 50, y: 50, rotation: 0, preset: defaultPreset });
      } catch { failures.push(`${file.name}: could not open image. Try JPG, PNG or WebP under 40 megapixels.`); URL.revokeObjectURL(url); urls.current.delete(url); }
    }
    setPhotos(list => [...list, ...added]); if (added.length) setSelected(added[0].id);
    setError(failures.join(' ')); setLoading(false);
  }
  async function exportFiles(kind: 'pdf' | 'jpg' | 'photos' | 'single') {
    setBusy(true); setError(''); setNotice('');
    try {
      if (!photos.length) throw new Error('Upload at least one photo.');
      if ((kind === 'pdf' || kind === 'jpg') && layoutError) throw new Error(layoutError);
      if (kind === 'single') {
        if (!photo || !validPhoto(photo)) throw new Error('Choose valid photo dimensions.');
        download(await canvasBlob(crop(photo).canvas), `MindKosh-Photo-${photo.width}x${photo.height}mm.jpg`);
        setNotice('Photo downloaded. Check the application’s digital photo requirements before submitting.');
        return;
      }
      if (photos.some(p => !validPhoto(p))) throw new Error('Set each photo’s dimensions between 10 and 150 mm.');
      const canvases = photos.map(p => crop(p).canvas);
      if (kind === 'photos') {
        const zip = new JSZip();
        for (const [i, p] of photos.entries()) zip.file(`${i + 1}-${p.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')}-${p.width}x${p.height}mm.jpg`, await canvasBlob(canvases[i]));
        download(await zip.generateAsync({ type: 'blob' }), 'MindKosh-Passport-Photos.zip');
      } else if (kind === 'pdf') {
        const pdf = await PDFDocument.create();
        const images = await Promise.all(canvases.map(async c => pdf.embedJpg(await (await canvasBlob(c)).arrayBuffer())));
        for (const placements of layout) {
          const page = pdf.addPage([points(paperWidth), points(paperHeight)]);
          for (const item of placements) {
            const rect = { x: points(item.x), y: points(paperHeight - item.y - item.height), width: points(item.width), height: points(item.height) };
            page.drawImage(images[item.photo], rect);
            if (guides) page.drawRectangle({ ...rect, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.25 });
          }
        }
        download(new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' }), 'MindKosh-Passport-Sheets.pdf');
      } else {
        const zip = new JSZip();
        for (const [i, placements] of layout.entries()) {
          const sheet = document.createElement('canvas'); sheet.width = pixels(paperWidth); sheet.height = pixels(paperHeight);
          const ctx = sheet.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, sheet.width, sheet.height);
          for (const item of placements) {
            ctx.drawImage(canvases[item.photo], pixels(item.x), pixels(item.y), pixels(item.width), pixels(item.height));
            if (guides) { ctx.strokeStyle = '#b3b3b3'; ctx.lineWidth = 1; ctx.strokeRect(pixels(item.x), pixels(item.y), pixels(item.width), pixels(item.height)); }
          }
          const blob = await canvasBlob(sheet);
          if (layout.length === 1) download(blob, 'MindKosh-Passport-Sheet.jpg');
          else zip.file(`sheet-${i + 1}.jpg`, blob);
        }
        if (layout.length > 1) download(await zip.generateAsync({ type: 'blob' }), 'MindKosh-Passport-Sheets.zip');
      }
      setNotice('Download ready. Print the PDF at Actual size / 100%, with Fit to page turned off.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const thumbnails = useMemo(() => photos.map(p => validPhoto(p) ? crop(p, true).canvas.toDataURL('image/jpeg', 0.85) : ''), [photos]);
  const sourceWidth = photo ? (photo.rotation % 180 ? photo.image.naturalHeight : photo.image.naturalWidth) : 0;
  const sourceHeight = photo ? (photo.rotation % 180 ? photo.image.naturalWidth : photo.image.naturalHeight) : 0;
  const croppedWidth = photo && valid ? Math.min(sourceWidth, sourceHeight * photo.width / photo.height) / photo.zoom : 0;
  const lowResolution = photo && valid && (croppedWidth < pixels(photo.width) || croppedWidth * photo.height / photo.width < pixels(photo.height));
  return <main className="mx-auto max-w-7xl px-5 py-10">
    <div className="mb-8"><span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600"><Camera size={18}/> PHOTO & PRINT TOOLS</span><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Passport Photo Maker</h1><p className="mt-3 max-w-3xl text-slate-600">Crop passport, visa and application photos, collect different images and sizes, and arrange copies on ready-to-print sheets. Everything stays in your browser.</p></div>
    <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 text-sm text-indigo-950"><strong>Choose the size required by your application.</strong> 2 × 2 inch is a common US passport size; 35 × 45 mm is used for UK passports and many visa applications. For India or any other country, visa, exam or studio order, use Custom size and enter the dimensions on your form. Dimensions alone do not guarantee acceptance. Check the issuing authority’s current rules for background, head position, lighting and digital file requirements. This tool crops and resizes; it does not remove backgrounds or certify photos. <a href="https://travel.state.gov/content/travel/en/passports/how-apply/photos.html" target="_blank" rel="noreferrer" className="underline">US passport photo rules</a> · <a href="https://www.gov.uk/photos-for-passports" target="_blank" rel="noreferrer" className="underline">UK passport photo rules</a></div>
    <div className="grid min-w-0 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">1. Collect photos</h2>
        <label className="mt-4 block text-sm font-medium">Default size for new photos<select className={field} value={defaultPreset} onChange={e => setDefaultPreset(Number(e.target.value))}>{presets.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</select></label>
        <label className={`${action} mt-4 w-full cursor-pointer ${loading ? 'pointer-events-none opacity-50' : ''}`}><Plus size={18}/>{loading ? 'Opening photos…' : 'Add photos'}<input aria-label="Upload photos" type="file" accept="image/*" multiple className="sr-only" disabled={loading || busy} onChange={e => { void addFiles(e.target.files); e.target.value = ''; }}/></label>
        <p className="mt-2 text-xs text-slate-500">JPG, PNG, WebP and browser-supported images. Up to 20 photos; 25 MB / 40 megapixels each.</p>
        <div className="mt-5 space-y-2">{photos.map(p => <div key={p.id} className={`flex items-center gap-2 rounded-xl border p-2 ${selected === p.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}><button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSelected(p.id)}><img src={p.url} alt="" className="h-12 w-10 rounded object-cover"/><span className="min-w-0"><span className="block truncate text-sm font-semibold">{p.name}</span><span className="text-xs text-slate-500">{p.width} × {p.height} mm · {p.copies} copies</span></span></button><button aria-label={`Remove ${p.name}`} disabled={busy || loading} onClick={() => { URL.revokeObjectURL(p.url); urls.current.delete(p.url); const rest = photos.filter(q => q.id !== p.id); setPhotos(rest); if (selected === p.id) setSelected(rest[0]?.id || ''); }} className="rounded p-2 text-slate-500 hover:text-red-600"><Trash2 size={16}/></button></div>)}</div>
      </aside>
      <div className="min-w-0 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">2. Crop & size each photo</h2>{photo ? <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <div>{valid && <CropSelection key={photo.id} image={photo.image} rotation={photo.rotation} width={photo.width} height={photo.height} zoom={photo.zoom} x={photo.x} y={photo.y} onChange={patch}/>}<p className="mt-3 text-center text-xs text-slate-500">Move the dotted box onto a person. Drag a corner to resize it with your mouse or finger. The box keeps your selected photo proportions.</p><div className="mx-auto mt-4 max-w-32"><p className="mb-2 text-center text-xs font-semibold text-slate-600">Selected photo preview</p><canvas ref={preview} aria-label="Cropped photo preview" className={`w-full ${valid ? '' : 'invisible'}`}/></div>{lowResolution && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">This crop has fewer pixels than a 300 DPI print. Use a sharper, higher-resolution original.</p>}</div>
          <div className="space-y-4"><label className="block text-sm font-medium">Photo size<select aria-label="Photo size" className={field} value={photo.preset} onChange={e => { const index = Number(e.target.value); const p = presets[index]; patch(p.width ? { width: p.width, height: p.height, preset: index } : { preset: index }); }}>{presets.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3">{(['width', 'height'] as const).map(key => <label key={key} className="text-sm font-medium">{key === 'width' ? 'Width' : 'Height'} (mm)<input className={field} type="number" min={10} max={150} step={0.1} value={photo[key]} onChange={e => patch({ [key]: Number(e.target.value), preset: presets.length - 1 })}/></label>)}</div>
            <label className="block text-sm font-medium">Copies on sheet<input className={field} type="number" min={1} max={40} value={photo.copies} onChange={e => patch({ copies: Number(e.target.value) })}/></label>
            {([{ key: 'zoom', label: 'Zoom', min: 1, max: 12, step: 0.01 }, { key: 'x', label: 'Horizontal position', min: 0, max: 100, step: 1 }, { key: 'y', label: 'Vertical position', min: 0, max: 100, step: 1 }] as const).map(control => <label key={control.key} className="block text-sm font-medium">{control.label}<input aria-label={control.label} type="range" className="mt-2 block w-full accent-indigo-600" min={control.min} max={control.max} step={control.step} value={photo[control.key]} onChange={e => patch({ [control.key]: Number(e.target.value) })}/></label>)}
            <div className="flex flex-wrap gap-2"><button aria-label="Zoom in" className="rounded-lg border px-3 py-2 text-sm" disabled={photo.zoom >= 12} onClick={() => patch({ zoom: Math.min(12, photo.zoom + 0.25) })}>Zoom +</button><button aria-label="Zoom out" className="rounded-lg border px-3 py-2 text-sm" disabled={photo.zoom <= 1} onClick={() => patch({ zoom: Math.max(1, photo.zoom - 0.25) })}>Zoom −</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => patch({ rotation: (photo.rotation + 90) % 360 })}>Rotate 90°</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => patch({ zoom: 1, x: 50, y: 50, rotation: 0 })}>Reset crop</button></div>
            {valid && <><p className="text-xs text-slate-500">Export: {pixels(photo.width)} × {pixels(photo.height)} pixels at 300 DPI sizing.</p><button className={action} disabled={busy || loading} onClick={() => void exportFiles('single')}><Download size={17}/>Download this photo</button></>}
          </div>
        </div> : <p className="py-12 text-center text-slate-500">Add a photo to start. Select each photo to adjust its own size, crop and copies.</p>}</section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">3. Arrange & download</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Print paper<select className={field} value={paperIndex} onChange={e => setPaperIndex(Number(e.target.value))}>{papers.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</select></label><label className="text-sm font-medium">Margin (mm)<input className={field} type="number" min={0} max={15} value={margin} onChange={e => setMargin(Math.max(0, Math.min(15, Number(e.target.value))))}/></label><label className="text-sm font-medium">Spacing (mm)<input className={field} type="number" min={0} max={10} value={gap} onChange={e => setGap(Math.max(0, Math.min(10, Number(e.target.value))))}/></label></div><div className="my-4 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={landscape} onChange={e => setLandscape(e.target.checked)}/>Landscape paper</label><label className="flex items-center gap-2"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)}/>Cutting borders</label></div>
          {layoutError && <p role="alert" className="my-3 text-sm text-red-700">{layoutError}</p>}
          {photos.length > 0 && !layoutError && <><p className="mb-3 text-sm text-slate-600">{photos.reduce((sum, p) => sum + p.copies, 0)} photos · {layout.length} sheet{layout.length === 1 ? '' : 's'} · {paperWidth} × {paperHeight} mm</p><div className="flex max-h-[480px] gap-4 overflow-auto rounded-xl bg-slate-100 p-4">{layout.map((placements, i) => <div key={i} className="relative w-48 shrink-0 bg-white shadow" style={{ aspectRatio: `${paperWidth}/${paperHeight}` }} aria-label={`Sheet ${i + 1} preview`}>{placements.map((item, j) => <img key={j} src={thumbnails[item.photo]} alt={`Photo ${item.photo + 1}, copy ${j + 1}`} className={guides ? 'absolute border border-slate-300' : 'absolute'} style={{ left: `${item.x / paperWidth * 100}%`, top: `${item.y / paperHeight * 100}%`, width: `${item.width / paperWidth * 100}%`, height: `${item.height / paperHeight * 100}%` }}/>)}</div>)}</div></>}
          <div className="mt-5 flex flex-wrap gap-3">{([{ kind: 'pdf', label: 'Download print PDF' }, { kind: 'jpg', label: 'Download sheet JPG' }, { kind: 'photos', label: 'Download individual photos (ZIP)' }] as const).map(item => <button key={item.kind} className={action} disabled={!photos.length || (item.kind !== 'photos' && !!layoutError) || photos.some(p => !validPhoto(p)) || busy || loading} onClick={() => void exportFiles(item.kind)}><Download size={17}/>{busy ? 'Preparing…' : item.label}</button>)}</div><p className="mt-3 text-xs text-slate-500">For exact physical sizes, print the PDF at 100% / Actual size. Turn off Fit to page. JPGs are sized at 300 DPI; set the selected paper dimensions in your print software.</p>
        </section>
      </div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
    <p className="mt-6 flex items-center gap-2 text-sm text-slate-500"><ShieldCheck size={18}/>Private by design. No photo uploads to a server.</p>
  </main>;
}
function validPhoto(p: Photo) { return Number.isFinite(p.width) && Number.isFinite(p.height) && p.width >= 10 && p.height >= 10 && p.width <= 150 && p.height <= 150; }
