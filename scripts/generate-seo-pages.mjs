import { readFile, writeFile, mkdir } from 'node:fs/promises';
import pages from '../src/pages.json' with { type: 'json' };
const origin = 'https://mindkoshpixora.in';
const template = await readFile('dist/index.html', 'utf8');
const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const links = pages.filter(p => p.indexable && p.id !== 'home').map(p => `<li><a href="${p.path}">${escape(p.name)}</a></li>`).join('');
for (const page of pages) {
 const url = origin + page.path;
 const title = page.id === 'home' ? 'MindKosh Pixora | Free Image, PDF & Passport Photo Tools' : `${page.name} | MindKosh Pixora`;
 let html = template.replace(/<title>.*?<\/title>/s, `<title>${escape(title)}</title>`)
  .replace(/(<meta name="description" content=")[^"]*("\s*\/?>)/, `$1${escape(page.description)}$2`)
  .replace(/(<link rel="canonical" href=")[^"]*("\s*\/?>)/, `$1${url}$2`)
  .replace(/(<meta property="og:title" content=")[^"]*("\s*\/?>)/, `$1${escape(title)}$2`)
  .replace(/(<meta property="og:description" content=")[^"]*("\s*\/?>)/, `$1${escape(page.description)}$2`)
  .replace(/(<meta property="og:url" content=")[^"]*("\s*\/?>)/, `$1${url}$2`)
  .replace(/<script type="application\/ld\+json">.*?<\/script>/s, `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':page.id==='home'?'WebSite':'WebPage',name:page.name,url})}</script>`)
  .replace('</head>', `<script>document.documentElement.classList.add("js")</script><style>html.js #root > [data-initial-page]{display:none}</style><meta name="robots" content="${page.indexable?'index, follow':'noindex, follow'}" /></head>`)
  .replace('<div id="root"></div>', `<div id="root"><main data-initial-page style="max-width:760px;margin:64px auto;padding:32px;border:1px solid #e0e7ff;border-radius:20px;background:#fff;font-family:system-ui,sans-serif;color:#0f172a;line-height:1.6"><a style="color:#4f46e5;text-decoration:none;font-weight:700" href="/">MindKosh Pixora — All tools</a><h1>${escape(page.name)}</h1><p>${escape(page.description)}</p><p role="status" style="color:#4f46e5">Loading your tool…</p><noscript><p>Enable JavaScript to use the interactive tools.</p></noscript><details><summary style="cursor:pointer;color:#4f46e5">Browse available tools</summary><nav aria-label="Available tools"><ul>${links}</ul></nav></details></main></div>`);
 const directory = `dist${page.path}`;
 await mkdir(directory, { recursive: true });
 await writeFile(`${directory}index.html`, html);
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter(p=>p.indexable).map(p=>`  <url><loc>${origin}${p.path}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile('dist/sitemap.xml', sitemap);
await writeFile('dist/404.html', '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex, follow"><title>Page not found | MindKosh Pixora</title></head><body><h1>Page not found</h1><p><a href="/">Explore MindKosh Pixora tools</a></p></body></html>');
console.log(`Generated ${pages.length} direct pages and ${pages.filter(p=>p.indexable).length} sitemap URLs.`);
