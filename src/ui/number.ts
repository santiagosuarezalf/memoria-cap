// Reglas de los campos numéricos. Mientras se escribe, el texto se deja tal cual (escribir "250"
// pasa por "2" y "25", que pueden estar por debajo del mínimo); el valor solo se aplica cuando ya es
// válido, y al terminar se lleva al rango.

/** Durante la escritura: el número si ya es válido y está en rango; si no, null (no se aplica). */
export function liveValue(text: string, min: number, max: number): number | null {
  const n = parse(text);
  return n !== null && n >= min && n <= max ? n : null;
}

/** Al salir del campo o con Enter: el número llevado al rango, o el anterior si no hay número. */
export function committedValue(text: string, min: number, max: number, previous: number): number {
  const n = parse(text);
  return n === null ? previous : Math.min(max, Math.max(min, n));
}

/** Acepta coma o punto decimal, como se escribe en Colombia o en inglés. */
function parse(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Cómo se muestra un valor: sin decimales de más. */
export const formatValue = (n: number) => String(Math.round(n * 10) / 10);
