import type { PDFDocumentProxy } from "pdfjs-dist";
import { type Band, inkBands } from "./bands";
import { type Crop, toPixels } from "./crop";
import { type Mask, paintMasks } from "./mask";
import { renderPage } from "./pdf";

/** Resolución para buscar el contenido: de sobra para encontrar bordes y rápida en 200 páginas. */
const ANALYSIS_DPI = 40;

export interface PageInfo {
  /** Tamaño de la hoja en mm. */
  widthMm: number;
  heightMm: number;
  /** Bloques de contenido de arriba abajo; vacío si la página está en blanco. */
  bands: Band[];
}

export async function analyzePages(
  doc: PDFDocumentProxy,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<PageInfo[]> {
  const canvas = document.createElement("canvas");
  const pages: PageInfo[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    signal?.throwIfAborted();
    const page = await doc.getPage(n);
    const [, , wPt, hPt] = page.view;
    const rotated = page.rotate % 180 !== 0;
    await renderPage(doc, n, ANALYSIS_DPI, canvas);
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    pages.push({
      widthMm: ((rotated ? hPt : wPt) / 72) * 25.4,
      heightMm: ((rotated ? wPt : hPt) / 72) * 25.4,
      bands: inkBands(data, canvas.width, canvas.height),
    });
    onProgress(n, doc.numPages);
  }
  return pages;
}

/** Rasteriza una página y la recorta. Devuelve un canvas nuevo con solo el área elegida. */
export async function renderCropped(
  doc: PDFDocumentProxy,
  pageNumber: number,
  dpi: number,
  crop: Crop,
  masks: Mask[] = [],
): Promise<HTMLCanvasElement> {
  const full = await renderPage(doc, pageNumber, dpi);
  // Las máscaras se pintan sobre la página completa: en la imagen lo tapado desaparece de verdad.
  paintMasks(
    full.getContext("2d") as CanvasRenderingContext2D,
    masks,
    pageNumber,
    full.width,
    full.height,
  );
  const r = toPixels(crop, full.width, full.height);
  const out = document.createElement("canvas");
  out.width = r.w;
  out.height = r.h;
  const ctx = out.getContext("2d") as CanvasRenderingContext2D;
  ctx.drawImage(full, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  full.width = full.height = 0; // libera memoria ya, sin esperar al recolector
  return out;
}

export type ImageFormat = "png" | "jpg";

export function canvasToBytes(canvas: HTMLCanvasElement, format: ImageFormat) {
  return new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject)
          : reject(new Error("No se pudo codificar la imagen")),
      format === "png" ? "image/png" : "image/jpeg",
      0.95,
    ),
  );
}

/**
 * Gira 90° en sentido antihorario: una hoja horizontal queda de pie con su parte de arriba a la
 * izquierda, como se suelen encuadernar los anexos.
 */
export function rotateLeft(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.height;
  out.height = src.width;
  const ctx = out.getContext("2d") as CanvasRenderingContext2D;
  ctx.translate(0, out.height);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  src.width = src.height = 0;
  return out;
}
