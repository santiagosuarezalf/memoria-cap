import { useEffect, useRef } from "react";
import type { Crop } from "../core/crop";
import { REASON_LABELS, type ReviewReason } from "../core/review";

export type ThumbFilter = "all" | "review" | "landscape";

export interface Thumb {
  n: number;
  src: string;
  crop: Crop;
  reasons: ReviewReason[];
  landscape: boolean;
}

/** Columna de miniaturas con filtros: todas, para revisar y horizontales. */
export function Thumbnails({
  thumbs,
  page,
  filter,
  onFilter,
  onPage,
}: {
  thumbs: Thumb[];
  page: number;
  filter: ThumbFilter;
  onFilter: (f: ThumbFilter) => void;
  onPage: (n: number) => void;
}) {
  const review = thumbs.filter((t) => t.reasons.some((r) => r !== "landscape"));
  const landscape = thumbs.filter((t) => t.landscape);
  const shown = filter === "review" ? review : filter === "landscape" ? landscape : thumbs;
  const list = useRef<HTMLOListElement>(null);

  // La miniatura de la página actual siempre queda a la vista.
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-page="${page}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [page]);

  const chips: { id: ThumbFilter; label: string; count: number }[] = [
    { id: "all", label: "Todas", count: thumbs.length },
    { id: "review", label: "Para revisar", count: review.length },
    { id: "landscape", label: "Horizontales", count: landscape.length },
  ];

  return (
    <div className="flex w-44 shrink-0 flex-col border-r border-line bg-well">
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 border-b border-line p-3">
        <legend className="sr-only">Filtrar páginas</legend>
        {chips.map((c) => {
          const on = filter === c.id;
          const attention = c.id === "review" && c.count > 0;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onFilter(c.id)}
              className={`flex h-8 items-center justify-between rounded-full px-3 text-[13px] ${
                on
                  ? "bg-navy text-white"
                  : attention
                    ? "border border-[#f0b48c] bg-accent-soft text-accent-ink"
                    : "border border-line-strong bg-surface text-muted"
              }`}
            >
              {c.label}
              <span className="font-mono text-xs">{c.count}</span>
            </button>
          );
        })}
      </fieldset>
      <ol
        ref={list}
        className="m-0 flex flex-1 list-none flex-col items-center gap-4 overflow-y-auto px-2 py-4"
      >
        {shown.length === 0 && (
          <li className="px-2 text-center text-xs text-subtle">
            {filter === "review"
              ? "Nada que revisar: todas las páginas se ven bien."
              : "No hay páginas horizontales."}
          </li>
        )}
        {shown.map((t) => {
          const selected = t.n === page;
          const warn = t.reasons.some((r) => r !== "landscape");
          return (
            <li key={t.n} data-page={t.n}>
              <button
                type="button"
                onClick={() => onPage(t.n)}
                aria-current={selected ? "page" : undefined}
                aria-label={`Página ${t.n}${t.reasons.length ? `: ${t.reasons.map((r) => REASON_LABELS[r]).join(", ")}` : ""}`}
                title={t.reasons.map((r) => REASON_LABELS[r]).join(" · ") || undefined}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={`relative block bg-surface shadow-[0_1px_2px_rgba(20,32,46,0.18)] ${
                    selected ? "outline-[3px] outline-offset-2 outline-brand outline-solid" : ""
                  }`}
                >
                  <img src={t.src} alt="" className={`block ${t.landscape ? "w-28" : "w-20"}`} />
                  <span
                    className="absolute border-[1.5px] border-accent"
                    style={{
                      left: `${t.crop.x0 * 100}%`,
                      top: `${t.crop.y0 * 100}%`,
                      width: `${(t.crop.x1 - t.crop.x0) * 100}%`,
                      height: `${(t.crop.y1 - t.crop.y0) * 100}%`,
                    }}
                  />
                  {warn && (
                    <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                      !
                    </span>
                  )}
                </span>
                <span
                  className={`font-mono text-xs ${selected ? "font-semibold text-navy" : "text-muted"}`}
                >
                  {t.n}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
