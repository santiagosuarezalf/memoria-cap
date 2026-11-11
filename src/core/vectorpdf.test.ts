import { degrees, PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildVectorPdf, cropToPdfBox, fitScale, placeRotated } from "./vectorpdf";

const media = { x: 10, y: 20, width: 600, height: 800 };
const crop = { x0: 0.1, y0: 0.2, x1: 0.5, y1: 0.6 };

describe("cropToPdfBox", () => {
  it("sin rotación: invierte el eje vertical y suma el origen de la página", () => {
    expect(cropToPdfBox(crop, media, 0)).toEqual({
      left: 10 + 60,
      right: 10 + 300,
      bottom: 20 + 0.4 * 800,
      top: 20 + 0.8 * 800,
    });
  });

  it("rotada 90°: lo visible a la izquierda es lo de abajo sin rotar", () => {
    // Se ve como hoja de 800×600; x0 visible = 0.1 de 800 en el eje y sin rotar
    const b = cropToPdfBox(crop, media, 90);
    expect(b.bottom).toBeCloseTo(20 + 0.1 * 800);
    expect(b.top).toBeCloseTo(20 + 0.5 * 800);
    expect(b.left).toBeCloseTo(10 + 0.2 * 600);
    expect(b.right).toBeCloseTo(10 + 0.6 * 600);
  });

  it("rotada 180° y 270° quedan dentro de la página y del tamaño correcto", () => {
    for (const r of [180, 270, -90]) {
      const b = cropToPdfBox(crop, media, r);
      expect(b.left).toBeGreaterThanOrEqual(10);
      expect(b.right).toBeLessThanOrEqual(610);
      expect(b.bottom).toBeGreaterThanOrEqual(20);
      expect(b.top).toBeLessThanOrEqual(820);
      const area = (b.right - b.left) * (b.top - b.bottom);
      expect(area).toBeCloseTo(0.4 * 0.4 * 600 * 800);
    }
  });

  it("la página completa sin rotar es la caja de medios", () => {
    expect(cropToPdfBox({ x0: 0, y0: 0, x1: 1, y1: 1 }, media, 0)).toEqual({
      left: 10,
      right: 610,
      bottom: 20,
      top: 820,
    });
  });
});

describe("placeRotated y fitScale", () => {
  it("corrige el punto de inserción según el giro", () => {
    expect(placeRotated(5, 7, 100, 50, 0)).toEqual({ x: 5, y: 7 });
    expect(placeRotated(5, 7, 100, 50, 90)).toEqual({ x: 55, y: 7 });
    expect(placeRotated(5, 7, 100, 50, 180)).toEqual({ x: 105, y: 57 });
    expect(placeRotated(5, 7, 100, 50, 270)).toEqual({ x: 5, y: 107 });
  });

  it("escala para caber, agrandando o achicando", () => {
    expect(fitScale(100, 200, 300, 300)).toBe(1.5);
    expect(fitScale(400, 100, 200, 200)).toBe(0.5);
  });
});

async function sourcePdf({ blankLast = false } = {}) {
  const d = await PDFDocument.create();
  const ink = (p: ReturnType<typeof d.addPage>) =>
    p.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
  ink(d.addPage([612, 792])); // carta vertical
  ink(d.addPage([792, 612])); // horizontal
  const third = d.addPage([612, 792]);
  third.setRotation(degrees(90)); // se ve horizontal
  if (!blankLast) ink(third);
  return d.save();
}

async function letterhead() {
  const d = await PDFDocument.create();
  // Encabezado: una franja arriba en cada hoja
  d.addPage([612, 792]).drawRectangle({ x: 0, y: 760, width: 612, height: 32 });
  d.addPage([792, 612]).drawRectangle({ x: 0, y: 580, width: 792, height: 32 });
  return d.save();
}

const full = { crop: { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9 } };
const margins = { top: 30, bottom: 25, left: 20, right: 15 };

describe("buildVectorPdf", () => {
  it("girando las horizontales, todas las hojas quedan verticales", async () => {
    const bytes = await buildVectorPdf(await sourcePdf(), [full, full, full], {
      margins,
      landscapeMode: "rotate",
    });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(3);
    for (const p of out.getPages()) expect(p.getSize()).toEqual({ width: 612, height: 792 });
  });

  it("en hoja horizontal usa la hoja membretada horizontal", async () => {
    const bytes = await buildVectorPdf(await sourcePdf(), [full, full, full], {
      margins,
      landscapeMode: "section",
      letterhead: await letterhead(),
    });
    const out = await PDFDocument.load(bytes);
    const sizes = out.getPages().map((p) => p.getSize().width > p.getSize().height);
    expect(sizes).toEqual([false, true, true]); // la tercera tiene /Rotate 90: se ve horizontal
  });

  it("no rasteriza: el resultado no contiene imágenes", async () => {
    const bytes = await buildVectorPdf(await sourcePdf(), [full, full, full], {
      margins,
      landscapeMode: "rotate",
    });
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).not.toMatch(/\/Subtype\s*\/Image/);
    expect(text).toMatch(/\/Subtype\s*\/Form/);
  });

  it("una página en blanco sale como hoja membretada vacía, sin fallar", async () => {
    const bytes = await buildVectorPdf(await sourcePdf({ blankLast: true }), [full, full, full], {
      margins,
      landscapeMode: "rotate",
      letterhead: await letterhead(),
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  });

  it("avisa si los márgenes no dejan espacio", async () => {
    await expect(
      buildVectorPdf(await sourcePdf(), [full, full, full], {
        margins: { top: 200, bottom: 200, left: 10, right: 10 },
        landscapeMode: "rotate",
      }),
    ).rejects.toThrow(/márgenes/);
  });

  it("rechaza un número de recortes distinto al de páginas", async () => {
    await expect(
      buildVectorPdf(await sourcePdf(), [full], { margins, landscapeMode: "rotate" }),
    ).rejects.toThrow(/páginas/);
  });
});
