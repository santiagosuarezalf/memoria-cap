import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import { type Crop, type Edge, moveEdge } from "../core/crop";

/**
 * Rectángulo de recorte sobre la vista previa. Cada borde se arrastra con el mouse; lo de afuera
 * queda sombreado para ver de un vistazo qué no va a salir.
 */
export function CropEditor({ crop, onChange }: { crop: Crop; onChange: (c: Crop) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef<Edge | null>(null);

  function start(edge: Edge) {
    return (e: PointerEvent) => {
      dragging.current = edge;
      (e.target as Element).setPointerCapture(e.pointerId);
      e.preventDefault();
    };
  }

  function move(e: PointerEvent) {
    const edge = dragging.current;
    const rect = box.current?.getBoundingClientRect();
    if (!edge || !rect) return;
    const v =
      edge === "x0" || edge === "x1"
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;
    onChange(moveEdge(crop, edge, v));
  }

  const pct = (n: number) => `${n * 100}%`;
  const shade = "absolute bg-slate-900/45";

  return (
    <div
      ref={box}
      className="absolute inset-0"
      onPointerMove={move}
      onPointerUp={() => {
        dragging.current = null;
      }}
    >
      {/* Sombra fuera del recorte */}
      <div className={shade} style={{ left: 0, top: 0, right: 0, height: pct(crop.y0) }} />
      <div className={shade} style={{ left: 0, bottom: 0, right: 0, height: pct(1 - crop.y1) }} />
      <div
        className={shade}
        style={{ left: 0, top: pct(crop.y0), width: pct(crop.x0), height: pct(crop.y1 - crop.y0) }}
      />
      <div
        className={shade}
        style={{
          right: 0,
          top: pct(crop.y0),
          width: pct(1 - crop.x1),
          height: pct(crop.y1 - crop.y0),
        }}
      />
      {/* Marco */}
      <div
        className="pointer-events-none absolute border-2 border-orange-500"
        style={{
          left: pct(crop.x0),
          top: pct(crop.y0),
          width: pct(crop.x1 - crop.x0),
          height: pct(crop.y1 - crop.y0),
        }}
      />
      {/* Bordes arrastrables (franjas de 12 px centradas en cada línea) o movibles con flechas */}
      {(["y0", "y1", "x0", "x1"] as const).map((edge) => (
        <Handle
          key={edge}
          edge={edge}
          crop={crop}
          onPointerDown={start(edge)}
          onNudge={(d) => onChange(moveEdge(crop, edge, crop[edge] + d))}
        />
      ))}
    </div>
  );
}

const LABELS: Record<Edge, string> = {
  y0: "Borde superior",
  y1: "Borde inferior",
  x0: "Borde izquierdo",
  x1: "Borde derecho",
};

function Handle({
  edge,
  crop,
  onPointerDown,
  onNudge,
}: {
  edge: Edge;
  crop: Crop;
  onPointerDown: (e: PointerEvent) => void;
  onNudge: (delta: number) => void;
}) {
  const pct = (n: number) => `${n * 100}%`;
  const horizontal = edge === "y0" || edge === "y1";
  const style = horizontal
    ? {
        left: pct(crop.x0),
        width: pct(crop.x1 - crop.x0),
        top: `calc(${pct(crop[edge])} - 6px)`,
        height: 12,
      }
    : {
        top: pct(crop.y0),
        height: pct(crop.y1 - crop.y0),
        left: `calc(${pct(crop[edge])} - 6px)`,
        width: 12,
      };
  // Flechas: medio por ciento; con Shift, cinco.
  function onKeyDown(e: KeyboardEvent) {
    const step = e.shiftKey ? 0.05 : 0.005;
    const keys = horizontal ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    const i = keys.indexOf(e.key);
    if (i === -1) return;
    e.preventDefault();
    onNudge(i === 0 ? -step : step);
  }
  return (
    <div
      role="slider"
      aria-label={LABELS[edge]}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(crop[edge] * 100)}
      tabIndex={0}
      className={`absolute z-10 touch-none rounded outline-none focus-visible:bg-orange-500/40 ${
        horizontal ? "cursor-ns-resize" : "cursor-ew-resize"
      }`}
      style={style}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}
