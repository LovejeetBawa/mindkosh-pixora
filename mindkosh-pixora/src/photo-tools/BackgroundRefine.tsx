import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

type Props = { original: HTMLCanvasElement; result: HTMLCanvasElement; onApply: (canvas: HTMLCanvasElement) => Promise<void>; onClose: () => void };
export default function BackgroundRefine({ original, result, onApply, onClose }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'erase' | 'restore'>('erase');
  const [size, setSize] = useState(5);
  const [busy, setBusy] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [error, setError] = useState('');
  const history = useRef<Blob[]>([]);
  const drawing = useRef<{ pointer: number; x: number; y: number; mode: 'erase' | 'restore'; radius: number } | null>(null);
  useEffect(() => {
    const target = canvas.current!; target.width = result.width; target.height = result.height; target.getContext('2d')!.drawImage(result, 0, 0);
  }, [result]);
  useEffect(() => {
    const previous = document.body.style.overflow; const previousFocus = document.activeElement as HTMLElement | null; document.body.style.overflow = 'hidden'; dialog.current?.querySelector('button')?.focus();
    return () => { document.body.style.overflow = previous; previousFocus?.focus(); };
  }, []);
  const point = (event: PointerEvent<HTMLCanvasElement>) => { const bounds = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - bounds.left) * result.width / bounds.width, y: (event.clientY - bounds.top) * result.height / bounds.height }; };
  function paint(x: number, y: number) {
    const stroke = drawing.current; if (!stroke) return;
    const ctx = canvas.current!.getContext('2d')!;
    if (stroke.mode === 'erase') {
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = stroke.radius * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(stroke.x, stroke.y); ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, stroke.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else {
      const distance = Math.hypot(x - stroke.x, y - stroke.y); const steps = Math.max(1, Math.ceil(distance / Math.max(1, stroke.radius / 3)));
      ctx.save(); ctx.beginPath();
      for (let i = 0; i <= steps; i++) { const px = stroke.x + (x - stroke.x) * i / steps, py = stroke.y + (y - stroke.y) * i / steps; ctx.moveTo(px + stroke.radius, py); ctx.arc(px, py, stroke.radius, 0, Math.PI * 2); }
      ctx.clip(); ctx.drawImage(original, 0, 0); ctx.restore();
    }
    drawing.current = { ...stroke, x, y };
  }
  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (busy || drawing.current || event.button !== 0) return;
    event.preventDefault(); const p = point(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    const target = event.currentTarget;
    // toBlob snapshots the canvas before the stroke; compact PNG history avoids full pixel-buffer copies.
    target.toBlob(blob => { if (blob) { history.current.push(blob); while (history.current.length > 3 || history.current.length > 1 && history.current.reduce((n, b) => n + b.size, 0) > 32 * 1024 * 1024) history.current.shift(); setUndoCount(history.current.length); } });
    drawing.current = { pointer: event.pointerId, ...p, mode, radius: Math.min(result.width, result.height) * size / 200 }; paint(p.x, p.y);
  }
  function end(event: PointerEvent<HTMLCanvasElement>) { if (drawing.current?.pointer !== event.pointerId) return; drawing.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }
  async function undo() {
    if (drawing.current) return;
    const previous = history.current.pop(); if (!previous) return;
    setBusy(true); try { const image = await createImageBitmap(previous); const ctx = canvas.current!.getContext('2d')!; ctx.clearRect(0, 0, result.width, result.height); ctx.drawImage(image, 0, 0); image.close(); setUndoCount(history.current.length); } finally { setBusy(false); }
  }
  return <div ref={dialog} onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); } if (event.key === 'Tab') { const controls = Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')); const first = controls[0], last = controls[controls.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }} className="fixed inset-0 z-[100] overflow-auto bg-slate-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="refine-title"><div className="mx-auto max-w-3xl rounded-2xl bg-white p-4 sm:p-6"><h2 id="refine-title" className="text-xl font-bold">Refine background</h2><p className="mt-2 text-sm text-slate-600">Brush over unwanted people or leftover background to erase them. Restore repairs hair or clothing using your original photo. Mouse and finger both work.</p><div className="my-4 flex flex-wrap items-center gap-2"><button aria-pressed={mode === 'erase'} className={`rounded-lg border px-4 py-2 ${mode === 'erase' ? 'bg-indigo-600 text-white' : ''}`} onClick={() => setMode('erase')}>Erase</button><button aria-pressed={mode === 'restore'} className={`rounded-lg border px-4 py-2 ${mode === 'restore' ? 'bg-indigo-600 text-white' : ''}`} onClick={() => setMode('restore')}>Restore</button><button disabled={busy || !undoCount} onClick={() => void undo()} className="rounded-lg border px-4 py-2 disabled:opacity-50">Undo brush</button><button disabled={busy} onClick={() => { const ctx = canvas.current!.getContext('2d')!; ctx.clearRect(0, 0, result.width, result.height); ctx.drawImage(result, 0, 0); history.current = []; setUndoCount(0); }} className="rounded-lg border px-4 py-2">Reset edits</button></div><label className="mb-4 flex items-center gap-3 text-sm">Brush size<input aria-label="Brush size" type="range" min={1} max={30} value={size} onChange={e => setSize(Number(e.target.value))} className="min-w-0 flex-1 accent-indigo-600"/>{size}%</label><div className="mx-auto max-w-lg" style={{ maxWidth: `${Math.min(520, 560 * result.width / result.height)}px`, backgroundImage: 'repeating-conic-gradient(#cbd5e1 0% 25%, white 0% 50%)', backgroundSize: '20px 20px' }}><canvas ref={canvas} aria-label="Background refinement canvas" className="block w-full cursor-crosshair" style={{ touchAction: 'none' }} onPointerDown={start} onPointerMove={e => { if (drawing.current?.pointer === e.pointerId) { const p = point(e); paint(p.x, p.y); } }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}/></div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-3"><button disabled={busy} onClick={onClose} className="rounded-xl border px-4 py-3">Cancel</button><button disabled={busy} onClick={async () => { setBusy(true); try { await onApply(canvas.current!); } catch { setError('Could not save edits. Please retry.'); setBusy(false); } }} className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Apply cleanup'}</button></div></div></div>;
}
