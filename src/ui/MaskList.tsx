import { MASK_COLORS, type Mask, type MaskColor, newMask } from "../core/mask";
import { NumberInput } from "./controls";

const field = "h-8 rounded-md border border-line-strong bg-surface px-1.5 text-[13px] text-ink";

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
        <p className="m-0 text-xs text-subtle">
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
              m.id === selected ? "border-brand bg-brand-soft/40" : "border-line"
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
                  <NumberInput
                    aria-label="Desde la página"
                    className={`${field} w-14`}
                    min={1}
                    max={totalPages}
                    value={range.from}
                    onChange={(n) => {
                      const from = Math.round(n);
                      update(m.id, {
                        pages: { kind: "range", from, to: Math.max(from, range.to) },
                      });
                    }}
                  />
                  a
                  <NumberInput
                    aria-label="Hasta la página"
                    className={`${field} w-14`}
                    min={1}
                    max={totalPages}
                    value={range.to}
                    onChange={(n) => {
                      const to = Math.round(n);
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
        className="h-9 self-start rounded-md border border-line-strong bg-surface px-3 text-[13px] hover:bg-canvas"
        onClick={() => {
          const m = newMask(page);
          onChange([...masks, m]);
          onSelect(m.id);
        }}
      >
        + Agregar máscara en esta página
      </button>
      {masks.length > 0 && (
        <p className="m-0 text-xs text-accent-ink">
          En Word e imágenes lo tapado desaparece. En el PDF vectorial la máscara tapa a la vista,
          pero el texto de debajo sigue en el archivo y se puede copiar.
        </p>
      )}
    </div>
  );
}
