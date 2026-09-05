import type PDFDocumentMain from "pdfkit";
// @ts-ignore standalone bundle embeds .afm font data and ships without type declarations
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";

export default PDFDocument as typeof PDFDocumentMain;
