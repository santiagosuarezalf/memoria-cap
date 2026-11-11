import type { Bounds } from "./autocrop";

/**
 * Recorte como fracción de la página (0–1 en cada eje, origen arriba a la izquierda).
 * Así no depende de la resolución con que se rasterice ni del tamaño de la hoja.
 */
export interface Crop {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const FULL_PAGE: Crop = { x0: 0, y0: 0, x1: 1, y1: 1 };

/** Ancho mínimo de un recorte, para que arrastrar un borde no lo deje en cero. */
export const MIN_SIZE = 0.02;

export function fromBounds(b: Bounds, width: number, height: number): Crop {
  return { x0: b.left / width, y0: b.top / height, x1: b.right / width, y1: b.bottom / height };
}

/** Agranda el recorte un margen en mm, sin salirse de la hoja. */
export function padMm(c: Crop, mm: number, pageWidthMm: number, pageHeightMm: number): Crop {
  const dx = mm / pageWidthMm;
  const dy = mm / pageHeightMm;
  return clamp({ x0: c.x0 - dx, y0: c.y0 - dy, x1: c.x1 + dx, y1: c.y1 + dy });
}

export function clamp(c: Crop): Crop {
  const x0 = Math.min(Math.max(0, c.x0), 1 - MIN_SIZE);
  const y0 = Math.min(Math.max(0, c.y0), 1 - MIN_SIZE);
  return {
    x0,
    y0,
    x1: Math.max(Math.min(1, c.x1), x0 + MIN_SIZE),
    y1: Math.max(Math.min(1, c.y1), y0 + MIN_SIZE),
  };
}

/** El recorte más pequeño que contiene a todos; las páginas en blanco (null) no cuentan. */
export function unionCrops(all: (Crop | null)[]): Crop | null {
  const present = all.filter((c): c is Crop => c !== null);
  if (present.length === 0) return null;
  return {
    x0: Math.min(...present.map((c) => c.x0)),
    y0: Math.min(...present.map((c) => c.y0)),
    x1: Math.max(...present.map((c) => c.x1)),
    y1: Math.max(...present.map((c) => c.y1)),
  };
}

/** Rectángulo en píxeles de un recorte sobre una imagen de width×height. */
export function toPixels(c: Crop, width: number, height: number) {
  const x = Math.round(c.x0 * width);
  const y = Math.round(c.y0 * height);
  return {
    x,
    y,
    w: Math.max(1, Math.round(c.x1 * width) - x),
    h: Math.max(1, Math.round(c.y1 * height) - y),
  };
}

export type Edge = "x0" | "y0" | "x1" | "y1";

/** Mueve un borde a una posición (fracción) respetando el tamaño mínimo. */
export function moveEdge(c: Crop, edge: Edge, value: number): Crop {
  const v = Math.min(Math.max(0, value), 1);
  switch (edge) {
    case "x0":
      return { ...c, x0: Math.min(v, c.x1 - MIN_SIZE) };
    case "x1":
      return { ...c, x1: Math.max(v, c.x0 + MIN_SIZE) };
    case "y0":
      return { ...c, y0: Math.min(v, c.y1 - MIN_SIZE) };
    case "y1":
      return { ...c, y1: Math.max(v, c.y0 + MIN_SIZE) };
  }
}

/** Nombre de archivo con relleno de ceros, para que el orden alfabético sea el de las páginas. */
export function pageFileName(base: string, page: number, total: number, ext: string): string {
  const digits = Math.max(3, String(total).length);
  const clean = base.trim().replace(/[/:*?"<>|]+/g, "-") || "pagina";
  return `${clean}-${String(page).padStart(digits, "0")}.${ext}`;
}

/** Hojas del mismo tamaño y orientación comparten clave (redondeada al mm). */
export const sizeKey = (widthMm: number, heightMm: number) =>
  `${Math.round(widthMm)}x${Math.round(heightMm)}`;

/**
 * "Mismo recorte para todas" solo tiene sentido entre hojas iguales: una carta vertical y una
 * horizontal no comparten márgenes. Devuelve la unión de recortes de cada tamaño de hoja.
 */
export function unionBySize(
  pages: { widthMm: number; heightMm: number; auto: Crop | null }[],
): Record<string, Crop | null> {
  const groups: Record<string, (Crop | null)[]> = {};
  for (const p of pages) {
    const key = sizeKey(p.widthMm, p.heightMm);
    groups[key] = [...(groups[key] ?? []), p.auto];
  }
  return Object.fromEntries(Object.entries(groups).map(([k, cs]) => [k, unionCrops(cs)]));
}
