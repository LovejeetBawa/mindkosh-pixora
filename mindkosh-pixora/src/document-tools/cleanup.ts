export type Region = { x: number; y: number; width: number; height: number };
export const initialRegion: Region = {
  x: 0.3,
  y: 0.4,
  width: 0.4,
  height: 0.15,
};
export function bounds(region: Region, width: number, height: number) {
  if (
    ![region.x, region.y, region.width, region.height].every(Number.isFinite) ||
    region.x < 0 ||
    region.y < 0 ||
    region.width <= 0 ||
    region.height <= 0 ||
    region.x + region.width > 1.000001 ||
    region.y + region.height > 1.000001
  )
    throw Error("Keep the selected area inside the image.");
  const x = Math.floor(region.x * width),
    y = Math.floor(region.y * height);
  return {
    x,
    y,
    width: Math.max(1, Math.min(width - x, Math.ceil(region.width * width))),
    height: Math.max(
      1,
      Math.min(height - y, Math.ceil(region.height * height)),
    ),
  };
}
// Interpolate surrounding pixels. This repairs simple backgrounds; lost detail cannot be recovered.
export function cleanRegion(
  canvas: HTMLCanvasElement,
  region: Region,
  mode: string,
  colour: string,
) {
  const ctx = canvas.getContext("2d")!;
  const r = bounds(region, canvas.width, canvas.height);
  if (mode === "cover") {
    ctx.fillStyle = colour;
    ctx.fillRect(r.x, r.y, r.width, r.height);
    return;
  }
  if (
    r.x === 0 &&
    r.y === 0 &&
    r.width === canvas.width &&
    r.height === canvas.height
  )
    throw Error("Select a smaller area so surrounding pixels are available.");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const original = new Uint8ClampedArray(data.data);
  const at = (x: number, y: number, ch: number) =>
    original[
      (Math.min(canvas.height - 1, Math.max(0, y)) * canvas.width +
        Math.min(canvas.width - 1, Math.max(0, x))) *
        4 +
        ch
    ];
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++) {
      const fx = (x + 0.5) / r.width,
        fy = (y + 0.5) / r.height;
      const hasLeft = r.x > 0,
        hasRight = r.x + r.width < canvas.width,
        hasTop = r.y > 0,
        hasBottom = r.y + r.height < canvas.height;
      for (let ch = 0; ch < 4; ch++) {
        let sum = 0,
          weight = 0;
        for (const [v, w, available] of [
          [at(r.x - 1, r.y + y, ch), 1 - fx, hasLeft],
          [at(r.x + r.width, r.y + y, ch), fx, hasRight],
          [at(r.x + x, r.y - 1, ch), 1 - fy, hasTop],
          [at(r.x + x, r.y + r.height, ch), fy, hasBottom],
        ] as [number, number, boolean][]) {
          if (available) {
            sum += v * w;
            weight += w;
          }
        }
        data.data[((r.y + y) * canvas.width + r.x + x) * 4 + ch] = sum / weight;
      }
    }
  ctx.putImageData(data, 0, 0);
}
