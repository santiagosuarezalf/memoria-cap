// PDF de salida sin rasterizar: cada página recortada se copia como objeto vectorial (Form XObject)
// y se monta, escalada, sobre una hoja membretada. Los números quedan nítidos a cualquier zoom y el
// archivo pesa una fracción de lo que pesan las imágenes.

import {
  degrees,
  PDFDocument,
  type PDFEmbeddedPage,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import type { Crop } from "./crop";
import type { PageSetup } from "./docx";
import { maskWithinCrop, rotateRectLeft } from "./mask";
import { mmToPt } from "./units";

export interface MarginsMm {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface VectorPage {
  /** Recorte en fracciones de la página tal como se ve (ya rotada). */
  crop: Crop;
  /**
   * Rectángulos que se tapan, en fracciones de la página. Ojo: en un PDF vectorial la máscara se
   * dibuja encima y tapa a la vista, pero el texto de debajo sigue en el archivo.
   */
  masks?: { rect: Crop; rgb: readonly [number, number, number] }[];
}

export interface VectorOptions {
  margins: MarginsMm;
  /** Qué hacer con las páginas horizontales. */
  landscapeMode: "rotate" | "section";
  /** PDF con la hoja membretada: la primera hoja vertical y, si la hay, la primera horizontal. */
  letterhead?: Uint8Array;
  /** Numerar las hojas (el membrete es fijo y no puede llevar el número). */
  numbering?: Numbering;
}

export interface Numbering {
  /** Texto con {n} (número de la hoja) y {total}. */
  format: string;
  /** Número de la primera hoja: un anexo suele empezar en mitad del informe. */
  startAt: number;
  position: "left" | "center" | "right";
  /** Distancia del borde inferior de la hoja a la base del texto. */
  bottomMm: number;
  /** Distancia del borde lateral (no aplica si va centrado). */
  sideMm: number;
  sizePt: number;
}

export const DEFAULT_NUMBERING: Numbering = {
  format: "{n}",
  startAt: 1,
  position: "right",
  bottomMm: 12,
  sideMm: 20,
  sizePt: 10,
};

/** Arma el texto del número. El total es el número de la última hoja, no la cantidad. */
export function formatPageNumber(format: string, index: number, count: number, startAt: number) {
  return format
    .replaceAll("{n}", String(startAt + index))
    .replaceAll("{total}", String(startAt + count - 1));
}

const LETTER: [number, number] = [612, 792];

/** Pie de página mínimo: Word lo dibuja dentro del margen inferior aunque este sea pequeño. */
const MIN_BOTTOM_MM = 20;

/** Márgenes del PDF a partir de la configuración de la plantilla de Word. */
export function marginsFrom(s: PageSetup): MarginsMm {
  return {
    top: s.marginTopMm,
    bottom: Math.max(s.marginBottomMm, MIN_BOTTOM_MM),
    left: s.marginLeftMm,
    right: s.marginRightMm,
  };
}

export interface PdfBox {
  left: number;
  bottom: number;
  right: number;
  top: number;
}

/**
 * Pasa un recorte (fracciones de la página como se ve, origen arriba a la izquierda) a un
 * rectángulo en el espacio sin rotar de la página, que es el que entiende `embedPage`.
 * `rotation` es el /Rotate de la página (giro horario al mostrarla).
 */
export function cropToPdfBox(
  crop: Crop,
  media: { x: number; y: number; width: number; height: number },
  rotation: number,
): PdfBox {
  const { x: mx, y: my, width: W, height: H } = media;
  const r = ((rotation % 360) + 360) % 360;
  // Punto visible (u, v) → punto sin rotar (x, y)
  const map = (u: number, v: number): [number, number] => {
    switch (r) {
      case 90:
        return [mx + v * W, my + u * H];
      case 180:
        return [mx + (1 - u) * W, my + v * H];
      case 270:
        return [mx + (1 - v) * W, my + (1 - u) * H];
      default:
        return [mx + u * W, my + (1 - v) * H];
    }
  };
  const a = map(crop.x0, crop.y0);
  const b = map(crop.x1, crop.y1);
  return {
    left: Math.min(a[0], b[0]),
    right: Math.max(a[0], b[0]),
    bottom: Math.min(a[1], b[1]),
    top: Math.max(a[1], b[1]),
  };
}

/**
 * Dónde y cómo dibujar un objeto de w×h (sin rotar) para que, girado `angle` grados en sentido
 * antihorario, ocupe exactamente el rectángulo que empieza en (X, Y) abajo a la izquierda.
 * pdf-lib gira alrededor del punto de inserción, así que hay que corregirlo.
 */
export function placeRotated(X: number, Y: number, w: number, h: number, angle: number) {
  switch (((angle % 360) + 360) % 360) {
    case 90:
      return { x: X + h, y: Y };
    case 180:
      return { x: X + w, y: Y + h };
    case 270:
      return { x: X, y: Y + w };
    default:
      return { x: X, y: Y };
  }
}

/** Escala para que un rectángulo quepa en otro (agranda o achica; es vectorial). */
export const fitScale = (w: number, h: number, boxW: number, boxH: number) =>
  Math.min(boxW / w, boxH / h);

export async function buildVectorPdf(
  source: Uint8Array,
  pages: VectorPage[],
  opts: VectorOptions,
): Promise<Uint8Array> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(source, { ignoreEncryption: true });
  } catch {
    throw new Error("No se pudo leer el PDF de origen para copiarlo en vectorial");
  }
  if (pages.length !== src.getPageCount()) {
    throw new Error("El número de recortes no coincide con las páginas del PDF");
  }
  const out = await PDFDocument.create();

  // Hoja membretada: vertical y, si viene, horizontal.
  let portraitBg: { page: PDFEmbeddedPage; size: [number, number] } | null = null;
  let landscapeBg: { page: PDFEmbeddedPage; size: [number, number] } | null = null;
  if (opts.letterhead) {
    let lh: PDFDocument;
    try {
      lh = await PDFDocument.load(opts.letterhead, { ignoreEncryption: true });
    } catch {
      throw new Error("No se pudo leer el PDF de la hoja membretada");
    }
    for (const p of lh.getPages()) {
      const { width, height } = p.getSize();
      const rotated = p.getRotation().angle % 180 !== 0;
      const isLandscape = rotated ? height > width : width > height;
      // Membretes girados (poco comunes) u hojas vacías: se ignoran.
      if (rotated || !p.node.Contents()) continue;
      if (!isLandscape && !portraitBg)
        portraitBg = { page: await out.embedPage(p), size: [width, height] };
      if (isLandscape && !landscapeBg)
        landscapeBg = { page: await out.embedPage(p), size: [width, height] };
    }
    if (!portraitBg && !landscapeBg) throw new Error("La hoja membretada no tiene páginas");
  }

  const font = opts.numbering ? await out.embedFont(StandardFonts.Helvetica) : null;

  const m = {
    top: mmToPt(opts.margins.top),
    bottom: mmToPt(opts.margins.bottom),
    left: mmToPt(opts.margins.left),
    right: mmToPt(opts.margins.right),
  };

  // Todas las páginas con contenido se incrustan en una sola llamada: así pdf-lib usa un único
  // copiador y las fuentes que comparten se copian una vez (página por página, un reporte de ETABS
  // de 348 KB salía de 8 MB). Las páginas en blanco no tienen contenido y no se pueden incrustar.
  const srcPages = src.getPages();
  const boxes = srcPages.map((p, i) =>
    cropToPdfBox(pages[i].crop, p.getMediaBox(), p.getRotation().angle),
  );
  const withContent = srcPages.map((_, i) => i).filter((i) => srcPages[i].node.Contents());
  const embeddedList = await out.embedPages(
    withContent.map((i) => srcPages[i]),
    withContent.map((i) => boxes[i]),
  );
  const embeddedByPage = new Map(withContent.map((i, k) => [i, embeddedList[k]]));

  for (let i = 0; i < pages.length; i++) {
    const srcPage: PDFPage = srcPages[i];
    const rotation = srcPage.getRotation().angle;
    const media = srcPage.getMediaBox();
    const box = boxes[i];

    const visW = rotation % 180 === 0 ? media.width : media.height;
    const visH = rotation % 180 === 0 ? media.height : media.width;
    const isLandscape = visW > visH;
    const turn = isLandscape && opts.landscapeMode === "rotate";
    const landscapeSheet = isLandscape && opts.landscapeMode === "section";

    // Hoja de salida
    const bg = landscapeSheet ? landscapeBg : portraitBg;
    const size: [number, number] = bg ? bg.size : landscapeSheet ? [LETTER[1], LETTER[0]] : LETTER;
    const page = out.addPage(size);
    if (bg) page.drawPage(bg.page, { x: 0, y: 0, width: size[0], height: size[1] });
    if (opts.numbering && font) {
      const n = opts.numbering;
      const text = formatPageNumber(n.format, i, pages.length, n.startAt);
      let width: number;
      try {
        width = font.widthOfTextAtSize(text, n.sizePt);
      } catch {
        throw new Error(
          `El texto del número tiene caracteres que no se pueden escribir: «${text}»`,
        );
      }
      const side = mmToPt(n.sideMm);
      const x =
        n.position === "left"
          ? side
          : n.position === "center"
            ? (size[0] - width) / 2
            : size[0] - side - width;
      page.drawText(text, { x, y: mmToPt(n.bottomMm), size: n.sizePt, font });
    }

    // Página en blanco: queda solo la hoja membretada.
    const embedded = embeddedByPage.get(i);
    if (!embedded) continue;

    // Contenido: sin rotar mide bw×bh; se gira para enderezarlo (y otros 90° si se pide girar).
    const bw = box.right - box.left;
    const bh = box.top - box.bottom;
    const angle = (360 - rotation + (turn ? 90 : 0)) % 360;
    const sideways = angle % 180 !== 0;
    const occW = sideways ? bh : bw;
    const occH = sideways ? bw : bh;

    const areaW = size[0] - m.left - m.right;
    const areaH = size[1] - m.top - m.bottom;
    if (areaW <= 0 || areaH <= 0) throw new Error("Los márgenes no dejan espacio en la hoja");
    const k = fitScale(occW, occH, areaW, areaH);
    // Centrado horizontal, pegado arriba (como en el Word).
    const X = m.left + (areaW - occW * k) / 2;
    const Y = size[1] - m.top - occH * k;
    const at = placeRotated(X, Y, bw * k, bh * k, angle);
    page.drawPage(embedded, {
      x: at.x,
      y: at.y,
      xScale: k,
      yScale: k,
      rotate: degrees(angle),
    });

    // Máscaras: encima del contenido, en el rectángulo que ocupa la página ya enderezada.
    for (const mask of pages[i].masks ?? []) {
      const inside = maskWithinCrop(mask.rect, pages[i].crop);
      if (!inside) continue;
      const r = turn ? rotateRectLeft(inside) : inside;
      const W = occW * k;
      const H = occH * k;
      page.drawRectangle({
        x: X + r.x0 * W,
        y: Y + (1 - r.y1) * H,
        width: (r.x1 - r.x0) * W,
        height: (r.y1 - r.y0) * H,
        color: rgb(mask.rgb[0] / 255, mask.rgb[1] / 255, mask.rgb[2] / 255),
      });
    }
  }

  return out.save();
}
