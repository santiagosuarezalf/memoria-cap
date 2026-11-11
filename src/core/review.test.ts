import { describe, expect, it } from "vitest";
import { cuts, type ReviewInput, reviewReasons } from "./review";

const base: ReviewInput = {
  widthMm: 216,
  heightMm: 279,
  bandCount: 3,
  content: { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.8 },
  crop: { x0: 0.08, y0: 0.08, x1: 0.92, y1: 0.82 },
  hadRepeated: true,
  documentHasRepeated: true,
};

describe("reviewReasons", () => {
  it("una página normal no necesita revisión", () => {
    expect(reviewReasons(base)).toEqual([]);
  });

  it("avisa cuando el recorte deja contenido por fuera", () => {
    expect(reviewReasons({ ...base, crop: { ...base.crop, y1: 0.7 } })).toEqual(["cut"]);
  });

  it("marca la portada, que no trae el encabezado del programa", () => {
    expect(reviewReasons({ ...base, hadRepeated: false })).toEqual(["noHeader"]);
  });

  it("no habla de encabezado si el documento no tiene ninguno repetido", () => {
    expect(reviewReasons({ ...base, hadRepeated: false, documentHasRepeated: false })).toEqual([]);
  });

  it("marca las páginas en blanco y las horizontales", () => {
    expect(reviewReasons({ ...base, bandCount: 0, content: null, hadRepeated: false })).toEqual([
      "blank",
    ]);
    expect(reviewReasons({ ...base, widthMm: 279, heightMm: 216 })).toEqual(["landscape"]);
  });
});

it("cuts tolera diferencias de menos de medio milímetro", () => {
  const crop = { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9 };
  expect(cuts(crop, { x0: 0.099, y0: 0.1, x1: 0.9, y1: 0.9 })).toBe(false);
  expect(cuts(crop, { x0: 0.09, y0: 0.1, x1: 0.9, y1: 0.9 })).toBe(true);
});
