// Piezas comunes de la interfaz, con la línea visual escogida (propuesta A).

import type { ReactNode } from "react";

/** El logo: una hoja con las marcas de corte. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#14304f" />
      <rect x="19" y="15" width="26" height="34" rx="1.5" fill="#ffffff" />
      <path
        d="M24 22h16M24 27h16M24 32h11M24 37h16M24 42h9"
        stroke="#9fb4cc"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M11 19v-8h8M45 11h8v8M53 45v8h-8M19 53h-8v-8"
        fill="none"
        stroke="#f26b1d"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Íconos de trazo, del mismo grosor que el texto. */
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const ICONS = {
  check: <path d="M5 12l5 5 9-10" />,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  alert: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M6 10l6-6 6 6" />
      <path d="M4 20h16" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

/** Control segmentado: una sola opción de varias, como pestañas pequeñas. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span aria-hidden="true" className="text-[13px] font-medium">
        {label}
      </span>
      <fieldset
        className="m-0 grid gap-0 rounded-lg border-0 bg-well p-[3px]"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        <legend className="sr-only">{label}</legend>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`h-9 rounded-md text-[13px] ${
              o.value === value
                ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(20,32,46,0.15)]"
                : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/** Campo numérico con su unidad. */
export function NumberField({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  onChange,
  compact = false,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  compact?: boolean;
}) {
  return (
    <label
      className={`flex flex-col gap-1.5 ${compact ? "text-xs text-muted" : "text-[13px] font-medium"}`}
    >
      {label}
      <span className="flex items-center gap-2">
        <input
          type="number"
          className={`${compact ? "w-full" : "w-20"} h-9 rounded-md border border-line-strong bg-surface px-2.5 font-mono text-sm text-ink`}
          value={Math.round(value * 10) / 10}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        {unit && <span className="text-[13px] font-normal text-muted">{unit}</span>}
      </span>
    </label>
  );
}

/** Casilla con texto y detalle opcional. */
export function Check({
  checked,
  onChange,
  children,
  detail,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug">
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-brand"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {children}
        {detail && <span className="block text-xs text-subtle">{detail}</span>}
      </span>
    </label>
  );
}

/** Aviso en el panel: bien, atención o informativo. */
export function Callout({ tone, children }: { tone: "ok" | "warn" | "info"; children: ReactNode }) {
  const styles = {
    ok: "bg-ok-soft text-ok-ink",
    warn: "bg-accent-soft text-accent-ink",
    info: "bg-brand-soft text-navy",
  }[tone];
  const icon: IconName = tone === "ok" ? "check" : tone === "warn" ? "alert" : "info";
  return (
    <div className={`flex gap-2.5 rounded-lg p-3 text-[13px] leading-snug ${styles}`}>
      <span className="mt-px shrink-0">
        <Icon name={icon} size={17} />
      </span>
      <span>{children}</span>
    </div>
  );
}

/** Botón que abre un selector de archivo. */
export function FileButton({
  accept,
  onFile,
  children,
  variant = "secondary",
  disabled = false,
}: {
  accept: string;
  onFile: (f: File | undefined) => void;
  children: ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const look =
    variant === "primary"
      ? "bg-brand text-white hover:bg-brand-hover h-11 px-5 text-[15px] font-semibold"
      : "border border-line-strong bg-surface text-ink hover:bg-canvas h-9 px-3 text-[13px]";
  return (
    <label
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-md ${look} ${
        disabled ? "pointer-events-none opacity-50" : "cursor-pointer"
      }`}
    >
      {children}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}

/** Título de un bloque dentro del panel. */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-wide text-subtle uppercase">{title}</h2>
      {children}
    </section>
  );
}
