import test from "node:test";
import assert from "node:assert/strict";
import { pageSelection } from "../src/pdf-tools/selection.ts";
test("PDF page selection preserves explicit ordering, descending ranges and repeated pages", () => {
  assert.deepEqual(pageSelection("3,1-2,5-4,3", 5), [2, 0, 1, 4, 3, 2]);
  assert.deepEqual(pageSelection("", 3), [0, 1, 2]);
});
test("PDF page selection rejects malformed, nonexistent and excessive output pages", () => {
  for (const value of ["0", "4", "1-4", "1,,2", "1.5", "1;2", "1-2-3"])
    assert.throws(() => pageSelection(value, 3));
  assert.throws(() => pageSelection(Array(301).fill("1").join(","), 1), /300/);
});
