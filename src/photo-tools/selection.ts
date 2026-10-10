export type Rect = { x: number; y: number; width: number; height: number };
export type Corner = 'nw' | 'ne' | 'sw' | 'se';
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function selection(width: number, height: number, ratio: number, zoom: number, x: number, y: number): Rect {
  const w = Math.min(width, height * ratio) / zoom;
  const h = w / ratio;
  return { x: (width - w) * x / 100, y: (height - h) * y / 100, width: w, height: h };
}
export function moveSelection(rect: Rect, dx: number, dy: number, width: number, height: number): Rect {
  return { ...rect, x: clamp(rect.x + dx, 0, width - rect.width), y: clamp(rect.y + dy, 0, height - rect.height) };
}
export function resizeSelection(rect: Rect, corner: Corner, dx: number, dy: number, width: number, height: number): Rect {
  const right = corner.endsWith('e'), bottom = corner.startsWith('s');
  const anchorX = right ? rect.x : rect.x + rect.width;
  const anchorY = bottom ? rect.y : rect.y + rect.height;
  const ratio = rect.width / rect.height;
  const availableW = right ? width - anchorX : anchorX;
  const availableH = bottom ? height - anchorY : anchorY;
  const maxWidth = Math.min(availableW, availableH * ratio);
  const minWidth = Math.min(width, height * ratio) / 12;
  const projected = rect.width + ((right ? dx : -dx) + (bottom ? dy : -dy) / ratio) / (1 + 1 / (ratio * ratio));
  const w = clamp(projected, Math.min(minWidth, maxWidth), maxWidth);
  const h = w / ratio;
  return { x: right ? anchorX : anchorX - w, y: bottom ? anchorY : anchorY - h, width: w, height: h };
}
export function settings(rect: Rect, width: number, height: number) {
  return {
    zoom: clamp(Math.min(width, height * rect.width / rect.height) / rect.width, 1, 12),
    x: width - rect.width > 0.001 ? clamp(rect.x / (width - rect.width) * 100, 0, 100) : 50,
    y: height - rect.height > 0.001 ? clamp(rect.y / (height - rect.height) * 100, 0, 100) : 50,
  };
}
