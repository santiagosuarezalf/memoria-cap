import { expect, it } from "vitest";
import { mmToEmu, mmToPt, mmToPx, ptToMm, pxToMm } from "./units";

it("convierte entre mm, puntos, píxeles y EMU", () => {
  expect(mmToPt(25.4)).toBeCloseTo(72);
  expect(ptToMm(72)).toBeCloseTo(25.4);
  expect(mmToPx(25.4, 250)).toBeCloseTo(250);
  expect(pxToMm(250, 250)).toBeCloseTo(25.4);
  expect(mmToEmu(220)).toBe(7_920_000);
});
