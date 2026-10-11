// Run after npm run build, with npm run preview -- --host 127.0.0.1 --port 4173.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const JSZip = require("jszip");
const { Document, Paragraph, TextRun, Packer } = require("docx");
const base = process.env.PDF_TEST_URL || "http://127.0.0.1:4173";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pixora-pdf-tests-"));
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const p = await browser.newPage({ hasTouch: true });
    p.setDefaultTimeout(30000);
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const source = await PDFDocument.create();
    const font = await source.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= 3; i++) {
      const pg = source.addPage([600, 800]);
      pg.drawText(`Page ${i} SECRET ${i}`, { x: 60, y: 690, size: 24, font });
      pg.drawText("Name", { x: 60, y: 550, size: 16, font });
      pg.drawText("Score", { x: 300, y: 550, size: 16, font });
      pg.drawText("Student", { x: 60, y: 510, size: 16, font });
      pg.drawText(String(90 + i), { x: 300, y: 510, size: 16, font });
      pg.drawRectangle({
        x: 30,
        y: 30,
        width: 30,
        height: 30,
        color: rgb(1, 0, 0),
      });
    }
    await source.attach(
      new TextEncoder().encode("HIDDEN SECRET ATTACHMENT"),
      "hidden.txt",
    );
    source.setSubject("SECRET METADATA");
    const sourcePath = path.join(dir, "source.pdf");
    fs.writeFileSync(sourcePath, await source.save());
    const edited = await PDFDocument.create();
    const ep = edited.addPage([600, 800]);
    ep.drawText("CHANGED VERSION", { x: 60, y: 690, size: 24 });
    const changedPath = path.join(dir, "changed.pdf");
    fs.writeFileSync(changedPath, await edited.save());
    const forms = await PDFDocument.create();
    const fp = forms.addPage([600, 800]);
    const form = forms.getForm();
    const student = form.createTextField("student");
    student.setText("Initial");
    student.addToPage(fp, { x: 60, y: 700, width: 200, height: 30 });
    const check = form.createCheckBox("approved");
    check.addToPage(fp, { x: 60, y: 650, width: 20, height: 20 });
    const choice = form.createDropdown("course");
    choice.addOptions(["Math", "Science"]);
    choice.select("Math");
    choice.addToPage(fp, { x: 60, y: 600, width: 200, height: 30 });
    const formPath = path.join(dir, "form.pdf");
    fs.writeFileSync(formPath, await forms.save());
    const docxPath = path.join(dir, "notes.docx");
    fs.writeFileSync(
      docxPath,
      await Packer.toBuffer(
        new Document({
          sections: [
            {
              children: [
                new Paragraph({
                  children: [new TextRun("Notes नमस्ते दुनिया")],
                }),
              ],
            },
          ],
        }),
      ),
    );
    const { default: writeXlsx } = await import("write-excel-file/node");
    const { default: readXlsx } = await import("read-excel-file/node");
    const xlsxPath = path.join(dir, "sheet.xlsx");
    await writeXlsx(
      [
        [
          { value: "Subject", type: String },
          { value: "Marks", type: String },
        ],
        [
          { value: "Math", type: String },
          { value: 95, type: Number },
        ],
      ],
      { sheet: "Results" },
    ).toFile(xlsxPath);
    async function open(slug) {
      console.log("Checking", slug);
      await p.goto(`${base}/${slug}/`);
      await p.getByRole("heading", { level: 1 }).waitFor();
    }
    async function file(label, filePath) {
      await p.getByLabel(label, { exact: true }).setInputFiles(filePath);
    }
    async function download(button, name) {
      const event = p.waitForEvent("download");
      await p.getByRole("button", { name: button, exact: true }).click();
      const downloaded = await event;
      const location = path.join(dir, name);
      await downloaded.saveAs(location);
      return fs.readFileSync(location);
    }
    async function mobile() {
      await p.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await p.setViewportSize({ width: 1280, height: 720 });
    }
    await open("split-pdf");
    await file("PDF file", sourcePath);
    await p.getByLabel("Page groups (semicolon between files)").fill("1-2;3");
    let zip = await JSZip.loadAsync(
      await download("Process & Download", "split.zip"),
    );
    assert.equal(
      Object.keys(zip.files).filter((n) => n.endsWith(".pdf")).length,
      2,
    );
    assert.equal(
      (
        await PDFDocument.load(
          await zip.file("part-001.pdf").async("uint8array"),
        )
      ).getPageCount(),
      2,
    );
    await open("extract-pdf-pages");
    await file("PDF file", sourcePath);
    await p.getByLabel("Pages in output order").fill("3,1");
    let extracted = await PDFDocument.load(
      await download("Process & Download", "extract.pdf"),
    );
    assert.equal(extracted.getPageCount(), 2);
    assert.deepEqual(extracted.getPage(0).getSize(), {
      width: 600,
      height: 800,
    });
    await p.getByLabel("Pages in output order").fill("4");
    await p
      .getByRole("button", { name: "Process & Download", exact: true })
      .click();
    await p.getByRole("alert").waitFor();
    assert.match(await p.getByRole("alert").innerText(), /between 1 and 3/);
    await open("pdf-to-word");
    await file("PDF file", sourcePath);
    zip = await JSZip.loadAsync(
      await download("Process & Download", "export.docx"),
    );
    assert.match(
      await zip.file("word/document.xml").async("string"),
      /Page 3 SECRET 3/,
    );
    await open("pdf-to-excel");
    await file("PDF file", sourcePath);
    await download("Process & Download", "export.xlsx");
    const spreadsheet = await readXlsx(path.join(dir, "export.xlsx"));
    assert(
      spreadsheet[0].data.some(
        (row) => row.includes("Name") && row.includes("Score"),
      ),
    );
    await open("pdf-to-markdown");
    await file("PDF file", sourcePath);
    assert.match(
      (await download("Process & Download", "export.md")).toString(),
      /## Page 3/,
    );
    await open("pdf-to-jpg");
    await file("PDF file", sourcePath);
    await p.getByLabel("Resolution").selectOption("144");
    zip = await JSZip.loadAsync(
      await download("Process & Download", "images.zip"),
    );
    assert.equal(Object.keys(zip.files).length, 3);
    const imageBytes = await zip.file("page-1.jpg").async("uint8array");
    const dimensions = await p.evaluate(async (bytes) => {
      const img = await createImageBitmap(
        new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
      );
      const result = [img.width, img.height];
      img.close();
      return result;
    }, Array.from(imageBytes));
    assert.deepEqual(dimensions, [1200, 1600]);
    await open("pdf-to-powerpoint");
    await file("PDF file", sourcePath);
    zip = await JSZip.loadAsync(
      await download("Process & Download", "slides.pptx"),
    );
    assert.equal(
      Object.keys(zip.files).filter((n) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(n),
      ).length,
      3,
    );
    assert.match(
      await zip.file("ppt/slides/slide1.xml").async("string"),
      /<p:pic>/,
    );
    await open("compress-pdf");
    await file("PDF file", sourcePath);
    const unchanged = await download("Process & Download", "compressed.pdf");
    assert.deepEqual(unchanged, fs.readFileSync(sourcePath));
    assert.match(await p.getByRole("status").innerText(), /did not make/);
    const noise = await p.evaluate(()=>{const c=document.createElement("canvas");c.width=600;c.height=800;const ctx=c.getContext("2d");const image=ctx.createImageData(c.width,c.height);let seed=1;for(let i=0;i<image.data.length;i+=4){for(let j=0;j<3;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;image.data[i+j]=seed>>>24;}image.data[i+3]=255;}ctx.putImageData(image,0,0);return c.toDataURL().split(",")[1]});
    const imageHeavy=await PDFDocument.create();const heavyImage=await imageHeavy.embedPng(Buffer.from(noise,"base64"));imageHeavy.addPage([600,800]).drawImage(heavyImage,{x:0,y:0,width:600,height:800});const heavyPath=path.join(dir,"heavy.pdf");fs.writeFileSync(heavyPath,await imageHeavy.save());
    await file("PDF file",heavyPath);const reduced=await download("Process & Download","reduced.pdf");assert(reduced.length<fs.statSync(heavyPath).size);assert.equal((await PDFDocument.load(reduced)).getPageCount(),1);
    await open("jpg-to-pdf");
    const png = await p.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 800, 400);
      ctx.fillStyle = "black";
      ctx.font = "48px Arial";
      ctx.fillText("HELLO WORLD 12345", 30, 180);
      return canvas.toDataURL().split(",")[1];
    });
    const pngPath = path.join(dir, "scan.png");
    fs.writeFileSync(pngPath, Buffer.from(png, "base64"));
    await file("Add photos", [pngPath, pngPath]);
    await p.getByRole("button", { name: "Crop selected photo" }).waitFor();
    let imagesPDF = await PDFDocument.load(
      await download("Download PDF", "photos.pdf"),
    );
    assert.equal(imagesPDF.getPageCount(), 2);
    assert(Math.abs(imagesPDF.getPage(0).getWidth() - 595.28) < 0.01);
    await mobile();
    await open("scan-to-pdf");
    await file("Add photos", pngPath);
    await p.getByLabel("Document area selection").scrollIntoViewIfNeeded();const touchBox=await p.getByLabel("Document area selection").boundingBox();const touch=await p.context().newCDPSession(p);await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:touchBox.x+touchBox.width*.2,y:touchBox.y+touchBox.height*.2}]});await touch.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:touchBox.x+touchBox.width*.7,y:touchBox.y+touchBox.height*.7}]});await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await touch.detach();assert(Math.abs(Number(await p.getByLabel("Left (%)").inputValue())-20)<1);
    await p.getByLabel("Width (%)").fill("50");
    await p
      .getByRole("button", { name: "Crop selected photo", exact: true })
      .click();
    await p.getByLabel("Colour", { exact: true }).selectOption("bw");
    await download("Download PDF", "scan.pdf");
    await open("add-pdf-page-numbers");
    await file("PDF file", sourcePath);
    await p.getByLabel("Starting number").fill("5");
    let numbered = await PDFDocument.load(
      await download("Process & Download", "numbered.pdf"),
    );
    assert.equal(numbered.getPageCount(), 3);
    assert.equal(numbered.getPage(0).getHeight(), 800);
    await open("add-pdf-watermark");
    await file("PDF file", sourcePath);
    await p.getByLabel("Watermark text").fill("नमस्ते");
    await download("Process & Download", "watermark.pdf");
    await mobile();
    await open("crop-pdf");
    await file("PDF file", sourcePath);
    await p.getByLabel("Left (%)").fill("25");
    await p.getByLabel("Top (%)").fill("25");
    await p.getByLabel("Width (%)").fill("50");
    await p.getByLabel("Height (%)").fill("50");
    const cropped = await PDFDocument.load(
      await download("Process & Download", "cropped.pdf"),
    );
    assert.equal(cropped.getPage(0).getWidth(), 300);
    assert.equal(cropped.getPage(0).getHeight(), 400);
    assert.equal(cropped.getPage(1).getWidth(), 600);
    await open("redact-pdf");
    await file("PDF file", sourcePath);
    await p.getByLabel("Left (%)").fill("0");
    await p.getByLabel("Top (%)").fill("0");
    await p.getByLabel("Width (%)").fill("100");
    await p.getByLabel("Height (%)").fill("25");
    await p
      .getByLabel("Apply this rectangle to all pages (relative position)")
      .check();
    await p
      .getByRole("button", { name: "Mark redaction area", exact: true })
      .click();
    const redactedPath = path.join(dir, "redacted.pdf");
    const redacted = await PDFDocument.load(
      await download("Process & Download", "redacted.pdf"),
    );
    assert.equal(redacted.getPageCount(), 3);
    assert.equal(redacted.getSubject(), undefined);
    assert.equal(
      redacted.catalog.has(require("pdf-lib").PDFName.of("Names")),
      false,
    );
    await open("pdf-to-word");
    await file("PDF file", redactedPath);
    await p
      .getByRole("button", { name: "Process & Download", exact: true })
      .click();
    await p.getByRole("alert").waitFor();
    assert.match(await p.getByRole("alert").innerText(), /No selectable text/);
    await open("sign-pdf");
    await file("PDF file", sourcePath);
    await p.waitForFunction(()=>[...document.querySelectorAll("button")].some(b=>b.textContent==="Process & Download"&&!b.disabled));
    await p.getByLabel("Signature pad").scrollIntoViewIfNeeded();
    const pad = await p.getByLabel("Signature pad").boundingBox();
    await p.mouse.move(pad.x + 20, pad.y + 30);
    await p.mouse.down();
    await p.mouse.move(pad.x + 150, pad.y + 70);
    await p.mouse.up();
    await p.getByText("Signature ready.", { exact: false }).waitFor();
    await download("Process & Download", "signed.pdf");
    await open("pdf-forms");
    await file("PDF file", formPath);
    await p.getByLabel("student", { exact: true }).fill("Student A");
    await p.getByLabel("approved", { exact: true }).check();
    await p.getByLabel("course", { exact: true }).selectOption("Science");
    await p.getByLabel("Field name", { exact: true }).fill("extra");
    await p
      .getByRole("button", { name: "Add selected field", exact: true })
      .click();
    await p.getByLabel("extra", { exact: true }).fill("Added");
    let outputForm = (
      await PDFDocument.load(
        await download("Download interactive PDF", "filled.pdf"),
      )
    ).getForm();
    assert.equal(outputForm.getTextField("student").getText(), "Student A");
    assert(outputForm.getCheckBox("approved").isChecked());
    assert.deepEqual(outputForm.getDropdown("course").getSelected(), [
      "Science",
    ]);
    assert.equal(outputForm.getTextField("extra").getText(), "Added");
    await mobile();
    await open("compare-pdf");
    await file("PDF A (original)", sourcePath);
    await file("PDF B (updated)", changedPath);
    await p
      .getByRole("heading", { name: "Text differences", exact: true })
      .waitFor();
    assert.match(await p.locator("pre").last().innerText(), /CHANGED VERSION/);
    await download("Download comparison", "comparison.txt");
    await mobile();
    await open("word-to-pdf");
    await file("Choose document", docxPath);
    await p
      .getByRole("button", { name: "Print / Save as PDF", exact: true })
      .waitFor();
    assert.match(
      await p.frameLocator("iframe").locator("body").innerText(),
      /नमस्ते दुनिया/,
    );
    await download("Download print preview", "docx-preview.html");
    await open("excel-to-pdf");
    await file("Choose document", xlsxPath);
    await p
      .getByRole("button", { name: "Print / Save as PDF", exact: true })
      .waitFor();
    assert.match(
      await p.frameLocator("iframe").locator("body").innerText(),
      /95/,
    );
    await download("Download print preview", "excel-preview.html");
    await open("html-to-pdf");
    const remote = [];
    p.on("request", (r) => {
      if (r.url().startsWith("https://evil.invalid")) remote.push(r.url());
    });
    await p
      .getByLabel("HTML code")
      .fill(
        '<h1>Safe नमस्ते</h1><script>parent.evil=true</script><img src="https://evil.invalid/img" onerror="alert(1)"><iframe src="https://evil.invalid/frame"></iframe>',
      );
    await p
      .getByRole("button", { name: "Prepare preview", exact: true })
      .click();
    assert.match(
      await p.frameLocator("iframe").locator("body").innerText(),
      /Safe नमस्ते/,
    );
    assert.deepEqual(remote, []);
    assert.equal(await p.evaluate(() => window.evil), undefined);
    await download("Download print preview", "html-preview.html");
    const printPage = await browser.newPage();
    await printPage.setContent(fs.readFileSync(path.join(dir, "html-preview.html"), "utf8"));
    const printBytes = await printPage.pdf({
      format: "A4",
      printBackground: true,
    });
    assert.equal((await PDFDocument.load(printBytes)).getPageCount(), 1);
    await printPage.close();
    await mobile();
    await open("ocr-pdf");
    await file("Scanned PDF or photo", pngPath);
    await p
      .getByRole("button", { name: "Recognize text", exact: true })
      .click();
    await p
      .getByLabel("Recognized text", { exact: true })
      .waitFor({ timeout: 120000 });
    assert.match(
      await p.getByLabel("Recognized text", { exact: true }).inputValue(),
      /HELLO\s+WORLD\s+12345/,
    );
    const searchablePath = path.join(dir, "searchable.pdf");
    await download("Download searchable PDF", "searchable.pdf");
    await download("Download Word (DOCX)", "ocr.docx");
    await mobile();
    await open("pdf-to-word");
    await file("PDF file", searchablePath);
    zip = await JSZip.loadAsync(
      await download("Process & Download", "searchable-text.docx"),
    );
    assert.match(
      await zip.file("word/document.xml").async("string"),
      /HELLO\s+WORLD\s+12345/,
    );
    await open("ocr-pdf");
    const hindi = await p.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1200;
      c.height = 300;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "black";
      ctx.font = '60px "Noto Sans Devanagari"';
      ctx.fillText("भारत एक महान देश है", 40, 150);
      return c.toDataURL().split(",")[1];
    });
    const hindiPath = path.join(dir, "hindi.png");
    fs.writeFileSync(hindiPath, Buffer.from(hindi, "base64"));
    await file("Scanned PDF or photo", hindiPath);
    await p.getByLabel("Text language").selectOption("hin");
    await p
      .getByRole("button", { name: "Recognize text", exact: true })
      .click();
    await p
      .getByLabel("Recognized text", { exact: true })
      .waitFor({ timeout: 120000 });
    assert.match(
      await p.getByLabel("Recognized text", { exact: true }).inputValue(),
      /भारत/,
    );
    zip = await JSZip.loadAsync(
      await download("Download Word (DOCX)", "hindi.docx"),
    );
    assert.match(await zip.file("word/document.xml").async("string"), /भारत/);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 21 tools, real PDF/DOCX/XLSX/PPTX/ZIP exports, English/Hindi OCR, searchable text, redaction source removal, forms, printing, HTML isolation and mobile layouts.",
    );
    console.log("Artifacts:", dir);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  console.error("Artifacts:", dir);
  process.exit(1);
});
