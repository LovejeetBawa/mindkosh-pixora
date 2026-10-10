import test from "node:test";
import assert from "node:assert/strict";
import {
  splitTranslation,
  readTranslation,
  readGoogleTranslation,
} from "../src/document-tools/translation.ts";
import { bounds } from "../src/document-tools/cleanup.ts";
import { onRequestPost } from "../functions/api/translate.ts";
test("UTF8 chunks preserve all text without splitting Unicode or exceeding provider limit", () => {
  const text = "नमस्ते दुनिया 😀 hello world\n".repeat(100);
  const chunks = splitTranslation(text);
  assert.equal(chunks.join(""), text);
  assert.ok(chunks.every((c) => new TextEncoder().encode(c).length <= 450));
  assert.ok(
    chunks.every((c) => !/[\ud800-\udfff]/u.test(c.replace(/😀/gu, ""))),
  );
});
test("Translation service errors and quotas do not become output text", () => {
  assert.equal(
    readTranslation({
      responseStatus: 200,
      responseData: { translatedText: "नमस्ते" },
    }),
    "नमस्ते",
  );
  assert.throws(
    () =>
      readTranslation({
        responseStatus: 403,
        responseDetails: "Quota exceeded",
      }),
    /Quota exceeded/,
  );
  assert.throws(() =>
    readTranslation({ responseStatus: 200, quotaFinished: true }),
  );
  assert.throws(() => readTranslation({ responseStatus: 200 }));
});
test("Selection clamps rounding to actual image edges and rejects out of bounds", () => {
  assert.deepEqual(
    bounds({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, 101, 99),
    { x: 50, y: 49, width: 51, height: 50 },
  );
  assert.throws(() =>
    bounds({ x: 0.9, y: 0, width: 0.2, height: 0.1 }, 100, 100),
  );
});
test("Translation proxy rejects cross-origin and oversized requests before provider use", async () => {
  const req = (body, origin = "https://mindkoshpixora.in") =>
    new Request("https://mindkoshpixora.in/api/translate", {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await onRequestPost({
        request: req(
          { text: "hello", source: "en", target: "hi" },
          "https://other.example",
        ),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await onRequestPost({
        request: req({ text: "x".repeat(451), source: "en", target: "hi" }),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await onRequestPost({
        request: req({ text: "hello", source: "en", target: "en" }),
      })
    ).status,
    400,
  );
});

test("Google web results retain Unicode and combine segments; invalid results are rejected", () => {
  assert.equal(
    readGoogleTranslation([
      [
        ["नमस्ते ", "Hello"],
        ["दुनिया", "world"],
      ],
    ]),
    "नमस्ते दुनिया",
  );
  assert.throws(() => readGoogleTranslation({ error: "unavailable" }));
  assert.throws(() => readGoogleTranslation([[]]));
});
test('Proxy selects Google only when requested and preserves provider Unicode',async()=>{const originalFetch=globalThis.fetch;try{let calls=0;globalThis.fetch=async url=>{calls++;assert.equal(new URL(url).hostname,'translate.googleapis.com');return new Response(JSON.stringify([[['नमस्ते दुनिया','Hello world']]]),{headers:{'Content-Type':'application/json'}})};const request=new Request('https://mindkoshpixora.in/api/translate',{method:'POST',body:JSON.stringify({text:'Hello world',source:'en',target:'hi',provider:'google'})});const response=await onRequestPost({request});assert.deepEqual(await response.json(),{text:'नमस्ते दुनिया'});assert.equal(calls,1);}finally{globalThis.fetch=originalFetch}});
