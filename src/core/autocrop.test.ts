import { describe, expect, it } from "vitest";
import { contentBounds, isLandscape, pad, unionBounds } from "./autocrop";

/** Página blanca de w×h con rectángulos negros. */
function page(w: number, h: number, boxes: [number, number, number, number][]) {
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x0, y0, x1, y1] of boxes) {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) px.set([0, 0, 0, 255], (y * w + x) * 4);
  }
  return px;
}

describe("contentBounds", () => {
  it("encierra toda la tinta", () => {
    const px = page(100, 80, [
      [10, 5, 20, 15],
      [60, 50, 90, 70],
    ]);
    expect(contentBounds(px, 100, 80)).toEqual({ left: 10, top: 5, right: 90, bottom: 70 });
  });

  it("devuelve null en una página en blanco", () => {
    expect(contentBounds(page(50, 50, []), 50, 50)).toBeNull();
  });

  it("ignora un píxel suelto de polvo", () => {
    const px = page(50, 50, [
      [1, 1, 2, 2],
      [10, 10, 40, 40],
    ]);
    expect(contentBounds(px, 50, 50)).toEqual({ left: 10, top: 10, right: 40, bottom: 40 });
  });

  it("trata lo transparente como papel", () => {
    const px = new Uint8ClampedArray(10 * 10 * 4); // todo (0,0,0,0)
    expect(contentBounds(px, 10, 10)).toBeNull();
  });

  it("rechaza un búfer del tamaño equivocado", () => {
    expect(() => contentBounds(new Uint8ClampedArray(4), 10, 10)).toThrow();
  });
});

describe("unionBounds, pad e isLandscape", () => {
  it("une los recortes de varias páginas e ignora las vacías", () => {
    expect(
      unionBounds([
        { left: 10, top: 20, right: 50, bottom: 60 },
        null,
        { left: 5, top: 30, right: 40, bottom: 90 },
      ]),
    ).toEqual({ left: 5, top: 20, right: 50, bottom: 90 });
    expect(unionBounds([null])).toBeNull();
  });

  it("agranda sin salirse de la página", () => {
    expect(pad({ left: 2, top: 2, right: 98, bottom: 48 }, 5, 100, 50)).toEqual({
      left: 0,
      top: 0,
      right: 100,
      bottom: 50,
    });
  });

  it("reconoce un contenido horizontal", () => {
    expect(isLandscape({ left: 0, top: 0, right: 200, bottom: 100 })).toBe(true);
    expect(isLandscape({ left: 0, top: 0, right: 100, bottom: 200 })).toBe(false);
  });
});
