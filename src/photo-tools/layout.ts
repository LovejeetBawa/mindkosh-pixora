export type PhotoSize = { width: number; height: number; copies: number };
export type Placement = { photo: number; x: number; y: number; width: number; height: number };
export const DPI = 300;
export const pixels = (mm: number) => Math.round(mm * DPI / 25.4);
export const points = (mm: number) => mm * 72 / 25.4;

// Shelf packing preserves each photo's physical dimensions and starts new pages as needed.
export function arrange(photos: PhotoSize[], paperWidth: number, paperHeight: number, margin: number, gap: number): Placement[][] {
  if (![paperWidth, paperHeight, margin, gap].every(Number.isFinite) || paperWidth <= 0 || paperHeight <= 0 || margin < 0 || gap < 0) throw new Error('Enter valid paper dimensions, margins and spacing.');
  const pages: Placement[][] = [[]];
  let x = margin, y = margin, rowHeight = 0;
  for (const [photo, size] of photos.entries()) {
    if (![size.width, size.height, size.copies].every(Number.isFinite) || size.width < 10 || size.height < 10 || size.width > 150 || size.height > 150 || !Number.isInteger(size.copies) || size.copies < 1 || size.copies > 40) throw new Error('Use photo dimensions between 10 and 150 mm and 1–40 copies.');
    if (size.width > paperWidth - margin * 2 || size.height > paperHeight - margin * 2) throw new Error('A photo is larger than the printable area. Choose larger paper or smaller dimensions.');
    for (let copy = 0; copy < size.copies; copy++) {
      if (x + size.width > paperWidth - margin + 0.000001) { x = margin; y += rowHeight + gap; rowHeight = 0; }
      if (y + size.height > paperHeight - margin + 0.000001) { pages.push([]); x = margin; y = margin; rowHeight = 0; }
      pages[pages.length - 1].push({ photo, x, y, width: size.width, height: size.height });
      x += size.width + gap; rowHeight = Math.max(rowHeight, size.height);
    }
  }
  return pages;
}
