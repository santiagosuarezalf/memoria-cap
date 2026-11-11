import { describe, expect, it } from "vitest";
import { type Band, boundsOf, contentWithout, findRunningBands, inkBands } from "./bands";

function page(w: number, h: number, boxes: [number, number, number, number][]) {
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x0, y0, x1, y1] of boxes)
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) px.set([0, 0, 0, 255], (y * w + x) * 4);
  return px;
}

describe("inkBands", () => {
  it("separa bloques divididos por espacio en blanco y mide su ancho", () => {
    const px = page(100, 100, [
      [10, 2, 90, 5], // encabezado
      [20, 20, 60, 40],
      [30, 41, 80, 50], // a una fila del anterior: misma banda
      [10, 95, 50, 98], // pie
    ]);
    expect(inkBands(px, 100, 100)).toEqual([
      { x0: 0.1, y0: 0.02, x1: 0.9, y1: 0.05 },
      { x0: 0.2, y0: 0.2, x1: 0.8, y1: 0.5 },
      { x0: 0.1, y0: 0.95, x1: 0.5, y1: 0.98 },
    ]);
  });

  it("no encuentra bandas en una página en blanco", () => {
    expect(inkBands(page(20, 20, []), 20, 20)).toEqual([]);
  });
});

const header: Band = { x0: 0.05, y0: 0.02, x1: 0.95, y1: 0.04 };
const footer: Band = { x0: 0.05, y0: 0.96, x1: 0.95, y1: 0.98 };
const body = (y0: number, y1: number, x1 = 0.7): Band => ({ x0: 0.1, y0, x1, y1 });

describe("findRunningBands", () => {
  it("detecta el encabezado y el pie que se repiten, aunque la portada no los tenga", () => {
    const pages = [
      [body(0.2, 0.8)], // portada
      [header, body(0.1, 0.3), footer],
      [header, body(0.1, 0.9, 0.9), footer],
      [{ ...header, y0: 0.025 }, body(0.1, 0.5), footer], // medio punto corrido: igual cuenta
    ];
    const r = findRunningBands(pages);
    expect(r.pagesWithHeader).toBe(3);
    expect(r.pagesWithFooter).toBe(3);
    expect([...r.repeated[0]]).toEqual([]);
    expect([...r.repeated[1]].sort()).toEqual([0, 2]);
    expect(contentWithout(pages[2], r.repeated[2])).toEqual(body(0.1, 0.9, 0.9));
  });

  it("no inventa encabezado si la primera banda cambia de página a página", () => {
    const pages = [
      [body(0.02, 0.05), body(0.2, 0.8)],
      [body(0.08, 0.12), body(0.2, 0.8)],
      [body(0.13, 0.14), body(0.2, 0.8)],
    ];
    expect(findRunningBands(pages).pagesWithHeader).toBe(0);
  });

  it("no toma como encabezado una banda gruesa, aunque se repita", () => {
    const tall: Band = { x0: 0.1, y0: 0.01, x1: 0.9, y1: 0.14 };
    const pages = [
      [tall, body(0.3, 0.6)],
      [tall, body(0.3, 0.6)],
    ];
    expect(findRunningBands(pages).pagesWithHeader).toBe(0);
  });

  it("exige al menos dos páginas", () => {
    expect(findRunningBands([[header, body(0.2, 0.5), footer]]).pagesWithHeader).toBe(0);
  });
});

it("boundsOf une bandas y devuelve null sin bandas", () => {
  expect(boundsOf([header, footer])).toEqual({ x0: 0.05, y0: 0.02, x1: 0.95, y1: 0.98 });
  expect(boundsOf([])).toBeNull();
});
