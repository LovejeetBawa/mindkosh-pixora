import { useEffect, useRef } from "react";
import { bounds, type Region } from "./cleanup";
import { inputStyle } from "../toolkits/ui";
export default function RegionPreview({
  source,
  region,
  onChange,
}: {
  source: HTMLCanvasElement;
  region: Region;
  onChange: (r: Region) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const c = canvas.current!;
    const scale = Math.min(1, 1000 / Math.max(source.width, source.height));
    c.width = Math.round(source.width * scale);
    c.height = Math.round(source.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(source, 0, 0, c.width, c.height);
    const r = bounds(region, c.width, c.height);
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.strokeRect(r.x, r.y, r.width, r.height);
  }, [source, region]);
  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const b = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - b.x) / b.width)),
      y: Math.max(0, Math.min(1, (e.clientY - b.y) / b.height)),
    };
  }
  return (
    <>
      <p className="mb-3 text-sm text-slate-600">
        Drag a rectangle with your mouse or finger over the watermark or edit
        area. Adjust its position and size below.
      </p>
      <canvas
        ref={canvas}
        aria-label="Document area selection"
        className="mx-auto block max-h-[65vh] max-w-full touch-none border bg-white"
        onPointerDown={(e) => {
          start.current = point(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const p = point(e),
            s = start.current;
          if (Math.abs(p.x - s.x) > 0.002 && Math.abs(p.y - s.y) > 0.002)
            onChange({
              x: Math.min(p.x, s.x),
              y: Math.min(p.y, s.y),
              width: Math.abs(p.x - s.x),
              height: Math.abs(p.y - s.y),
            });
        }}
        onPointerUp={() => {
          start.current = null;
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
      />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["x", "y", "width", "height"] as const).map((key) => (
          <label key={key} className="text-sm">
            {
              {
                x: "Left (%)",
                y: "Top (%)",
                width: "Width (%)",
                height: "Height (%)",
              }[key]
            }
            <input
              className={inputStyle}
              type="number"
              step="0.1"
              min={key === "width" || key === "height" ? 0.1 : 0}
              max={100}
              value={Math.round(region[key] * 1000) / 10}
              onChange={(e) => {
                const next = { ...region, [key]: Number(e.target.value) / 100 };
                next.width = Math.max(0.001, Math.min(next.width, 1 - next.x));
                next.height = Math.max(
                  0.001,
                  Math.min(next.height, 1 - next.y),
                );
                next.x = Math.max(0, Math.min(next.x, 1 - next.width));
                next.y = Math.max(0, Math.min(next.y, 1 - next.height));
                onChange(next);
              }}
            />
          </label>
        ))}
      </div>
    </>
  );
}
