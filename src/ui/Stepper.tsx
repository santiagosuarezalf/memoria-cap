import { Icon } from "./controls";

export type Step = "open" | "review" | "export";

const STEPS: { id: Step; label: string }[] = [
  { id: "open", label: "Abrir PDF" },
  { id: "review", label: "Revisar el recorte" },
  { id: "export", label: "Exportar" },
];

/** Abrir → Revisar → Exportar. Los pasos ya alcanzados se pueden volver a abrir. */
export function Stepper({
  step,
  canReach,
  onStep,
}: {
  step: Step;
  canReach: (s: Step) => boolean;
  onStep: (s: Step) => void;
}) {
  const current = STEPS.findIndex((s) => s.id === step);
  return (
    <nav
      aria-label="Pasos"
      className="flex h-16 shrink-0 items-center justify-center gap-4 border-b border-line bg-surface px-4"
    >
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.id} className="flex items-center gap-4">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`h-0.5 w-10 sm:w-16 ${i <= current ? "bg-brand" : "bg-line-strong"}`}
              />
            )}
            <button
              type="button"
              disabled={!canReach(s.id) || active}
              aria-current={active ? "step" : undefined}
              onClick={() => onStep(s.id)}
              className="flex items-center gap-2.5 rounded-md px-1 py-1 disabled:cursor-default"
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
                  active
                    ? "bg-brand text-white"
                    : done
                      ? "bg-brand-soft text-brand"
                      : "border-2 border-line-strong text-subtle"
                }`}
              >
                {done ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span
                className={`text-sm ${active ? "font-semibold text-ink" : done ? "text-muted" : "text-subtle"}`}
              >
                {s.label}
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
