import { cp, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const root = "public/ocr-assets";
await mkdir(`${root}/core`, { recursive: true });
await cp(
  "node_modules/tesseract.js/dist/worker.min.js",
  `${root}/worker.min.js`,
);
for (const name of await readdir("node_modules/tesseract.js-core"))
  if (name.endsWith(".wasm.js") || name.endsWith(".wasm"))
    await cp(`node_modules/tesseract.js-core/${name}`, `${root}/core/${name}`);
const revision = "87416418657359cb625c412a48b6e1d6d41c29bd";
for (const [language, sha] of Object.entries({
  eng: "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2",
  hin: "4c73ffc59d497c186b19d1e90f5d721d678ea6b2e277b719bee4e2af12271825",
})) {
  const path = `${root}/${language}.traineddata`;
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {}
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== sha) {
    const { stdout } = await run(
      "curl",
      [
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        "45",
        `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${revision}/${language}.traineddata`,
      ],
      { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 },
    );
    bytes = stdout;
    if (createHash("sha256").update(bytes).digest("hex") !== sha)
      throw Error(`${language} OCR model checksum failed`);
    await writeFile(path, bytes);
  }
  await writeFile(`${path}.gz`, gzipSync(bytes));
}
for (const name of ["tesseract.js", "tesseract.js-core"])
  await cp(
    `node_modules/${name}/${name === "tesseract.js" ? "LICENSE.md" : "LICENSE"}`,
    `${root}/${name}-LICENSE.txt`,
  );
await writeFile(
  `${root}/MODEL-SOURCES.txt`,
  `Tesseract tessdata_fast, Apache-2.0\nRevision: ${revision}\nhttps://github.com/tesseract-ocr/tessdata_fast/tree/${revision}\n`,
);
await cp(
  "node_modules/tesseract.js-core/LICENSE",
  `${root}/tessdata-LICENSE.txt`,
);
console.log(
  "Prepared local OCR worker/core and checksum-verified English/Hindi models.",
);
