import { describe, expect, it } from "vitest";
import { appliesTo, type Mask, maskWithinCrop, moveRect, newMask, rotateRectLeft } from "./mask";

describe("máscaras", () => {
  it("aplica a todas o a un rango de páginas", () => {
    const all: Mask = { ...newMask(1), pages: { kind: "all" } };
    const range: Mask = { ...newMask(1), pages: { kind: "range", from: 3, to: 5 } };
    expect(appliesTo(all, 40)).toBe(true);
    expect([2, 3, 5, 6].map((p) => appliesTo(range, p))).toEqual([false, true, true, false]);
  });

  it("una máscara nueva empieza solo en la página actual", () => {
    expect(newMask(7).pages).toEqual({ kind: "range", from: 7, to: 7 });
  });

  it("se mueve sin cambiar de tamaño ni salirse de la hoja", () => {
    const r = moveRect({ x0: 0.8, y0: 0.1, x1: 0.9, y1: 0.3 }, 0.5, -0.5);
    expect(r.x0).toBeCloseTo(0.9);
    expect(r.x1).toBeCloseTo(1);
    expect(r.y0).toBeCloseTo(0);
    expect(r.y1).toBeCloseTo(0.2);
  });

  it("se pasa a coordenadas del recorte y se descarta si queda fuera", () => {
    const crop = { x0: 0.2, y0: 0.2, x1: 0.6, y1: 0.6 };
    const inside = maskWithinCrop({ x0: 0.3, y0: 0.1, x1: 0.4, y1: 0.4 }, crop);
    expect(inside?.x0).toBeCloseTo(0.25);
    expect(inside?.y0).toBeCloseTo(0);
    expect(inside?.x1).toBeCloseTo(0.5);
    expect(inside?.y1).toBeCloseTo(0.5);
    expect(maskWithinCrop({ x0: 0.7, y0: 0.7, x1: 0.9, y1: 0.9 }, crop)).toBeNull();
  });

  it("al girar a la izquierda, lo de arriba queda a la izquierda", () => {
    // franja arriba a lo ancho → franja a la izquierda a lo alto
    expect(rotateRectLeft({ x0: 0, y0: 0, x1: 1, y1: 0.1 })).toEqual({
      x0: 0,
      y0: 0,
      x1: 0.1,
      y1: 1,
    });
    // esquina superior derecha → esquina superior izquierda
    expect(rotateRectLeft({ x0: 0.9, y0: 0, x1: 1, y1: 0.1 })).toEqual({
      x0: 0,
      y0: 0,
      x1: 0.1,
      y1: expect.closeTo(0.1),
    });
  });
});
