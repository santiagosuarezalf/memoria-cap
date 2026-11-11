// Máscaras: rectángulos de color que tapan una zona de la página (un logo, una marca de agua del
// programa). Se guardan como fracción de la página, igual que el recorte, para que no dependan de
// la resolución.

import type { Crop } from "./crop";

export interface Mask {
  id: string;
  rect: Crop;
  color: MaskColor;
  /** A qué páginas aplica (numeradas desde 1). */
  pages: { kind: "all" } | { kind: "range"; from: number; to: number };
}

export const MASK_COLORS = {
  white: { label: "Blanco", rgb: [255, 255, 255] },
  black: { label: "Negro", rgb: [0, 0, 0] },
  gray: { label: "Gris", rgb: [128, 128, 128] },
  yellow: { label: "Amarillo", rgb: [255, 230, 0] },
} as const;

export type MaskColor = keyof typeof MASK_COLORS;

export const cssColor = (c: MaskColor) => `rgb(${MASK_COLORS[c].rgb.join(",")})`;

export function appliesTo(mask: Mask, page: number): boolean {
  return mask.pages.kind === "all" || (page >= mask.pages.from && page <= mask.pages.to);
}

export function newMask(page: number, color: MaskColor = "white"): Mask {
  return {
    id: Math.random().toString(36).slice(2, 10),
    rect: { x0: 0.4, y0: 0.45, x1: 0.6, y1: 0.55 },
    color,
    pages: { kind: "range", from: page, to: page },
  };
}

/** Desplaza un rectángulo sin cambiar su tamaño ni sacarlo de la hoja. */
export function moveRect(r: Crop, dx: number, dy: number): Crop {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const x0 = Math.min(Math.max(0, r.x0 + dx), 1 - w);
  const y0 = Math.min(Math.max(0, r.y0 + dy), 1 - h);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

/** La parte de la máscara que cae dentro del recorte, en fracciones del recorte; o null. */
export function maskWithinCrop(mask: Crop, crop: Crop): Crop | null {
  const x0 = Math.max(mask.x0, crop.x0);
  const y0 = Math.max(mask.y0, crop.y0);
  const x1 = Math.min(mask.x1, crop.x1);
  const y1 = Math.min(mask.y1, crop.y1);
  if (x1 <= x0 || y1 <= y0) return null;
  const w = crop.x1 - crop.x0;
  const h = crop.y1 - crop.y0;
  return {
    x0: (x0 - crop.x0) / w,
    y0: (y0 - crop.y0) / h,
    x1: (x1 - crop.x0) / w,
    y1: (y1 - crop.y0) / h,
  };
}

/** Gira un rectángulo (fracciones) 90° antihorario, igual que la imagen girada. */
export function rotateRectLeft(r: Crop): Crop {
  return { x0: r.y0, y0: 1 - r.x1, x1: r.y1, y1: 1 - r.x0 };
}

/** Pinta las máscaras de una página sobre su imagen completa (antes de recortar). */
export function paintMasks(
  ctx: CanvasRenderingContext2D,
  masks: Mask[],
  page: number,
  width: number,
  height: number,
) {
  for (const m of masks) {
    if (!appliesTo(m, page)) continue;
    ctx.fillStyle = cssColor(m.color);
    ctx.fillRect(
      m.rect.x0 * width,
      m.rect.y0 * height,
      (m.rect.x1 - m.rect.x0) * width,
      (m.rect.y1 - m.rect.y0) * height,
    );
  }
}
