import { pdfTools } from "./catalog";
import PDFUtilities from "./PDFUtilities";
import ImagePDF from "./ImagePDF";
import DocumentPDF from "./DocumentPDF";
import PDFForms from "./PDFForms";
import PDFCompare from "./PDFCompare";
import PDFOCR from "./PDFOCR";
export default function ExtraPDFTools({ id }: { id: string }) {
  const tool = pdfTools.find((t) => t.id === id);
  if (!tool) return null;
  if (id === "imagepdf" || id === "scanpdf")
    return <ImagePDF scan={id === "scanpdf"} />;
  if (id === "wordpdf" || id === "excelpdf" || id === "htmlpdf")
    return <DocumentPDF kind={id} />;
  if (id === "pdfforms") return <PDFForms />;
  if (id === "pdfcompare") return <PDFCompare />;
  if (id === "pdfocr") return <PDFOCR />;
  return <PDFUtilities mode={tool.id} />;
}
