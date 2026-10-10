import type { Rect } from './selection';
// Map only the crop's alpha mask back to the full image; RGB comes from the untouched original.
export function applyCropMask(original: HTMLImageElement, mask: CanvasImageSource, area: Rect, rotation: number) {
  const canvas = document.createElement('canvas'); canvas.width = original.naturalWidth; canvas.height = original.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  const rotated = rotation % 180 !== 0;
  const width = rotated ? original.naturalHeight : original.naturalWidth;
  const height = rotated ? original.naturalWidth : original.naturalHeight;
  ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(-rotation * Math.PI / 180); ctx.translate(-width / 2, -height / 2);
  ctx.drawImage(mask, area.x, area.y, area.width, area.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-in'; ctx.drawImage(original, 0, 0);
  return canvas;
}
