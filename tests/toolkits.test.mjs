import test from "node:test";
import assert from "node:assert/strict";
import {
  textStats,
  textAction,
  emi,
  gst,
  bmi,
  convert,
  encodeBase64,
  decodeBase64,
  hexToRgb,
  rgbToHex,
  securePassword,
} from "../src/toolkits/core.ts";
test("Unicode text and cleanup retain content", () => {
  assert.equal(textStats("नमस्ते world 😀").words, 3);
  assert.equal(textStats("😀").characters, 1);
  assert.equal(textAction("  a   b\n a   b  ", "spaces"), "a b\na b");
  assert.equal(textAction("a\nb\na", "dedupe"), "a\nb");
});
test("GST inclusive and exclusive amounts agree", () => {
  assert.deepEqual(gst(1000, 18, false), { base: 1000, tax: 180, total: 1180 });
  assert.deepEqual(gst(1180, 18, true), gst(1000, 18, false));
  assert.throws(() => gst(-1, 18, false));
});
test("EMI zero interest and amortisation formula", () => {
  assert.deepEqual(emi(12000, 0, 12), {
    payment: 1000,
    total: 12000,
    interest: 0,
  });
  assert.ok(Math.abs(emi(100000, 12, 12).payment - 8884.878867834) < 1e-6);
  assert.throws(() => emi(100, 10, 0));
  assert.throws(() => emi(100, 10, 2.5));
});
test("BMI and unit boundaries", () => {
  assert.equal(bmi(70, 175).category, "Healthy range");
  assert.throws(() => bmi(70, 0));
  assert.equal(convert(1, "Length", "inch", "cm"), 2.54);
  assert.equal(convert(32, "Temperature", "Fahrenheit", "Celsius"), 0);
  assert.equal(convert(0, "Temperature", "Kelvin", "Celsius"), -273.15);
  assert.throws(() => convert(-1, "Temperature", "Kelvin", "Celsius"));
});
test("UTF8 Base64 round trip and invalid data rejection", () => {
  const text = "नमस्ते 😀 café";
  assert.equal(decodeBase64(encodeBase64(text)), text);
  assert.throws(() => decodeBase64("%%%"));
  assert.throws(() => decodeBase64("/w=="));
});
test("Colour round trips and range validation", () => {
  assert.deepEqual(hexToRgb("#abc"), [170, 187, 204]);
  assert.equal(rgbToHex(...hexToRgb("#aabbcc")), "#aabbcc");
  assert.throws(() => rgbToHex(256, 0, 0));
  assert.throws(() => hexToRgb("#ggg"));
});
test("Random passwords respect alphabet and limits", () => {
  const p = securePassword(128, "ABC123");
  assert.match(p, /^[ABC123]{128}$/);
  assert.throws(() => securePassword(8, ""));
  assert.throws(() => securePassword(7, "abc"));
  assert.throws(() => securePassword(8, "a".repeat(257)));
});
