import { useEffect, useRef, useState } from 'react';
import { Move } from 'lucide-react';
import type { PointerEvent } from 'react';
import { moveSelection, resizeSelection, selection, settings } from './selection';
import type { Corner, Rect } from './selection';

type Props = { image: HTMLImageElement; rotation: number; width: number; height: number; zoom: number; x: number; y: number; onChange: (settings: {zoom: number; x: number; y: number}) => void };
export default function CropSelection(props: Props) {
  const { image, rotation, width, height, zoom, x, y, onChange } = props;
  const rotated = rotation % 180 !== 0;
  const sourceW = rotated ? image.naturalHeight : image.naturalWidth;
  const sourceH = rotated ? image.naturalWidth : image.naturalHeight;
  const rect = selection(sourceW, sourceH, width / height, zoom, x, y);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; rect: Rect; x: number; y: number; scale: number; corner?: Corner } | null>(null);
  const [active, setActive] = useState(false);
  const [displayWidth, setDisplayWidth] = useState(300);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setDisplayWidth(entries[0].contentRect.width));
    observer.observe(stage.current!);
    return () => observer.disconnect();
  }, []);
  // Separate the touch handles when selecting a small face in a group photo.
  const handleX = 22 + Math.max(0, (44 - rect.width / sourceW * displayWidth) / 2);
  const handleY = 22 + Math.max(0, (44 - rect.height / sourceW * displayWidth) / 2);
  useEffect(() => {
    const target = canvas.current!;
    const scale = Math.min(1, 1000 / Math.max(sourceW, sourceH));
    target.width = Math.round(sourceW * scale); target.height = Math.round(sourceH * scale);
    const ctx = target.getContext('2d')!;
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, target.width, target.height);
    ctx.translate(target.width / 2, target.height / 2); ctx.scale(target.width / sourceW, target.height / sourceH);
    ctx.rotate(rotation * Math.PI / 180); ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  }, [image, rotation, sourceW, sourceH]);
  function begin(event: PointerEvent<HTMLElement>, corner?: Corner) {
    if (event.button !== 0 || drag.current) return;
    event.preventDefault(); event.stopPropagation();
    drag.current = { pointer: event.pointerId, rect, x: event.clientX, y: event.clientY, scale: sourceW / stage.current!.getBoundingClientRect().width, corner };
    stage.current!.setPointerCapture(event.pointerId); setActive(true);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const dx = (event.clientX - start.x) * start.scale, dy = (event.clientY - start.y) * start.scale;
    const next = start.corner ? resizeSelection(start.rect, start.corner, dx, dy, sourceW, sourceH) : moveSelection(start.rect, dx, dy, sourceW, sourceH);
    onChange(settings(next, sourceW, sourceH));
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null; setActive(false);
    if (stage.current!.hasPointerCapture(event.pointerId)) stage.current!.releasePointerCapture(event.pointerId);
  }
  return <div className="rounded-xl bg-slate-100 p-6">
    <div ref={stage} className="relative mx-auto select-none" style={{ aspectRatio: `${sourceW}/${sourceH}`, maxWidth: `${Math.min(500, 420 * sourceW / sourceH)}px`, touchAction: 'none' }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      <canvas ref={canvas} aria-label="Full photo for crop selection" className="block h-full w-full"/>
      <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute" style={{ left: `${rect.x / sourceW * 100}%`, top: `${rect.y / sourceH * 100}%`, width: `${rect.width / sourceW * 100}%`, height: `${rect.height / sourceH * 100}%`, boxShadow: '0 0 0 2000px rgb(0 0 0 / 45%)' }}/></div>
      <div role="group" aria-label="Crop selection" tabIndex={0} onPointerDown={event => begin(event)} onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const step = Math.min(sourceW, sourceH) / 100;
        const direction: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (direction[event.key]) { event.preventDefault(); const [dx, dy] = direction[event.key]; onChange(settings(moveSelection(rect, dx, dy, sourceW, sourceH), sourceW, sourceH)); }
      }} className={`absolute border-2 border-dashed border-white outline-indigo-500 ${active ? 'cursor-grabbing' : 'cursor-grab'}`} style={{ left: `${rect.x / sourceW * 100}%`, top: `${rect.y / sourceH * 100}%`, width: `${rect.width / sourceW * 100}%`, height: `${rect.height / sourceH * 100}%`, touchAction: 'none' }}>
        <button type="button" aria-label="Move crop box" tabIndex={-1} onPointerDown={event => begin(event)} className="absolute left-1/2 top-1/2 z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center rounded bg-indigo-600 text-white shadow" style={{ touchAction: 'none' }}><Move size={16}/></button>
        {(['nw', 'ne', 'sw', 'se'] as const).map(corner => <button key={corner} type="button" aria-label={`Resize crop ${ {nw:'top left',ne:'top right',sw:'bottom left',se:'bottom right'}[corner]}`} onPointerDown={event => begin(event, corner)} onKeyDown={event => {
          const directions: Record<string, [number, number]> = { ArrowLeft: [-5,0], ArrowRight: [5,0], ArrowUp: [0,-5], ArrowDown: [0,5] };
          if (directions[event.key]) { event.preventDefault(); event.stopPropagation(); const [dx,dy] = directions[event.key]; onChange(settings(resizeSelection(rect, corner, dx, dy, sourceW, sourceH), sourceW, sourceH)); }
        }} className={`absolute z-10 flex h-11 w-11 items-center justify-center ${corner === 'nw' || corner === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`} style={{ left: corner.endsWith('w') ? `${-handleX}px` : undefined, right: corner.endsWith('e') ? `${-handleX}px` : undefined, top: corner.startsWith('n') ? `${-handleY}px` : undefined, bottom: corner.startsWith('s') ? `${-handleY}px` : undefined, touchAction: 'none' }}><span className="h-4 w-4 border-2 border-white bg-indigo-600 shadow"/></button>)}
      </div>
    </div>
  </div>;
}
