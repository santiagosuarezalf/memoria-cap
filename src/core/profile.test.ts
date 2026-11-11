import { describe, expect, it } from "vitest";
import { newMask } from "./mask";
import {
  cropFromMarginsMm,
  parseProfile,
  parseVic,
  type Settings,
  serializeProfile,
} from "./profile";
import { DEFAULT_NUMBERING } from "./vectorpdf";

const defaults: Settings = {
  mode: "all",
  paddingMm: 3,
  skipRepeated: true,
  globalCrops: {},
  dpi: 250,
  format: "png",
  landscapeMode: "rotate",
  maxHeightMm: 204,
  pdfMargins: { top: 25, bottom: 25, left: 25, right: 25 },
  numbering: null,
  masks: [],
};

describe("perfiles", () => {
  it("guarda y vuelve a cargar lo mismo", () => {
    const s: Settings = {
      ...defaults,
      mode: "page",
      dpi: 300,
      globalCrops: { "216x279": { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9 } },
      numbering: { ...DEFAULT_NUMBERING, startAt: 37 },
      masks: [newMask(2, "black")],
    };
    expect(parseProfile(serializeProfile(s), defaults)).toEqual(s);
  });

  it("completa lo que falta y corrige valores fuera de rango", () => {
    const p = parseProfile(
      JSON.stringify({ formato: "memoriacap-perfil", dpi: 5000, format: "gif", masks: [{}] }),
      defaults,
    );
    expect(p.dpi).toBe(600);
    expect(p.format).toBe("png");
    expect(p.masks).toEqual([]);
    expect(p.pdfMargins).toEqual(defaults.pdfMargins);
  });

  it("rechaza archivos que no son perfiles", () => {
    expect(() => parseProfile("no es json", defaults)).toThrow(/perfil/);
    expect(() => parseProfile('{"a":1}', defaults)).toThrow(/MemoriaCap/);
  });
});

describe(".vic de ImageCap", () => {
  it("lee un .vic completo y pasa los píxeles a mm", () => {
    const vic = "VARIABLES-RECORTES-IMAGECAP\n90\n110\n110\n90\n100\n50\nTrue\n.jpg\nTrue\n100\n";
    const v = parseVic(vic);
    expect(v.marginsMm.top).toBeCloseTo(22.86); // 90 px a 100 dpi
    expect(v.marginsMm.left).toBeCloseTo(27.94);
    expect(v.dpi).toBe(100);
    expect(v.format).toBe("jpg");
    expect(v.maxHeightMm).toBe(100);
  });

  it("lee un .vic viejo, más corto, y con finales de línea de Windows", () => {
    const vic =
      "VARIABLES-RECORTES-IMAGECAP\r\n30\r\n45\r\n55\r\n55\r\n100\r\n1100\r\nTrue\r\n.jpg\r\n";
    const v = parseVic(vic);
    expect(v.marginsMm.bottom).toBeCloseTo(11.43);
    expect(v.maxHeightMm).toBeNull();
  });

  it("usa 100 dpi si la resolución venía en 0, como ImageCap", () => {
    const v = parseVic("VARIABLES-RECORTES-IMAGECAP\n100\n0\n0\n0\n0\n");
    expect(v.marginsMm.top).toBeCloseTo(25.4);
  });

  it("rechaza archivos que no son .vic", () => {
    expect(() => parseVic("hola\n1\n2")).toThrow(/vic/);
    expect(() => parseVic("VARIABLES-RECORTES-IMAGECAP\n1\n")).toThrow(/márgenes/);
  });

  it("convierte márgenes en mm a recorte de una hoja", () => {
    const c = cropFromMarginsMm(
      { top: 27.94, bottom: 27.94, left: 21.59, right: 21.59 },
      215.9,
      279.4,
    );
    expect(c.x0).toBeCloseTo(0.1);
    expect(c.y0).toBeCloseTo(0.1);
    expect(c.x1).toBeCloseTo(0.9);
    expect(c.y1).toBeCloseTo(0.9);
  });
});
