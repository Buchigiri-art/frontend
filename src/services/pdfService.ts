// src/services/pdfService.ts
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min?url';

/**
 * Ensure you have installed:
 * npm install pdfjs-dist
 * 
 * Vite requires '?url' to import workers as URLs.
 */
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = getDocument({ data: arrayBuffer });
    const pdf: PDFDocumentProxy = await loadingTask.promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map((item: { str?: string }) => item.str || '')
          .join(' ')
          .trim();

        if (pageText.length > 0) {
          fullText += pageText + '\n\n';
        } else {
          // Optional: detect scanned pages
          // fullText += '[PAGE CONTAINS NO EMBEDDED TEXT — OCR REQUIRED]\n\n';
        }
      } catch (pageError) {
        console.warn(`Failed to process page ${i}:`, pageError);
      }
    }

    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF file');
  }
}

export function isPDFFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}