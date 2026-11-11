// Todo lo que el usuario configura se guarda en milímetros, para que no dependa de la
// resolución con la que se rasteriza (en ImageCap las medidas eran píxeles a un DPI dado).

export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;

export const mmToPt = (mm: number) => (mm / MM_PER_INCH) * PT_PER_INCH;
export const ptToMm = (pt: number) => (pt / PT_PER_INCH) * MM_PER_INCH;
export const pxToMm = (px: number, dpi: number) => (px / dpi) * MM_PER_INCH;
export const mmToPx = (mm: number, dpi: number) => (mm / MM_PER_INCH) * dpi;

/** Word mide las imágenes en EMU: 914 400 por pulgada. */
export const mmToEmu = (mm: number) => Math.round((mm / MM_PER_INCH) * 914_400);
