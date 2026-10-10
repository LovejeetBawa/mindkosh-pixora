import { useEffect, useState, type MouseEvent } from 'react';
import pages from './pages.json';
import PDFMerge from './pdf-tools/PDFMerge';
import PassportPhoto from './photo-tools/PassportPhoto';
import TextTools from './toolkits/TextTools';
import Calculators from './toolkits/Calculators';
import DeveloperTools from './toolkits/DeveloperTools';
import AITools from './toolkits/AITools';
import { ArrowRight, Image, FileText, Type, Calculator, Code2, Sparkles, Search, Layers3, ShieldCheck, Menu, X } from 'lucide-react';
import Editor from './App';
import VisualDocuments from './document-tools/VisualDocuments';
import HTMLGenerator from './document-tools/HTMLGenerator';
import DocumentTranslator from './document-tools/DocumentTranslator';

type Tool = {name:string; description:string; category:string; ready:boolean};
const tools:Tool[] = [
 {name:'Watermark Remover',description:'Select and clean images/PDFs; remove DOCX header graphics or watermark text',category:'Image',ready:true},
 {name:'HTML Code Generator',description:'Create, preview and download responsive HTML pages',category:'Developer',ready:true},
 {name:'PDF Editor',description:'Add text, cover areas, rotate, reorder and delete pages',category:'PDF',ready:true},
 {name:'Document Translator',description:'Translate PDF, DOCX, TXT and HTML text into another language',category:'Text',ready:true},
 {name:'Image Converter',description:'Convert images between supported formats',category:'Image',ready:true},
 {name:'Image Resizer',description:'Resize photos with presets or custom dimensions',category:'Image',ready:true},
 {name:'Image Enhancer',description:'Adjust brightness, contrast, sharpness and more',category:'Image',ready:true},
 {name:'Passport Photo Maker',description:'Crop passport photos and arrange multiple sizes on print sheets',category:'Image',ready:true},
 {name:'PDF Merge',description:'Combine multiple PDF files into one document',category:'PDF',ready:true},
 {name:'Text Tools',description:'Word count, case conversion, text cleanup and find/replace',category:'Text',ready:true},
 {name:'Calculators',description:'Percentage, GST, EMI, BMI and unit converters',category:'Calculators',ready:true},
 {name:'Developer Tools',description:'JSON, Base64, URL, hashes, passwords, UUID and colours',category:'Developer',ready:true},
 {name:'AI Tools',description:'AI background remover, background changer and subject masks',category:'AI',ready:true},
];
const categories = [
 {name:'Image',icon:Image,subtitle:'Convert · Resize · Enhance'},
 {name:'PDF',icon:FileText,subtitle:'Document utilities'},
 {name:'Text',icon:Type,subtitle:'Writing utilities'},
 {name:'Calculators',icon:Calculator,subtitle:'Quick calculations'},
 {name:'Developer',icon:Code2,subtitle:'Coding helpers'},
 {name:'AI',icon:Sparkles,subtitle:'Smart tools'},
];
export default function Site(){
const pageFromPath=()=>pages.find(p=>p.path===window.location.pathname.replace(/\/?$/, '/'))?.id ?? 'missing';
 const [page,setPage]=useState(pageFromPath);
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState('All');
 const [mobileOpen,setMobileOpen]=useState(false);
 const route=pages.find(p=>p.id===page);
 useEffect(()=>{const back=()=>{setPage(pageFromPath());setMobileOpen(false)};window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back)},[]);
 useEffect(()=>{
  const title=route ? (page==='home'?'MindKosh Pixora | Free Image, PDF & Passport Photo Tools':`${route.name} | MindKosh Pixora`) : 'Page not found | MindKosh Pixora';
  document.title=title;
  const update=(selector:string,value:string)=>document.querySelector(selector)?.setAttribute('content',value);
  update('meta[name="description"]',route?.description ?? 'This page could not be found.');
  update('meta[property="og:title"]',title);
  update('meta[property="og:description"]',route?.description ?? 'This page could not be found.');
  update('meta[property="og:url"]',`https://mindkoshpixora.in${route?.path ?? window.location.pathname}`);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href',`https://mindkoshpixora.in${route?.path ?? window.location.pathname}`);
  let robots=document.querySelector('meta[name="robots"]');
  if(!robots){robots=document.createElement('meta');robots.setAttribute('name','robots');document.head.appendChild(robots)}
  robots.setAttribute('content',route?.indexable ? 'index, follow' : 'noindex, follow');
  const schema=document.querySelector('script[type="application/ld+json"]');
  if(schema)schema.textContent=JSON.stringify({'@context':'https://schema.org','@type':page==='home'?'WebSite':'WebPage',name:route?.name ?? 'Page not found',url:`https://mindkoshpixora.in${route?.path ?? window.location.pathname}`});
 },[page,route]);
 const navigate=(next:string)=>{const path=pages.find(p=>p.id===next)?.path ?? '/';if(window.location.pathname!==path)window.history.pushState({},'',path);setPage(next);setMobileOpen(false);window.scrollTo(0,0)};
 const link=(next:string)=>({href:pages.find(p=>p.id===next)?.path ?? '/',onClick:(event:MouseEvent<HTMLAnchorElement>)=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(next)}});
 const filtered=tools.filter(t=>(category==='All'||t.category===category)&&`${t.name} ${t.description}`.toLowerCase().includes(query.toLowerCase()));
 return <div className="min-h-screen bg-slate-50 text-slate-900">
 <header className="sticky top-0 z-50 border-b border-indigo-100 bg-white/95 backdrop-blur">
  <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
   <a {...link('home')} className="flex items-center gap-3 text-left"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white"><Layers3 size={23}/></span><span><strong className="block text-lg leading-tight">MindKosh <span className="text-violet-600">Pixora</span></strong><small className="text-slate-500">One Platform. Multiple Smart Tools.</small></span></a>
   <nav className="hidden items-center gap-7 text-sm font-semibold md:flex"><a {...link('home')}>Home</a><a {...link('home')} onClick={event=>{link('home').onClick(event);setCategory('All')}}>All Tools</a><a {...link('about')}>About</a><a {...link('contact')}>Contact</a><a {...link('editor')} className="rounded-full bg-indigo-600 px-5 py-2.5 text-white hover:bg-indigo-700">Open Image Editor</a></nav>
   <button className="md:hidden" aria-label="Toggle menu" onClick={()=>setMobileOpen(!mobileOpen)}>{mobileOpen?<X/>:<Menu/>}</button>
  </div>
  {mobileOpen&&<nav className="flex flex-col gap-3 border-t bg-white px-5 py-4 text-sm"><a {...link('home')}>Home / All Tools</a><a {...link('editor')}>Image Editor</a><a {...link('about')}>About</a><a {...link('contact')}>Contact</a></nav>}
 </header>
 {['watermark','html','pdfeditor','translate'].includes(page)?<><div className="mx-auto max-w-7xl px-5 pt-5"><a {...link('home')} className="text-sm font-semibold text-indigo-700">← Back to all tools</a></div>{page==='watermark'?<VisualDocuments watermark/>:page==='pdfeditor'?<VisualDocuments/>:page==='html'?<HTMLGenerator/>:<DocumentTranslator/>}</>:page==='text'||page==='calculator'||page==='developer'||page==='ai'?<><div className="mx-auto max-w-7xl px-5 pt-5"><a {...link('home')} className="text-sm font-semibold text-indigo-700">← Back to all tools</a></div>{page==='text'?<TextTools/>:page==='calculator'?<Calculators/>:page==='developer'?<DeveloperTools/>:<AITools/>}</>:page==='passport' || page==='pdfmerge' ? <><div className="mx-auto max-w-7xl px-5 pt-5"><a {...link('home')} className="text-sm font-semibold text-indigo-700">← Back to all tools</a></div>{page==='passport'?<PassportPhoto/>:<PDFMerge/>}</> : ['editor','converter','resizer','enhancer'].includes(page)?<><div className="mx-auto max-w-7xl px-5 pt-5"><a {...link('home')} className="text-sm font-semibold text-indigo-700">← Back to all tools</a></div><Editor key={page} initialTab={page==='resizer'?'resize':page==='enhancer'?'enhance':'format'}/></>:page==='home'?<>
  <section className="bg-gradient-to-br from-blue-950 via-indigo-900 to-violet-900 px-5 py-20 text-center text-white"><div className="mx-auto max-w-4xl"><span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold tracking-wide">YOUR EVERYDAY ONLINE TOOLKIT</span><h1 className="mt-8 text-4xl font-extrabold leading-tight sm:text-6xl">Smart tools. <span className="text-violet-300">Simpler work.</span></h1><p className="mx-auto mt-5 max-w-2xl text-lg text-indigo-100">Image and PDF tools, text utilities, calculators, developer helpers and AI photo tools—all in one place.</p><div className="mx-auto mt-9 flex max-w-xl items-center gap-3 rounded-2xl bg-white p-3 text-slate-700 shadow-xl"><Search className="ml-2 text-slate-400"/><input aria-label="Search tools" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search for a tool..." className="min-w-0 flex-1 bg-transparent p-2 outline-none"/><button onClick={()=>document.getElementById('tools')?.scrollIntoView({behavior:'smooth'})} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Search</button></div><a {...link('editor')} className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 font-bold text-indigo-800">Try Image Editor <ArrowRight size={18}/></a></div></section>
  <section className="mx-auto max-w-7xl px-5 py-14"><h2 className="text-2xl font-bold sm:text-3xl">Explore tool categories</h2><p className="mt-2 text-slate-500">Built to grow with the tools you need.</p><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map(c=><button key={c.name} onClick={()=>{setCategory(c.name);document.getElementById('tools')?.scrollIntoView({behavior:'smooth'})}} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-md"><span className="rounded-xl bg-indigo-50 p-4 text-indigo-600"><c.icon size={26}/></span><span><strong className="block">{c.name} Tools</strong><small className="text-slate-500">{c.subtitle}</small></span></button>)}</div></section>
  <section id="tools" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-16"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-bold sm:text-3xl">Discover tools</h2><p className="mt-2 text-slate-500">Choose a tool and get started.</p></div><select aria-label="Filter by category" value={category} onChange={e=>setCategory(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3"><option>All</option>{categories.map(c=><option key={c.name}>{c.name}</option>)}</select></div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(t=><article key={t.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-indigo-600">{t.category}</span><span className={'rounded-full px-3 py-1 text-xs font-semibold '+(t.ready?'bg-green-50 text-green-700':'bg-slate-100 text-slate-500')}>{t.ready?'Available':'Coming soon'}</span></div><h3 className="mt-5 text-xl font-bold">{t.name}</h3><p className="mt-2 min-h-12 text-sm text-slate-500">{t.description}</p><a {...link(pages.find(p=>p.name===t.name)?.id ?? (t.name==='AI Tools'?'ai':'editor'))} className="mt-5 inline-flex items-center gap-2 font-semibold text-indigo-700">Open tool <ArrowRight size={16}/></a></article>)}</div>{filtered.length===0&&<p className="py-12 text-center text-slate-500">No matching tools found.</p>}</section>
  <section className="bg-indigo-50 px-5 py-12"><div className="mx-auto flex max-w-7xl items-center gap-4"><ShieldCheck className="shrink-0 text-indigo-700" size={35}/><div><h2 className="font-bold">Privacy-first image editing</h2><p className="text-sm text-slate-600">The current image editor processes files locally in your browser. No upload is required for its editing features.</p></div></div></section>
 </>:<main className="mx-auto min-h-[55vh] max-w-3xl px-5 py-16"><h1 className="text-4xl font-bold">{page==='missing'?'Page not found':page==='about'?'About MindKosh Pixora':page==='contact'?'Contact': 'Privacy'}</h1>{page==='missing'?<p className="mt-6">This page does not exist. <a {...link('home')}>Explore all tools</a>.</p>:page==='about'?<p className="mt-6 leading-8 text-slate-600">MindKosh Pixora is an expanding online tools platform. Our tools help you work with images, PDFs and text, run everyday calculations, format developer data and process photos with AI directly in your browser.</p>:page==='contact'?<p className="mt-6 leading-8 text-slate-600">Contact details will be published before the public launch.</p>:<p className="mt-6 leading-8 text-slate-600">The current image editor runs locally in your browser. A complete privacy policy will be finalized before public launch, including any hosting analytics or advertising services.</p>}</main>}
 <footer className="border-t border-slate-200 bg-white px-5 py-9"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5"><div><strong>MindKosh Pixora</strong><p className="text-sm text-slate-500">One Platform. Multiple Smart Tools.</p></div><div className="flex flex-wrap gap-5 text-sm text-slate-600"><a {...link('about')}>About</a><a {...link('privacy')}>Privacy</a><a {...link('contact')}>Contact</a><a {...link('home')}>All Tools</a></div></div></footer>
 </div>
}
