// Qué páginas merecen una mirada antes de exportar. La idea es que el ingeniero no tenga que pasar
// página por página: la app le señala las pocas que pueden salir mal.

import type { Crop } from "./crop";

export type ReviewReason = "cut" | "blank" | "noHeader" | "landscape";

export const REASON_LABELS: Record<ReviewReason, string> = {
  cut: "El recorte corta contenido",
  blank: "En blanco",
  noHeader: "Sin el encabezado del programa",
  landscape: "Horizontal",
};

export interface ReviewInput {
  widthMm: number;
  heightMm: number;
  /** Cuántos bloques de contenido tiene (0 = en blanco). */
  bandCount: number;
  /** Contenido de la página (sin encabezado ni pie si se quitaron), o null si está en blanco. */
  content: Crop | null;
  /** El recorte que se le va a aplicar. */
  crop: Crop;
  /** ¿Esta página traía el encabezado o el pie que se repite? */
  hadRepeated: boolean;
  /** ¿Se detectó encabezado o pie repetido en el documento? */
  documentHasRepeated: boolean;
}

/** Medio milímetro largo en una carta: por debajo de eso no se considera que corte. */
const TOLERANCE = 0.002;

export function reviewReasons(p: ReviewInput): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  const blank = p.bandCount === 0;
  if (p.content && cuts(p.crop, p.content)) reasons.push("cut");
  if (blank) reasons.push("blank");
  if (!blank && p.documentHasRepeated && !p.hadRepeated) reasons.push("noHeader");
  if (p.widthMm > p.heightMm) reasons.push("landscape");
  return reasons;
}

/** ¿Queda contenido por fuera del recorte? */
export function cuts(crop: Crop, content: Crop): boolean {
  return (
    content.x0 < crop.x0 - TOLERANCE ||
    content.y0 < crop.y0 - TOLERANCE ||
    content.x1 > crop.x1 + TOLERANCE ||
    content.y1 > crop.y1 + TOLERANCE
  );
}
