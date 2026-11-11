import { MASK_COLORS, type Mask, type MaskColor, newMask } from "../core/mask";

const field =
  "rounded border border-slate-300 bg-transparent px-1 py-0.5 text-sm dark:border-slate-600 dark:bg-slate-900";

/** Lista de máscaras: color, a qué páginas aplica y borrar. */
export function MaskList({
  masks,
  page,
  totalPages,
  selected,
  onSelect,
  onChange,
}: {
  masks: Mask[];
  page: number;
  totalPages: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (masks: Mask[]) => void;
}) {
  const update = (id: string, patch: Partial<Mask>) =>
    onChange(masks.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  return (
    <div className="flex flex-col gap-2">
      {masks.length === 0 && (
        <p className="text-xs text-slate-500">
          Tape zonas de la página, como el logo o la marca de agua del programa.
        </p>
      )}
      {masks.map((m, i) => {
        const range = m.pages.kind === "range" ? m.pages : null;
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: seleccionar la fila es un atajo; cada control es accesible por sí mismo
          // biome-ignore lint/a11y/useKeyWithClickEvents: ídem
          <div
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`flex flex-col gap-1.5 rounded border p-2 ${
              m.id === selected ? "border-sky-500" : "border-slate-300 dark:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">Máscara {i + 1}</span>
              <select
                aria-label="Color"
                className={field}
                value={m.color}
                onChange={(e) => update(m.id, { color: e.target.value as MaskColor })}
              >
                {Object.entries(MASK_COLORS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ml-auto text-xs underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(masks.filter((x) => x.id !== m.id));
                  if (selected === m.id) onSelect(null);
                }}
              >
                Quitar
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <select
                aria-label="Páginas"
                className={field}
                value={range ? "range" : "all"}
                onChange={(e) =>
                  update(m.id, {
                    pages:
                      e.target.value === "all"
                        ? { kind: "all" }
                        : { kind: "range", from: page, to: page },
                  })
                }
              >
                <option value="all">Todas las páginas</option>
                <option value="range">Páginas</option>
              </select>
              {range && (
                <>
                  <input
                    type="number"
                    aria-label="Desde la página"
                    className={`${field} w-14`}
                    min={1}
                    max={totalPages}
                    value={range.from}
                    onChange={(e) => {
                      const from = Math.min(totalPages, Math.max(1, Number(e.target.value)));
                      update(m.id, {
                        pages: { kind: "range", from, to: Math.max(from, range.to) },
                      });
                    }}
                  />
                  a
                  <input
                    type="number"
                    aria-label="Hasta la página"
                    className={`${field} w-14`}
                    min={1}
                    max={totalPages}
                    value={range.to}
                    onChange={(e) => {
                      const to = Math.min(totalPages, Math.max(1, Number(e.target.value)));
                      update(m.id, {
                        pages: { kind: "range", from: Math.min(range.from, to), to },
                      });
                    }}
                  />
                </>
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className="self-start rounded border border-slate-300 px-2 py-1 dark:border-slate-600"
        onClick={() => {
          const m = newMask(page);
          onChange([...masks, m]);
          onSelect(m.id);
        }}
      >
        + Agregar máscara en esta página
      </button>
      {masks.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          En Word e imágenes lo tapado desaparece. En el PDF vectorial la máscara tapa a la vista,
          pero el texto de debajo sigue en el archivo y se puede copiar.
        </p>
      )}
    </div>
  );
}
