import { describe, expect, it } from "vitest";
import {
  clamp,
  fromBounds,
  MIN_SIZE,
  moveEdge,
  padMm,
  pageFileName,
  toPixels,
  unionBySize,
  unionCrops,
} from "./crop";

describe("recortes como fracción de la página", () => {
  it("convierte píxeles a fracción", () => {
    expect(fromBounds({ left: 10, top: 20, right: 90, bottom: 180 }, 100, 200)).toEqual({
      x0: 0.1,
      y0: 0.1,
      x1: 0.9,
      y1: 0.9,
    });
  });

  it("agrega el margen en mm sin salirse de la hoja", () => {
    const c = padMm({ x0: 0.1, y0: 0.01, x1: 0.9, y1: 0.99 }, 10, 200, 100);
    expect(c.x0).toBeCloseTo(0.05);
    expect(c.x1).toBeCloseTo(0.95);
    expect(c.y0).toBe(0);
    expect(c.y1).toBe(1);
  });

  it("une recortes e ignora páginas en blanco", () => {
    expect(
      unionCrops([
        { x0: 0.2, y0: 0.1, x1: 0.5, y1: 0.6 },
        null,
        { x0: 0.1, y0: 0.3, x1: 0.8, y1: 0.5 },
      ]),
    ).toEqual({ x0: 0.1, y0: 0.1, x1: 0.8, y1: 0.6 });
    expect(unionCrops([null, null])).toBeNull();
  });

  it("pasa a píxeles redondeando y nunca a cero", () => {
    expect(toPixels({ x0: 0.1, y0: 0.25, x1: 0.6, y1: 0.75 }, 1000, 400)).toEqual({
      x: 100,
      y: 100,
      w: 500,
      h: 200,
    });
    expect(toPixels({ x0: 0.5, y0: 0.5, x1: 0.5, y1: 0.5 }, 10, 10).w).toBe(1);
  });

  it("no deja cruzar un borde sobre el opuesto", () => {
    const c = { x0: 0.2, y0: 0.2, x1: 0.8, y1: 0.8 };
    expect(moveEdge(c, "x0", 0.95).x0).toBeCloseTo(0.8 - MIN_SIZE);
    expect(moveEdge(c, "y1", -3).y1).toBeCloseTo(0.2 + MIN_SIZE);
    expect(moveEdge(c, "x1", 2).x1).toBe(1);
  });

  it("clamp corrige un recorte invertido o fuera de la hoja", () => {
    const c = clamp({ x0: -1, y0: 0.5, x1: 3, y1: 0.4 });
    expect(c.x0).toBe(0);
    expect(c.x1).toBe(1);
    expect(c.y1).toBeCloseTo(0.5 + MIN_SIZE);
  });
});

describe("pageFileName", () => {
  it("rellena con ceros para que el orden alfabético sea el de las páginas", () => {
    const names = [2, 10, 1].map((p) => pageFileName("anexo", p, 120, "png")).sort();
    expect(names).toEqual(["anexo-001.png", "anexo-002.png", "anexo-010.png"]);
  });

  it("usa más dígitos si hay más de 999 páginas y limpia caracteres inválidos", () => {
    expect(pageFileName("a/b:c", 7, 1500, "jpg")).toBe("a-b-c-0007.jpg");
    expect(pageFileName("  ", 1, 5, "png")).toBe("pagina-001.png");
  });
});

describe("unionBySize", () => {
  it("no mezcla hojas verticales con horizontales", () => {
    const a = { x0: 0.2, y0: 0.2, x1: 0.8, y1: 0.8 };
    const b = { x0: 0.1, y0: 0.3, x1: 0.7, y1: 0.9 };
    const c = { x0: 0.05, y0: 0.05, x1: 0.95, y1: 0.5 };
    const res = unionBySize([
      { widthMm: 215.9, heightMm: 279.4, auto: a },
      { widthMm: 279.4, heightMm: 215.9, auto: c },
      { widthMm: 215.9, heightMm: 279.4, auto: b },
    ]);
    expect(res["216x279"]).toEqual({ x0: 0.1, y0: 0.2, x1: 0.8, y1: 0.9 });
    expect(res["279x216"]).toEqual(c);
  });
});
