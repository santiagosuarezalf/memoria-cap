import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { type Bounds, contentBounds, pad } from "../core/autocrop";
import { openPdf, renderPage } from "../core/pdf";
import { mmToPx } from "../core/units";
import { About } from "./About";

const PREVIEW_DPI = 72;
const PADDING_MM = 3;

export function App() {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState("");
  const [page, setPage] = useState(1);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [error, setError] = useState("");
  const [about, setAbout] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const pdf = await openPdf(await file.arrayBuffer());
      setDoc(pdf);
      setFileName(file.name);
      setPage(1);
    } catch {
      setError("No se pudo abrir el archivo. ¿Es un PDF válido?");
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let cancelled = false;
    renderPage(doc, page, PREVIEW_DPI, canvas).then((c) => {
      if (cancelled) return;
      const ctx = c.getContext("2d") as CanvasRenderingContext2D;
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      const found = contentBounds(data, c.width, c.height);
      setSize({ w: c.width, h: c.height });
      setBounds(
        found && pad(found, Math.round(mmToPx(PADDING_MM, PREVIEW_DPI)), c.width, c.height),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [doc, page]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <h1 className="font-semibold">MemoriaCap</h1>
        <label className="cursor-pointer rounded bg-slate-800 px-3 py-1.5 text-sm text-white dark:bg-slate-200 dark:text-slate-900">
          Abrir PDF…
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {fileName && <span className="truncate text-sm text-slate-500">{fileName}</span>}
        <button type="button" className="ml-auto text-sm underline" onClick={() => setAbout(true)}>
          Acerca de
        </button>
      </header>

      {error && <p className="bg-red-100 px-4 py-2 text-sm text-red-800">{error}</p>}

      <main className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-auto p-4">
        {!doc && (
          <p className="mt-20 max-w-md text-center text-slate-500">
            Abra el PDF de la memoria de cálculo. La app detecta sola el área con contenido de cada
            página.
          </p>
        )}
        {doc && (
          <nav className="flex items-center gap-2 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ◀
            </button>
            <span>
              Página {page} de {doc.numPages}
            </span>
            <button
              type="button"
              disabled={page >= doc.numPages}
              onClick={() => setPage((p) => p + 1)}
            >
              ▶
            </button>
          </nav>
        )}
        <div className="relative shadow" hidden={!doc}>
          <canvas ref={canvasRef} className="block" />
          {bounds && (
            <div
              className="pointer-events-none absolute border-2 border-red-500"
              style={{
                left: `${(bounds.left / size.w) * 100}%`,
                top: `${(bounds.top / size.h) * 100}%`,
                width: `${((bounds.right - bounds.left) / size.w) * 100}%`,
                height: `${((bounds.bottom - bounds.top) / size.h) * 100}%`,
              }}
            />
          )}
        </div>
      </main>

      {about && <About onClose={() => setAbout(false)} />}
    </div>
  );
}
