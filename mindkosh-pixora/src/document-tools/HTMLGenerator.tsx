import { useState } from "react";
import { Toolkit, Output, inputStyle } from "../toolkits/ui";
export function escapeHTML(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function generateHTML(
  title: string,
  description: string,
  features: string,
  colour: string,
  url: string,
  label: string,
  layout: string,
) {
  if (!/^#[0-9a-f]{6}$/i.test(colour)) throw Error("Invalid theme colour.");
  let safeURL = "#";
  if (url.trim()) {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol))
      throw Error("Use an http or https button URL.");
    safeURL = parsed.href;
  }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#f8fafc;color:#172033}header{padding:64px 24px;text-align:${layout === "Portfolio" ? "left" : "center"};background:${colour};color:white}main{max-width:1000px;margin:auto;padding:32px 24px}.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:16px}article{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px}a{display:inline-block;background:white;color:#172033;padding:12px 24px;border-radius:8px;margin-top:16px}footer{text-align:center;padding:24px}h1{overflow-wrap:anywhere;font-size:clamp(2rem,6vw,3.5rem)}p{line-height:1.7;white-space:pre-line}</style></head><body><header><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p>${label.trim() ? `<a href="${escapeHTML(safeURL)}">${escapeHTML(label)}</a>` : ""}</header><main><section class="features" aria-label="Features">${features
    .split("\n")
    .filter((s) => s.trim())
    .map((s) => `<article><h2>${escapeHTML(s.trim())}</h2></article>`)
    .join(
      "",
    )}</section></main><footer>${escapeHTML(title)}</footer></body></html>`;
}
export default function HTMLGenerator() {
  const [title, setTitle] = useState("My website");
  const [description, setDescription] = useState("Welcome to my website.");
  const [features, setFeatures] = useState("About us\nOur services\nContact");
  const [colour, setColour] = useState("#4f46e5");
  const [url, setURL] = useState("https://mindkoshpixora.in");
  const [label, setLabel] = useState("Get started");
  const [layout, setLayout] = useState("Landing Page");
  let code = "",
    error = "";
  try {
    code = generateHTML(
      title,
      description,
      features,
      colour,
      url,
      label,
      layout,
    );
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <Toolkit
      title="HTML Code Generator"
      description="Build a responsive landing page or portfolio from your content. Preview, copy and download a complete HTML file."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Page title
          <input
            className={inputStyle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Layout
          <select
            aria-label="Layout"
            className={inputStyle}
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
          >
            <option>Landing Page</option>
            <option>Portfolio</option>
          </select>
        </label>
        <label className="text-sm">
          Description
          <textarea
            aria-label="Description"
            className={inputStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Feature headings (one per line)
          <textarea
            aria-label="Feature headings"
            className={inputStyle}
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Button label
          <input
            className={inputStyle}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Button URL
          <input
            type="url"
            className={inputStyle}
            value={url}
            onChange={(e) => setURL(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-4 text-sm">
          Theme colour
          <input
            aria-label="Theme colour"
            type="color"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      <h2 className="mt-6 font-semibold">Live preview</h2>
      <iframe
        title="Generated HTML preview"
        sandbox=""
        srcDoc={code}
        className="mt-3 h-96 w-full rounded-xl border bg-white"
      />
      <Output
        name="Generated HTML"
        value={code}
        filename="mindkosh-website.html"
      />
    </Toolkit>
  );
}
