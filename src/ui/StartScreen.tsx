import { useState } from "react";
import { FileButton, Icon, Logo } from "./controls";

/** Paso 1: soltar o elegir el PDF. Mientras se analiza, muestra el avance. */
export function StartScreen({
  onFile,
  progress,
}: {
  onFile: (f: File | undefined) => void;
  progress: { label: string; done: number; total: number } | null;
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
    <div className="flex flex-1 items-center justify-center p-6">
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
        className={`flex w-full max-w-xl flex-col items-center gap-5 rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors ${
          over ? "border-brand bg-brand-soft" : "border-line-strong bg-surface"
        }`}
      >
        <Logo size={56} />
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-2xl font-semibold">Arrastre aquí el PDF de la memoria</h1>
          <p className="m-0 text-[15px] text-muted">
            La app encuentra el contenido de cada página, quita el encabezado y el pie del programa
            de cálculo y le deja el anexo listo en Word o PDF.
          </p>
        </div>
        <FileButton accept="application/pdf" onFile={onFile} variant="primary">
          <Icon name="upload" size={18} />
          Elegir PDF…
        </FileButton>
        <p className="m-0 text-xs text-subtle">El archivo no sale de este computador.</p>
      </section>
    </div>
  );
}
