import { describe, expect, it } from "vitest";
import { committedValue, formatValue, liveValue } from "./number";

describe("campos numéricos", () => {
  it("deja escribir 250 aunque 2 y 25 estén por debajo del mínimo", () => {
    expect(["2", "25", "250"].map((t) => liveValue(t, 50, 600))).toEqual([null, null, 250]);
  });

  it("no aplica valores fuera de rango mientras se escribe", () => {
    expect(liveValue("9000", 72, 600)).toBeNull();
    expect(liveValue("", 72, 600)).toBeNull();
  });

  it("al terminar lleva el valor al rango o conserva el anterior", () => {
    expect(committedValue("25", 50, 600, 204)).toBe(50);
    expect(committedValue("9000", 72, 600, 250)).toBe(600);
    expect(committedValue("", 72, 600, 250)).toBe(250);
    expect(committedValue("abc", 72, 600, 250)).toBe(250);
  });

  it("acepta coma decimal", () => {
    expect(liveValue("2,5", 0, 30)).toBe(2.5);
  });

  it("muestra a lo sumo un decimal", () => {
    expect(formatValue(24.99)).toBe("25");
    expect(formatValue(2.54)).toBe("2.5");
  });
});
