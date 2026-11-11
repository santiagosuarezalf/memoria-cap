import { pageFileName } from "../core/crop";
import type { PageSetup } from "../core/docx";
import type { ImageFormat } from "../core/render";
import { DEFAULT_NUMBERING, type MarginsMm, type Numbering } from "../core/vectorpdf";
import { Callout, Check, FileButton, Icon, NumberField, PanelSection, Segmented } from "./controls";

export type Target = "word" | "pdf" | "images";

export interface ExportPanelProps {
  totalPages: number;
  target: Target;
  onTarget: (t: Target) => void;
  baseName: string;
  onBaseName: (s: string) => void;
  dpi: number;
  onDpi: (n: number) => void;
  format: ImageFormat;
  onFormat: (f: ImageFormat) => void;
  landscapeMode: "rotate" | "section";
  onLandscapeMode: (m: "rotate" | "section") => void;
  hasLandscape: boolean;
  hasMasks: boolean;
  // Word
  templateName: string | null;
  setup: PageSetup;
  onTemplate: (f: File | undefined) => void;
  onClearTemplate: () => void;
  maxHeightMm: number;
  onMaxHeight: (n: number) => void;
  // PDF
  letterheadName: string | null;
  onLetterhead: (f: File | undefined) => void;
  onClearLetterhead: () => void;
  pdfMargins: MarginsMm;
  onPdfMargins: (m: MarginsMm) => void;
  numbering: Numbering | null;
  onNumbering: (n: Numbering | null) => void;
  // Acción
  progress: { label: string; done: number; total: number } | null;
  /** Páginas cuyo recorte deja contenido por fuera. */
  cutCount: number;
  onReview: () => void;
  onExport: () => void;
}

const TARGETS: { id: Target; title: string; detail: string }[] = [
  { id: "word", title: "Word", detail: "con plantilla" },
  { id: "pdf", title: "PDF", detail: "vectorial" },
  { id: "images", title: "Imágenes", detail: "PNG o JPG" },
];

/** Paso 3: escoger el formato y exportar, con un solo botón. */
export function ExportPanel(p: ExportPanelProps) {
  const action =
    p.target === "word"
      ? `Exportar ${p.totalPages} páginas a Word`
      : p.target === "pdf"
        ? `Exportar ${p.totalPages} páginas a PDF`
        : `Exportar ${p.totalPages} imágenes`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <h1 className="m-0 text-xl font-semibold">Exportar</h1>

        {p.cutCount > 0 && (
          <Callout tone="warn">
            En {p.cutCount === 1 ? "1 página" : `${p.cutCount} páginas`} el recorte deja contenido
            por fuera.{" "}
            <button type="button" className="underline" onClick={p.onReview}>
              Revisar
            </button>
          </Callout>
        )}

        <fieldset className="m-0 grid grid-cols-3 gap-1.5 border-0 p-0">
          <legend className="sr-only">Formato de salida</legend>
          {TARGETS.map((t) => {
            const on = p.target === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => p.onTarget(t.id)}
                className={`flex h-16 flex-col items-center justify-center rounded-lg text-[13px] ${
                  on
                    ? "border-2 border-brand bg-brand-soft font-semibold text-navy"
                    : "border border-line-strong bg-surface text-ink hover:bg-canvas"
                }`}
              >
                {t.title}
                <span className={`text-[11px] font-normal ${on ? "text-muted" : "text-subtle"}`}>
                  {t.detail}
                </span>
              </button>
            );
          })}
        </fieldset>

        {p.target === "word" && (
          <PanelSection title="Plantilla">
            <FileRow
              name={p.templateName}
              empty="Ninguna: hoja carta en blanco"
              accept=".docx,.dotx"
              onFile={p.onTemplate}
              onClear={p.onClearTemplate}
            />
            <p className="m-0 text-xs text-subtle">
              Se conservan su encabezado, pie y márgenes. Hoja de {Math.round(p.setup.widthMm)} ×{" "}
              {Math.round(p.setup.heightMm)} mm.
            </p>
            <NumberField
              label="Altura máxima de cada página"
              unit="mm"
              value={p.maxHeightMm}
              min={50}
              max={Math.round(p.setup.heightMm)}
              onChange={p.onMaxHeight}
            />
            <p className="-mt-1 m-0 text-xs text-subtle">
              Si alguna página pasa a la hoja siguiente, bájela unos milímetros.
            </p>
          </PanelSection>
        )}

        {p.target === "pdf" && (
          <>
            <PanelSection title="Hoja membretada">
              <FileRow
                name={p.letterheadName}
                empty="Ninguna: hoja carta en blanco"
                accept="application/pdf"
                onFile={p.onLetterhead}
                onClear={p.onClearLetterhead}
              />
              <p className="m-0 text-xs text-subtle">
                Guarde la plantilla de Word como PDF, sin el número de página. Las páginas se copian
                sin pasar a imagen: nítidas y livianas.
              </p>
              <fieldset className="m-0 grid grid-cols-2 gap-x-3 gap-y-2 border-0 p-0">
                <legend className="mb-1.5 p-0 text-[13px] font-medium">Márgenes (mm)</legend>
                {(
                  [
                    ["top", "Arriba"],
                    ["bottom", "Abajo"],
                    ["left", "Izquierda"],
                    ["right", "Derecha"],
                  ] as const
                ).map(([k, label]) => (
                  <NumberField
                    key={k}
                    compact
                    label={label}
                    value={p.pdfMargins[k]}
                    min={0}
                    max={150}
                    onChange={(n) => p.onPdfMargins({ ...p.pdfMargins, [k]: n })}
                  />
                ))}
              </fieldset>
            </PanelSection>
            <PanelSection title="Numeración">
              <Check
                checked={p.numbering !== null}
                onChange={(v) => p.onNumbering(v ? DEFAULT_NUMBERING : null)}
              >
                Numerar las hojas
              </Check>
              {p.numbering && <NumberingFields value={p.numbering} onChange={p.onNumbering} />}
            </PanelSection>
            {p.hasMasks && (
              <Callout tone="warn">
                En el PDF vectorial las máscaras tapan a la vista, pero el texto de debajo sigue en
                el archivo y se puede copiar. Para borrarlo de verdad, exporte a Word o imágenes.
              </Callout>
            )}
          </>
        )}

        {p.target !== "pdf" && (
          <PanelSection title="Calidad">
            <div className="flex items-end gap-4">
              <NumberField
                label="Resolución"
                unit="dpi"
                value={p.dpi}
                min={72}
                max={600}
                step={10}
                onChange={p.onDpi}
              />
            </div>
            <Segmented
              label="Formato de imagen"
              value={p.format}
              onChange={p.onFormat}
              options={[
                { value: "png", label: "PNG · nítido" },
                { value: "jpg", label: "JPG · liviano" },
              ]}
            />
          </PanelSection>
        )}

        {p.hasLandscape && p.target !== "images" && (
          <Segmented
            label="Páginas horizontales"
            value={p.landscapeMode}
            onChange={p.onLandscapeMode}
            options={[
              { value: "rotate", label: "Girarlas" },
              { value: "section", label: "Hoja horizontal" },
            ]}
          />
        )}

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Nombre del archivo
          <input
            className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink"
            value={p.baseName}
            onChange={(e) => p.onBaseName(e.target.value)}
          />
          <span className="text-xs font-normal text-subtle">
            {p.target === "word"
              ? `${p.baseName || "anexo"}.docx`
              : p.target === "pdf"
                ? `${p.baseName || "anexo"}-anexo.pdf`
                : `${pageFileName(p.baseName, 1, p.totalPages, p.format)}, … en la carpeta que elija`}
          </span>
        </label>
      </div>

      <div className="border-t border-line p-6 pt-4">
        {p.progress ? (
          <div className="flex h-12 flex-col justify-center gap-1.5" role="status">
            <span className="text-[13px]">
              {p.progress.label}…{" "}
              {p.progress.total > 1 && `${p.progress.done} de ${p.progress.total}`}
            </span>
            <progress
              className="h-2 w-full accent-brand"
              value={p.progress.done}
              max={p.progress.total}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={p.onExport}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand text-[15px] font-semibold text-white hover:bg-brand-hover"
          >
            {action}
            <Icon name="arrow" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function FileRow({
  name,
  empty,
  accept,
  onFile,
  onClear,
}: {
  name: string | null;
  empty: string;
  accept: string;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-subtle">
        <Icon name="file" size={18} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px]" title={name ?? undefined}>
        {name ?? <span className="text-subtle">{empty}</span>}
      </span>
      {name && (
        <button
          type="button"
          aria-label="Quitar"
          onClick={onClear}
          className="rounded p-1 text-subtle hover:text-ink"
        >
          <Icon name="close" size={16} />
        </button>
      )}
      <FileButton accept={accept} onFile={onFile}>
        {name ? "Cambiar" : "Elegir…"}
      </FileButton>
    </div>
  );
}

function NumberingFields({
  value,
  onChange,
}: {
  value: Numbering;
  onChange: (n: Numbering) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-l-2 border-line pl-3">
      <label className="flex flex-col gap-1.5 text-xs text-muted">
        Texto: {"{n}"} es el número y {"{total}"} el último
        <input
          className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink"
          value={value.format}
          onChange={(e) => onChange({ ...value, format: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumberField
          compact
          label="Empieza en"
          value={value.startAt}
          min={1}
          max={100000}
          onChange={(n) => onChange({ ...value, startAt: Math.round(n) })}
        />
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Posición
          <select
            className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink"
            value={value.position}
            onChange={(e) =>
              onChange({ ...value, position: e.target.value as Numbering["position"] })
            }
          >
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </label>
        <NumberField
          compact
          label="Desde abajo (mm)"
          value={value.bottomMm}
          min={3}
          max={60}
          onChange={(n) => onChange({ ...value, bottomMm: n })}
        />
        <NumberField
          compact
          label="Tamaño (pt)"
          value={value.sizePt}
          min={6}
          max={24}
          onChange={(n) => onChange({ ...value, sizePt: n })}
        />
      </div>
    </div>
  );
}
