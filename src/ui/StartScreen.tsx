import { useState } from "react";
import { FileButton, Icon, Logo } from "./controls";

/**
 * Paso 1: soltar o elegir el PDF. Mientras se analiza, muestra el avance. Si ya hay un PDF abierto
 * (se volvió a este paso), ofrece seguir con él: volver no debe hacer perder el trabajo.
 */
export function StartScreen({
  onFile,
  progress,
  current,
  onContinue,
}: {
  onFile: (f: File | undefined) => void;
  progress: { label: string; done: number; total: number } | null;
  current: { name: string; pages: number } | null;
  onContinue: () => void;
}) {
  const [over, setOver] = useState(false);

  if (progress) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-[15px] font-medium">
          {progress.label}: {progress.done} de {progress.total}
        </p>
        <progress className="h-2 w-80 accent-brand" value={progress.done} max={progress.total} />
        <p className="max-w-sm text-center text-[13px] text-subtle">
          Se busca el contenido de cada página y el encabezado y pie que repite el programa.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
      {current && (
        <div className="flex w-full max-w-xl items-center gap-4 rounded-2xl border border-brand bg-brand-soft p-5">
          <span className="text-brand">
            <Icon name="file" size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-xs text-muted">Abierto ahora</p>
            <p className="m-0 truncate text-[15px] font-semibold" title={current.name}>
              {current.name}
            </p>
            <p className="m-0 text-[13px] text-muted">
              {current.pages} páginas · su recorte y sus ajustes siguen intactos
            </p>
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-hover"
          >
            Seguir con este
            <Icon name="arrow" size={18} />
          </button>
        </div>
      )}
      <section
        aria-label="Abrir el PDF de la memoria de cálculo"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = [...e.dataTransfer.files].find((x) => x.name.toLowerCase().endsWith(".pdf"));
          onFile(f);
        }}
        className={`flex w-full max-w-xl flex-col items-center gap-5 rounded-2xl border-2 border-dashed px-8 text-center transition-colors ${
          current ? "py-8" : "py-14"
        } ${over ? "border-brand bg-brand-soft" : "border-line-strong bg-surface"}`}
      >
        {!current && <Logo size={56} />}
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-2xl font-semibold">
            {current ? "O arrastre aquí otro PDF" : "Arrastre aquí el PDF de la memoria"}
          </h1>
          <p className="m-0 text-[15px] text-muted">
            La app encuentra el contenido de cada página, quita el encabezado y el pie del programa
            de cálculo y le deja el anexo listo en Word o PDF.
          </p>
        </div>
        <FileButton
          accept="application/pdf"
          onFile={onFile}
          variant={current ? "secondary" : "primary"}
        >
          <Icon name="upload" size={18} />
          Elegir PDF…
        </FileButton>
        <p className="m-0 text-xs text-subtle">El archivo no sale de este computador.</p>
      </section>
    </div>
  );
}
