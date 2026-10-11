import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrange, pixels, points } from '../src/photo-tools/layout.ts';

test('physical dimensions convert to 300 DPI pixels and PDF points', () => {
  assert.equal(pixels(50.8), 600);
  assert.equal(points(50.8), 144);
});
test('four 2-inch photos span two 4x6 sheets with margins', () => {
  const pages = arrange([{ width: 50.8, height: 50.8, copies: 4 }], 101.6, 152.4, 5, 2);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages.map(p => p.length), [2, 2]);
});
test('mixed sizes keep dimensions and remain inside each printable area', () => {
  const sizes = [{ width: 35, height: 45, copies: 12 }, { width: 50.8, height: 50.8, copies: 9 }, { width: 50, height: 70, copies: 3 }];
  const pages = arrange(sizes, 101.6, 152.4, 5, 2);
  assert.equal(pages.flat().length, 24);
  for (const page of pages) for (const p of page) {
    assert.equal(p.width, sizes[p.photo].width);
    assert.equal(p.height, sizes[p.photo].height);
    assert.ok(p.x >= 5 && p.y >= 5 && p.x + p.width <= 96.6 + 1e-8 && p.y + p.height <= 147.4 + 1e-8);
    for (const q of page) if (q !== p) assert.ok(p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height <= q.y || q.y + q.height <= p.y);
  }
});
test('exact fits do not create extra sheets', () => {
  assert.equal(arrange([{ width: 50, height: 50, copies: 4 }], 100, 100, 0, 0).length, 1);
});
test('invalid dimensions, copy counts and oversize photos are rejected', () => {
  for (const photo of [{ width: NaN, height: 45, copies: 1 }, { width: 35, height: 0, copies: 1 }, { width: 35, height: 45, copies: 1.5 }, { width: 35, height: 45, copies: 41 }, { width: 150, height: 150, copies: 1 }]) {
    assert.throws(() => arrange([photo], 101.6, 152.4, 5, 2));
  }
  assert.throws(() => arrange([], 100, 100, NaN, 2));
});
