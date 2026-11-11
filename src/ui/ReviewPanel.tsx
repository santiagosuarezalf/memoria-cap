import type { Mask } from "../core/mask";
import { REASON_LABELS, type ReviewReason } from "../core/review";
import { Callout, Check, Icon, NumberField, PanelSection, Segmented } from "./controls";
import { MaskList } from "./MaskList";

export interface ReviewPanelProps {
  totalPages: number;
  page: number;
  pageReasons: ReviewReason[];
  pagesWithHeader: number;
  pagesWithFooter: number;
  reviewCount: number;
  mode: "all" | "page";
  onMode: (m: "all" | "page") => void;
  paddingMm: number;
  onPadding: (n: number) => void;
  skipRepeated: boolean;
  onSkipRepeated: (v: boolean) => void;
  manual: boolean;
  onResetCrop: () => void;
  masks: Mask[];
  selectedMask: string | null;
  onSelectMask: (id: string | null) => void;
  onMasks: (m: Mask[]) => void;
  onShowReview: () => void;
  onNext: () => void;
}

/** Paso 2: revisar el recorte. Lo naranja es lo que sale en el anexo. */
export function ReviewPanel(p: ReviewPanelProps) {
  const detected = Math.max(p.pagesWithHeader, p.pagesWithFooter);
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-xl font-semibold">Revisar el recorte</h1>
          <p className="m-0 text-[13px] leading-normal text-muted">
            Lo que queda dentro del marco naranja es lo que sale en el anexo. Arrastre los bordes si
            hace falta.
          </p>
        </div>

        {p.skipRepeated && detected > 0 ? (
          <Callout tone="ok">
            Se quitó el encabezado y el pie del programa en {detected} de {p.totalPages} páginas.
          </Callout>
        ) : (
          <Callout tone="info">
            {p.skipRepeated
              ? "No se encontró un encabezado o pie que se repita: se recorta todo el contenido."
              : "Se incluye el encabezado y el pie del programa."}
          </Callout>
        )}

        {p.reviewCount > 0 && (
          <button
            type="button"
            onClick={p.onShowReview}
            className="flex items-center gap-2.5 rounded-lg border border-[#f0b48c] bg-accent-soft p-3 text-left text-[13px] text-accent-ink"
          >
            <Icon name="alert" size={17} />
            <span className="flex-1">
              {p.reviewCount === 1
                ? "1 página merece una mirada."
                : `${p.reviewCount} páginas merecen una mirada.`}{" "}
              <span className="underline">Verlas</span>
            </span>
          </button>
        )}

        {p.pageReasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="w-full text-xs text-subtle">Página {p.page}:</span>
            {p.pageReasons.map((r) => (
              <span
                key={r}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  r === "cut" ? "bg-bad-soft text-bad-ink" : "bg-accent-soft text-accent-ink"
                }`}
              >
                {REASON_LABELS[r]}
              </span>
            ))}
          </div>
        )}

        <PanelSection title="Recorte">
          <Segmented
            label="Aplicar el recorte"
            value={p.mode}
            onChange={p.onMode}
            options={[
              { value: "all", label: "Igual en todas" },
              { value: "page", label: "Por página" },
            ]}
          />
          <NumberField
            label="Margen alrededor del contenido"
            unit="mm"
            value={p.paddingMm}
            min={0}
            max={30}
            onChange={p.onPadding}
          />
          <Check
            checked={p.skipRepeated}
            onChange={p.onSkipRepeated}
            detail={
              detected > 0
                ? `Encontrado en ${detected} de ${p.totalPages} páginas`
                : "No se encontró en este PDF"
            }
          >
            Quitar el encabezado y el pie del programa
          </Check>
          {p.manual && (
            <button
              type="button"
              className="self-start text-[13px] text-brand underline"
              onClick={p.onResetCrop}
            >
              Volver al recorte automático
            </button>
          )}
          <p className="m-0 text-xs text-subtle">
            Los bordes también se mueven con las flechas del teclado (Shift para pasos largos).
          </p>
        </PanelSection>

        <PanelSection title="Máscaras">
          <MaskList
            masks={p.masks}
            page={p.page}
            totalPages={p.totalPages}
            selected={p.selectedMask}
            onSelect={p.onSelectMask}
            onChange={p.onMasks}
          />
        </PanelSection>
      </div>

      <div className="border-t border-line p-6 pt-4">
        <button
          type="button"
          onClick={p.onNext}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand text-[15px] font-semibold text-white hover:bg-brand-hover"
        >
          Siguiente: exportar
          <Icon name="arrow" size={18} />
        </button>
      </div>
    </div>
  );
}
