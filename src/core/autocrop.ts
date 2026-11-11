// Detecta el rectángulo con contenido de una página rasterizada: el "barrio de píxeles"
// que el ingeniero hacía a ojo, página por página.

export interface Bounds {
  left: number;
  top: number;
  right: number; // exclusivo
  bottom: number; // exclusivo
}

export interface AutocropOptions {
  /** Luminancia (0–255) por debajo de la cual un píxel cuenta como tinta. */
  threshold?: number;
  /** Píxeles de tinta que necesita una fila o columna para contar (filtra polvo del escaneo). */
  minInkPerLine?: number;
}

/**
 * Recibe los píxeles RGBA de un canvas y devuelve el rectángulo que encierra la tinta,
 * o `null` si la página está en blanco.
 */
export function contentBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  { threshold = 240, minInkPerLine = 2 }: AutocropOptions = {},
): Bounds | null {
  if (rgba.length !== width * height * 4) {
    throw new Error(`Se esperaban ${width * height * 4} bytes y llegaron ${rgba.length}`);
  }
  const rowInk = new Uint32Array(height);
  const colInk = new Uint32Array(width);

  for (let y = 0; y < height; y++) {
    let i = y * width * 4;
    for (let x = 0; x < width; x++, i += 4) {
      const alpha = rgba[i + 3] / 255;
      // Lo transparente se trata como papel blanco.
      const lum =
        (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * alpha + 255 * (1 - alpha);
      if (lum < threshold) {
        rowInk[y]++;
        colInk[x]++;
      }
    }
  }

  const first = (a: Uint32Array) => a.findIndex((n) => n >= minInkPerLine);
  const last = (a: Uint32Array) => a.findLastIndex((n) => n >= minInkPerLine);

  const top = first(rowInk);
  if (top === -1) return null;
  return { left: first(colInk), top, right: last(colInk) + 1, bottom: last(rowInk) + 1 };
}

/** El rectángulo más pequeño que contiene a todos: un mismo recorte para todas las páginas. */
export function unionBounds(all: (Bounds | null)[]): Bounds | null {
  const present = all.filter((b): b is Bounds => b !== null);
  if (present.length === 0) return null;
  return {
    left: Math.min(...present.map((b) => b.left)),
    top: Math.min(...present.map((b) => b.top)),
    right: Math.max(...present.map((b) => b.right)),
    bottom: Math.max(...present.map((b) => b.bottom)),
  };
}

/** Agranda el rectángulo un margen de respiro sin salirse de la página. */
export function pad(b: Bounds, px: number, width: number, height: number): Bounds {
  return {
    left: Math.max(0, b.left - px),
    top: Math.max(0, b.top - px),
    right: Math.min(width, b.right + px),
    bottom: Math.min(height, b.bottom + px),
  };
}

export const isLandscape = (b: Bounds) => b.right - b.left > b.bottom - b.top;
