import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface ExtractedPdfDeck {
  pages: HTMLCanvasElement[];
  slideTexts: string[];
}

export async function extractPdfDeck(file: File): Promise<ExtractedPdfDeck> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: HTMLCanvasElement[] = [];
  const slideTexts: string[] = [];

  const maxPages = Math.min(pdf.numPages, 40);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    }
    pages.push(canvas);

    try {
      const textContent = await page.getTextContent();
      const pageStr = textContent.items
        .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      slideTexts.push(pageStr || `Slide ${i} (${file.name})`);
    } catch {
      slideTexts.push(`Slide ${i} (${file.name})`);
    }
  }

  return { pages, slideTexts };
}

export async function renderPdfToCanvases(file: File): Promise<HTMLCanvasElement[]> {
  const { pages } = await extractPdfDeck(file);
  return pages;
}
