// Una página se ve como una pila de "bandas": bloques de filas con tinta separados por espacio en
// blanco. Los reportes de ETABS, SAFE, SAP2000, etc. repiten una banda arriba (título y fecha) y
// otra abajo (versión del programa, "Page 2 of 43") en todas las páginas. Si se detectan, se
// pueden excluir del recorte, que es lo que se hacía a mano en ImageCap.

import type { Crop } from "./crop";

/** Banda en fracciones de la página. */
export type Band = Crop;

export interface BandOptions {
  threshold?: number;
  /** Filas en blanco seguidas que separan dos bandas. */
  minGapRows?: number;
  /** Píxeles de tinta que necesita una fila para contar. */
  minInkPerRow?: number;
}

export function inkBands(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  { threshold = 240, minGapRows = 3, minInkPerRow = 2 }: BandOptions = {},
): Band[] {
  const bands: Band[] = [];
  let open: { y0: number; y1: number; x0: number; x1: number } | null = null;
  let gap = 0;

  for (let y = 0; y < height; y++) {
    let ink = 0;
    let minX = width;
    let maxX = -1;
    let i = y * width * 4;
    for (let x = 0; x < width; x++, i += 4) {
      const a = rgba[i + 3] / 255;
      const lum = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * a + 255 * (1 - a);
      if (lum < threshold) {
        ink++;
        if (x < minX) minX = x;
        maxX = x;
      }
    }
    if (ink >= minInkPerRow) {
      if (open && gap < minGapRows) {
        open.y1 = y + 1;
        open.x0 = Math.min(open.x0, minX);
        open.x1 = Math.max(open.x1, maxX + 1);
      } else {
        if (open) bands.push(toFraction(open, width, height));
        open = { y0: y, y1: y + 1, x0: minX, x1: maxX + 1 };
      }
      gap = 0;
    } else {
      gap++;
    }
  }
  if (open) bands.push(toFraction(open, width, height));
  return bands;
}

function toFraction(b: { y0: number; y1: number; x0: number; x1: number }, w: number, h: number) {
  return { x0: b.x0 / w, y0: b.y0 / h, x1: b.x1 / w, y1: b.y1 / h };
}

/** Rectángulo que encierra un grupo de bandas, o null si no hay ninguna. */
export function boundsOf(bands: Band[]): Crop | null {
  if (bands.length === 0) return null;
  return {
    x0: Math.min(...bands.map((b) => b.x0)),
    y0: Math.min(...bands.map((b) => b.y0)),
    x1: Math.max(...bands.map((b) => b.x1)),
    y1: Math.max(...bands.map((b) => b.y1)),
  };
}

export interface RunningBands {
  /** Por página: índices de las bandas que son encabezado o pie repetido. */
  repeated: Set<number>[];
  /** Páginas en que se encontró encabezado o pie. */
  pagesWithHeader: number;
  pagesWithFooter: number;
}

const TOLERANCE = 0.01; // 1 % de la altura de la hoja
const MAX_BAND_HEIGHT = 0.08; // un encabezado no ocupa más del 8 % de la hoja
const EDGE_ZONE = 0.15; // y vive en el 15 % superior o inferior

const same = (a: Band, b: Band) =>
  Math.abs(a.y0 - b.y0) <= TOLERANCE && Math.abs(a.y1 - b.y1) <= TOLERANCE;

/**
 * Encuentra el encabezado y el pie que se repiten: la primera (o última) banda de cada página,
 * delgada, pegada al borde y en la misma posición en al menos la mitad de las páginas con
 * contenido (y mínimo dos).
 */
export function findRunningBands(pages: Band[][]): RunningBands {
  const repeated = pages.map(() => new Set<number>());
  const nonBlank = pages.filter((b) => b.length > 0).length;

  const detect = (pick: (bands: Band[]) => number, nearEdge: (b: Band) => boolean) => {
    const candidates = pages.map((bands) => {
      if (bands.length < 2) return null; // con una sola banda, esa banda es el contenido
      const i = pick(bands);
      const b = bands[i];
      return b.y1 - b.y0 <= MAX_BAND_HEIGHT && nearEdge(b) ? { i, b } : null;
    });
    // La posición más común gana; las demás páginas cuentan si caen dentro de la tolerancia.
    let best: Band | null = null;
    let bestCount = 0;
    for (const c of candidates) {
      if (!c) continue;
      const count = candidates.filter((o) => o && same(o.b, c.b)).length;
      if (count > bestCount) {
        best = c.b;
        bestCount = count;
      }
    }
    if (!best || bestCount < 2 || bestCount < nonBlank / 2) return 0;
    const ref = best;
    let found = 0;
    candidates.forEach((c, page) => {
      if (c && same(c.b, ref)) {
        repeated[page].add(c.i);
        found++;
      }
    });
    return found;
  };

  const pagesWithHeader = detect(
    () => 0,
    (b) => b.y1 <= EDGE_ZONE,
  );
  const pagesWithFooter = detect(
    (bands) => bands.length - 1,
    (b) => b.y0 >= 1 - EDGE_ZONE,
  );
  return { repeated, pagesWithHeader, pagesWithFooter };
}

/** El contenido de una página sin las bandas repetidas. */
export function contentWithout(bands: Band[], skip: Set<number>): Crop | null {
  return boundsOf(bands.filter((_, i) => !skip.has(i)));
}
