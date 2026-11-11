import { type PointerEvent, useRef } from "react";
import { type Crop, moveEdge } from "../core/crop";
import { appliesTo, cssColor, type Mask, moveRect } from "../core/mask";

type Drag =
  | { kind: "move"; id: string; startX: number; startY: number; rect: Crop }
  | { kind: "corner"; id: string; corner: "tl" | "br" };

/**
 * Máscaras de la página actual sobre la vista previa. Se arrastran para moverlas y se cambian de
 * tamaño desde las esquinas.
 */
export function MaskEditor({
  masks,
  page,
  selected,
  onSelect,
  onChange,
}: {
  masks: Mask[];
  page: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onChange: (id: string, rect: Crop) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const frac = (e: PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    return r ? { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } : null;
  };

  function onMove(e: PointerEvent) {
    const d = drag.current;
    const p = frac(e);
    if (!d || !p) return;
    if (d.kind === "move") {
      onChange(d.id, moveRect(d.rect, p.x - d.startX, p.y - d.startY));
      return;
    }
    const m = masks.find((x) => x.id === d.id);
    if (!m) return;
    const r =
      d.corner === "tl"
        ? moveEdge(moveEdge(m.rect, "x0", p.x), "y0", p.y)
        : moveEdge(moveEdge(m.rect, "x1", p.x), "y1", p.y);
    onChange(d.id, r);
  }

  const pct = (n: number) => `${n * 100}%`;
  const visible = masks.filter((m) => appliesTo(m, page));

  return (
    <div
      ref={box}
      className="pointer-events-none absolute inset-0 z-20"
      onPointerMove={onMove}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      {visible.map((m, i) => {
        const isSel = m.id === selected;
        return (
          <button
            type="button"
            key={m.id}
            aria-label={`Máscara ${i + 1}`}
            className={`pointer-events-auto absolute cursor-move touch-none ${
              isSel ? "outline-none ring-2 ring-brand" : "outline-1 outline-dashed outline-subtle"
            }`}
            style={{
              left: pct(m.rect.x0),
              top: pct(m.rect.y0),
              width: pct(m.rect.x1 - m.rect.x0),
              height: pct(m.rect.y1 - m.rect.y0),
              background: cssColor(m.color),
              opacity: 0.9,
            }}
            onClick={() => onSelect(m.id)}
            onPointerDown={(e) => {
              const p = frac(e);
              if (!p) return;
              onSelect(m.id);
              drag.current = { kind: "move", id: m.id, startX: p.x, startY: p.y, rect: m.rect };
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              e.preventDefault();
            }}
          >
            {isSel &&
              (["tl", "br"] as const).map((corner) => (
                <span
                  key={corner}
                  className={`absolute size-3 rounded-sm border border-white bg-brand ${
                    corner === "tl"
                      ? "-left-1.5 -top-1.5 cursor-nwse-resize"
                      : "-bottom-1.5 -right-1.5 cursor-nwse-resize"
                  }`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    drag.current = { kind: "corner", id: m.id, corner };
                    (e.currentTarget.parentElement as Element).setPointerCapture(e.pointerId);
                    e.preventDefault();
                  }}
                />
              ))}
          </button>
        );
      })}
    </div>
  );
}
