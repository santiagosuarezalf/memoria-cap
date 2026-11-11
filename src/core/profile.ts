// Perfiles: toda la configuración en un .json que se puede guardar, compartir y volver a cargar
// (por ejemplo "ETABS carta"). También lee los .vic de ImageCap.

import { type Crop, clamp } from "./crop";
import type { Mask } from "./mask";
import { MASK_COLORS } from "./mask";
import type { ImageFormat } from "./render";
import type { MarginsMm, Numbering } from "./vectorpdf";

export interface Settings {
  mode: "all" | "page";
  paddingMm: number;
  skipRepeated: boolean;
  /** Recorte manual del modo "todas", por tamaño de hoja ("216x279"). */
  globalCrops: Record<string, Crop>;
  dpi: number;
  format: ImageFormat;
  landscapeMode: "rotate" | "section";
  maxHeightMm: number;
  pdfMargins: MarginsMm;
  numbering: Numbering | null;
  masks: Mask[];
}

const FORMAT_TAG = "memoriacap-perfil";
const VERSION = 1;

export function serializeProfile(s: Settings): string {
  return JSON.stringify({ formato: FORMAT_TAG, version: VERSION, ...s }, null, 2);
}

const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const isCrop = (c: unknown): c is Crop =>
  typeof c === "object" &&
  c !== null &&
  ["x0", "y0", "x1", "y1"].every((k) => typeof (c as Record<string, unknown>)[k] === "number");

/**
 * Lee un perfil y completa con los valores por defecto lo que falte o venga dañado. Así un perfil
 * viejo o editado a mano nunca deja la app en un estado inválido.
 */
export function parseProfile(text: string, defaults: Settings): Settings {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un perfil válido");
  }
  if (raw?.formato !== FORMAT_TAG) throw new Error("El archivo no es un perfil de MemoriaCap");

  const crops: Record<string, Crop> = {};
  if (typeof raw.globalCrops === "object" && raw.globalCrops) {
    for (const [k, v] of Object.entries(raw.globalCrops)) if (isCrop(v)) crops[k] = clamp(v);
  }
  const margins = (raw.pdfMargins ?? {}) as Partial<MarginsMm>;
  const masks = Array.isArray(raw.masks)
    ? (raw.masks as Mask[]).filter(
        (m) =>
          m &&
          isCrop(m.rect) &&
          m.color in MASK_COLORS &&
          (m.pages?.kind === "all" || m.pages?.kind === "range"),
      )
    : defaults.masks;
  const n = raw.numbering as Partial<Numbering> | null | undefined;

  return {
    mode: raw.mode === "page" ? "page" : raw.mode === "all" ? "all" : defaults.mode,
    paddingMm: num(raw.paddingMm, 0, 30, defaults.paddingMm),
    skipRepeated: typeof raw.skipRepeated === "boolean" ? raw.skipRepeated : defaults.skipRepeated,
    globalCrops: crops,
    dpi: num(raw.dpi, 72, 600, defaults.dpi),
    format: raw.format === "jpg" ? "jpg" : raw.format === "png" ? "png" : defaults.format,
    landscapeMode:
      raw.landscapeMode === "section" || raw.landscapeMode === "rotate"
        ? raw.landscapeMode
        : defaults.landscapeMode,
    maxHeightMm: num(raw.maxHeightMm, 50, 600, defaults.maxHeightMm),
    pdfMargins: {
      top: num(margins.top, 0, 150, defaults.pdfMargins.top),
      bottom: num(margins.bottom, 0, 150, defaults.pdfMargins.bottom),
      left: num(margins.left, 0, 150, defaults.pdfMargins.left),
      right: num(margins.right, 0, 150, defaults.pdfMargins.right),
    },
    numbering:
      n === null
        ? null
        : n && typeof n.format === "string"
          ? {
              format: n.format,
              startAt: num(n.startAt, 1, 100_000, 1),
              position: n.position === "left" || n.position === "center" ? n.position : "right",
              bottomMm: num(n.bottomMm, 3, 60, 12),
              sideMm: num(n.sideMm, 0, 100, 20),
              sizePt: num(n.sizePt, 6, 24, 10),
            }
          : defaults.numbering,
    masks,
  };
}

/** Lo que se puede sacar de un .vic de ImageCap. */
export interface VicSettings {
  /** Márgenes de recorte en mm (ImageCap los guardaba en píxeles a la resolución elegida). */
  marginsMm: MarginsMm;
  dpi: number;
  format: ImageFormat;
  /** Altura fija en el Word, si estaba activada. */
  maxHeightMm: number | null;
}

/**
 * Formato .vic (texto, una línea por valor):
 * encabezado, sup, inf, izq, der (px), resolución (dpi, 0 = 100), zoom %, redimensionar,
 * formato (.jpg/.png/.pnm/.pgm), fijar altura (True/False), altura en mm.
 * Los .vic más viejos traen solo las primeras líneas.
 */
export function parseVic(text: string): VicSettings {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (lines[0] !== "VARIABLES-RECORTES-IMAGECAP") {
    throw new Error("El archivo no es un .vic de ImageCap");
  }
  const int = (i: number) => {
    const n = Number.parseInt(lines[i] ?? "", 10);
    return Number.isFinite(n) ? n : null;
  };
  const [sup, inf, izq, der] = [int(1), int(2), int(3), int(4)];
  if (sup === null || inf === null || izq === null || der === null) {
    throw new Error("El .vic no trae los cuatro márgenes de recorte");
  }
  const dpi = int(5) || 100; // ImageCap usaba 100 si venía en 0
  const toMm = (px: number) => (px / dpi) * 25.4;
  const fixed = lines[9] === "True";
  const height = int(10);
  return {
    marginsMm: { top: toMm(sup), bottom: toMm(inf), left: toMm(izq), right: toMm(der) },
    dpi: Math.min(600, Math.max(72, dpi)),
    format: lines[8] === ".png" || lines[8] === ".pnm" || lines[8] === ".pgm" ? "png" : "jpg",
    maxHeightMm: fixed && height ? height : null,
  };
}

/** Pasa márgenes de recorte en mm a un recorte en fracciones de una hoja de ese tamaño. */
export function cropFromMarginsMm(m: MarginsMm, pageWidthMm: number, pageHeightMm: number): Crop {
  return clamp({
    x0: m.left / pageWidthMm,
    y0: m.top / pageHeightMm,
    x1: 1 - m.right / pageWidthMm,
    y1: 1 - m.bottom / pageHeightMm,
  });
}

const LAST_KEY = "memoriacap:ultima-configuracion";

/** La última configuración usada en este equipo, o null (también si el almacenamiento falla). */
export function loadLastSettings(defaults: Settings): Settings | null {
  try {
    const text = localStorage.getItem(LAST_KEY);
    return text ? parseProfile(text, defaults) : null;
  } catch {
    return null;
  }
}

export function saveLastSettings(serialized: string) {
  try {
    localStorage.setItem(LAST_KEY, serialized);
  } catch {
    // Sin almacenamiento la app funciona igual; solo no recuerda la configuración.
  }
}
