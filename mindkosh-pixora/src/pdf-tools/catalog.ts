export const pdfTools = [
  {
    id: "pdfsplit",
    slug: "split-pdf",
    name: "Split PDF",
    description:
      "Split page ranges into separate PDF files and download a ZIP.",
  },
  {
    id: "pdfextract",
    slug: "extract-pdf-pages",
    name: "Extract PDF Pages",
    description:
      "Extract selected pages in your chosen order without rasterizing them.",
  },
  {
    id: "pdfcompress",
    slug: "compress-pdf",
    name: "Compress PDF",
    description:
      "Reduce image-heavy PDF size with adjustable resolution and JPEG quality.",
  },
  {
    id: "imagepdf",
    slug: "jpg-to-pdf",
    name: "JPG to PDF",
    description:
      "Combine JPG, PNG and WebP photos into a PDF with page size and margin settings.",
  },
  {
    id: "scanpdf",
    slug: "scan-to-pdf",
    name: "Scan to PDF",
    description:
      "Capture or upload document photos, crop them and combine them into a PDF.",
  },
  {
    id: "pdfjpg",
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    description: "Export PDF pages as JPG images at your chosen resolution.",
  },
  {
    id: "pdfword",
    slug: "pdf-to-word",
    name: "PDF to Word",
    description:
      "Export selectable PDF text to an editable DOCX document; original layout is not retained.",
  },
  {
    id: "pdfppt",
    slug: "pdf-to-powerpoint",
    name: "PDF to PowerPoint",
    description:
      "Create a PPTX presentation with one image slide per PDF page.",
  },
  {
    id: "pdfexcel",
    slug: "pdf-to-excel",
    name: "PDF to Excel",
    description:
      "Extract selectable PDF text into spreadsheet rows and columns for review.",
  },
  {
    id: "wordpdf",
    slug: "word-to-pdf",
    name: "Word to PDF",
    description:
      "Open DOCX content in a printable preview and save it as PDF using your browser.",
  },
  {
    id: "excelpdf",
    slug: "excel-to-pdf",
    name: "Excel to PDF",
    description: "Print XLSX worksheet values as tables and save them as PDF.",
  },
  {
    id: "htmlpdf",
    slug: "html-to-pdf",
    name: "HTML to PDF",
    description:
      "Preview local HTML safely and save it as PDF using your browser print dialog.",
  },
  {
    id: "pdfnumbers",
    slug: "add-pdf-page-numbers",
    name: "Add Page Numbers",
    description:
      "Add page numbers to PDF pages with position and starting number settings.",
  },
  {
    id: "pdfwatermark",
    slug: "add-pdf-watermark",
    name: "Add Watermark",
    description:
      "Add a text watermark with colour and transparency settings to PDF pages.",
  },
  {
    id: "pdfsign",
    slug: "sign-pdf",
    name: "Sign PDF",
    description:
      "Draw or upload a signature and place it on a PDF; this is a visual signature.",
  },
  {
    id: "pdfcrop",
    slug: "crop-pdf",
    name: "Crop PDF",
    description:
      "Select a page area with a mouse or finger and export cropped PDF pages.",
  },
  {
    id: "pdfredact",
    slug: "redact-pdf",
    name: "Redact PDF",
    description:
      "Black out selected areas and create a new flattened PDF without source text or attachments.",
  },
  {
    id: "pdfcompare",
    slug: "compare-pdf",
    name: "Compare PDF",
    description: "Compare selectable PDF text and view pages side by side.",
  },
  {
    id: "pdfforms",
    slug: "pdf-forms",
    name: "PDF Forms",
    description:
      "Fill supported PDF form fields or add text fields and checkboxes to a document.",
  },
  {
    id: "pdfmarkdown",
    slug: "pdf-to-markdown",
    name: "PDF to Markdown",
    description: "Extract selectable PDF text into an editable Markdown file.",
  },
  {
    id: "pdfocr",
    slug: "ocr-pdf",
    name: "OCR PDF",
    description:
      "Recognize English or Hindi text in scanned PDFs and photos locally in your browser.",
  },
] as const;
export type PDFToolId = (typeof pdfTools)[number]["id"];
