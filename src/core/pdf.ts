import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  // pdf.js se queda con el búfer; le pasamos una copia para poder reutilizar el original
  // (por ejemplo, para montar las páginas en vectorial con pdf-lib).
  return getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
}

/** Rasteriza una página (numerada desde 1) a la resolución pedida, con fondo blanco. */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  dpi: number,
  canvas: HTMLCanvasElement | OffscreenCanvas = document.createElement("canvas"),
) {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: dpi / 72 });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas: canvas as HTMLCanvasElement, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}
