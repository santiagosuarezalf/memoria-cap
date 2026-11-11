import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useMemo, useRef, useState } from "react";
import { boundsOf, contentWithout, findRunningBands } from "../core/bands";
import { type Crop, FULL_PAGE, padMm, pageFileName, sizeKey, unionBySize } from "../core/crop";
import {
  buildDocx,
  DEFAULT_SETUP,
  type DocxImage,
  loadTemplate,
  suggestedMaxHeightMm,
  type Template,
} from "../core/docx";
import { openPdf, renderPage } from "../core/pdf";
import {
  analyzePages,
  canvasToBytes,
  type ImageFormat,
  type PageInfo,
  renderCropped,
  rotateLeft,
} from "../core/render";
import { buildVectorPdf, type MarginsMm, marginsFrom } from "../core/vectorpdf";
import { chooseFolder, saveFile } from "../platform/save";
import { About } from "./About";
import { CropEditor } from "./CropEditor";

const PREVIEW_DPI = 110;

type Mode = "all" | "page";

export function App() {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>("all");
  const [paddingMm, setPaddingMm] = useState(3);
  // En modo "todas", el recorte manual se guarda por tamaño de hoja (vertical y horizontal aparte).
  const [globalCrops, setGlobalCrops] = useState<Record<string, Crop>>({});
  const [pageCrops, setPageCrops] = useState<Record<number, Crop>>({});
  const [dpi, setDpi] = useState(250);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [baseName, setBaseName] = useState("anexo");
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(
    null,
  );
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [about, setAbout] = useState(false);
  const [template, setTemplate] = useState<{ name: string; t: Template } | null>(null);
  const [maxHeightMm, setMaxHeightMm] = useState(suggestedMaxHeightMm(DEFAULT_SETUP));
  const [landscapeMode, setLandscapeMode] = useState<"rotate" | "section">("rotate");
  const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null);
  const [letterhead, setLetterhead] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [pdfMargins, setPdfMargins] = useState<MarginsMm>(marginsFrom(DEFAULT_SETUP));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busy = progress !== null;

  const [skipRepeated, setSkipRepeated] = useState(true);
  const running = useMemo(() => findRunningBands(pages.map((p) => p.bands)), [pages]);
  /** Área con contenido de cada página, sin encabezado ni pie del programa si así se pidió. */
  const autos = useMemo(
    () =>
      pages.map((p, i) => ({
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        auto: skipRepeated ? contentWithout(p.bands, running.repeated[i]) : boundsOf(p.bands),
      })),
    [pages, running, skipRepeated],
  );
  const unionAuto = useMemo(() => unionBySize(autos), [autos]);
  const keyOf = (n: number) => {
    const p = pages[n - 1];
    return p ? sizeKey(p.widthMm, p.heightMm) : "";
  };

  /** El recorte que de verdad se va a aplicar a la página n. */
  function cropFor(n: number): Crop {
    const info = pages[n - 1];
    if (!info) return FULL_PAGE;
    const pad = (c: Crop) => padMm(c, paddingMm, info.widthMm, info.heightMm);
    if (mode === "all") {
      const key = keyOf(n);
      const auto = unionAuto[key];
      return globalCrops[key] ?? (auto ? pad(auto) : FULL_PAGE);
    }
    const auto = autos[n - 1]?.auto;
    return pageCrops[n] ?? (auto ? pad(auto) : FULL_PAGE);
  }

  function setCrop(c: Crop) {
    if (mode === "all") setGlobalCrops((prev) => ({ ...prev, [keyOf(page)]: c }));
    else setPageCrops((prev) => ({ ...prev, [page]: c }));
  }

  const manual =
    mode === "all" ? globalCrops[keyOf(page)] !== undefined : pageCrops[page] !== undefined;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    let pdf: PDFDocumentProxy;
    let bytes: ArrayBuffer;
    try {
      bytes = await file.arrayBuffer();
      pdf = await openPdf(bytes);
    } catch {
      setMessage({ kind: "error", text: "No se pudo abrir el archivo. ¿Es un PDF válido?" });
      return;
    }
    await doc?.loadingTask.destroy(); // libera el PDF anterior
    setDoc(pdf);
    setSourceBytes(new Uint8Array(bytes)); // para copiar las páginas en vectorial
    setFileName(file.name);
    setBaseName(file.name.replace(/\.pdf$/i, ""));
    setPage(1);
    setPages([]);
    setGlobalCrops({});
    setPageCrops({});
    try {
      setProgress({ label: "Analizando páginas", done: 0, total: pdf.numPages });
      const info = await analyzePages(pdf, (done, total) =>
        setProgress({ label: "Analizando páginas", done, total }),
      );
      setPages(info);
    } catch {
      setMessage({ kind: "error", text: "No se pudieron analizar las páginas del PDF." });
    } finally {
      setProgress(null);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    renderPage(doc, page, PREVIEW_DPI, canvas).catch(() => {});
  }, [doc, page]);

  async function exportImages() {
    if (!doc || pages.length === 0) return;
    setMessage(null);
    const folder = await chooseFolder(`${baseName}-imagenes.zip`);
    if (!folder) return;
    const total = doc.numPages;
    try {
      for (let n = 1; n <= total; n++) {
        setProgress({ label: "Exportando imágenes", done: n - 1, total });
        const canvas = await renderCropped(doc, n, dpi, cropFor(n));
        const bytes = await canvasToBytes(canvas, format);
        canvas.width = canvas.height = 0;
        await folder.write({ name: pageFileName(baseName, n, total, format), bytes });
      }
      await folder.finish();
      setMessage({ kind: "ok", text: `${total} imágenes guardadas en ${folder.label}` });
    } catch (e) {
      setMessage({
        kind: "error",
        text: `No se pudieron guardar las imágenes: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setProgress(null);
    }
  }

  async function onTemplate(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      const t = await loadTemplate(new Uint8Array(await file.arrayBuffer()));
      setTemplate({ name: file.name, t });
      setMaxHeightMm(suggestedMaxHeightMm(t.setup));
      setPdfMargins(marginsFrom(t.setup));
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function exportWord() {
    if (!doc || pages.length === 0) return;
    setMessage(null);
    const total = doc.numPages;
    const images: DocxImage[] = [];
    try {
      for (let n = 1; n <= total; n++) {
        setProgress({ label: "Preparando el Word", done: n - 1, total });
        const c = cropFor(n);
        const p = pages[n - 1];
        const isLandscapePage = p.widthMm > p.heightMm;
        let canvas = await renderCropped(doc, n, dpi, c);
        let widthMm = (c.x1 - c.x0) * p.widthMm;
        let heightMm = (c.y1 - c.y0) * p.heightMm;
        let landscape = isLandscapePage;
        if (isLandscapePage && landscapeMode === "rotate") {
          canvas = rotateLeft(canvas);
          [widthMm, heightMm] = [heightMm, widthMm];
          landscape = false;
        }
        const bytes = await canvasToBytes(canvas, format);
        canvas.width = canvas.height = 0;
        images.push({
          bytes,
          ext: format === "png" ? "png" : "jpeg",
          widthMm,
          heightMm,
          landscape,
        });
      }
      setProgress({ label: "Armando el Word", done: total, total });
      const docx = await buildDocx(images, { maxHeightMm }, template?.t);
      const saved = await saveFile(`${baseName}.docx`, docx, {
        name: "Documento de Word",
        extensions: ["docx"],
      });
      if (saved) setMessage({ kind: "ok", text: `Word con ${total} páginas guardado.` });
    } catch (e) {
      setMessage({
        kind: "error",
        text: `No se pudo crear el Word: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setProgress(null);
    }
  }

  async function exportPdf() {
    if (!doc || !sourceBytes || pages.length === 0) return;
    setMessage(null);
    setProgress({ label: "Armando el PDF", done: 0, total: 1 });
    try {
      const crops = pages.map((_, i) => ({ crop: cropFor(i + 1) }));
      const pdf = await buildVectorPdf(sourceBytes, crops, {
        margins: pdfMargins,
        landscapeMode,
        letterhead: letterhead?.bytes,
      });
      const saved = await saveFile(`${baseName}-anexo.pdf`, pdf, {
        name: "PDF",
        extensions: ["pdf"],
      });
      if (saved)
        setMessage({
          kind: "ok",
          text: `PDF con ${pages.length} páginas guardado (${(pdf.length / 1048576).toFixed(1)} MB).`,
        });
    } catch (e) {
      setMessage({
        kind: "error",
        text: `No se pudo crear el PDF: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setProgress(null);
    }
  }

  async function onLetterhead(file: File | undefined) {
    if (!file) return;
    setLetterhead({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  }

  const info = pages[page - 1];
  const crop = cropFor(page);
  const setup = template?.t.setup ?? DEFAULT_SETUP;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <h1 className="font-semibold">MemoriaCap</h1>
        <label
          className={`rounded bg-slate-800 px-3 py-1.5 text-sm text-white dark:bg-slate-200 dark:text-slate-900 ${
            busy ? "pointer-events-none opacity-50" : "cursor-pointer"
          }`}
        >
          Abrir PDF…
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {fileName && <span className="truncate text-sm text-slate-500">{fileName}</span>}
        <button type="button" className="ml-auto text-sm underline" onClick={() => setAbout(true)}>
          Acerca de
        </button>
      </header>

      {message && (
        <p
          role="status"
          className={`px-4 py-2 text-sm ${
            message.kind === "ok" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        {doc && (
          <aside className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 p-4 text-sm dark:border-slate-700">
            <Section title="Recorte">
              <fieldset className="flex flex-col gap-1">
                <Radio
                  name="mode"
                  checked={mode === "all"}
                  onChange={() => setMode("all")}
                  label="Mismo recorte para todas"
                />
                <Radio
                  name="mode"
                  checked={mode === "page"}
                  onChange={() => setMode("page")}
                  label="Un recorte por página"
                />
              </fieldset>
              <NumberField
                label="Margen alrededor del contenido"
                unit="mm"
                value={paddingMm}
                min={0}
                max={30}
                onChange={setPaddingMm}
              />
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={skipRepeated}
                  onChange={(e) => setSkipRepeated(e.target.checked)}
                />
                <span>
                  Quitar encabezado y pie del programa
                  <span className="block text-xs text-slate-500">
                    {running.pagesWithHeader + running.pagesWithFooter === 0
                      ? "No se encontraron repetidos"
                      : `Encabezado en ${running.pagesWithHeader} y pie en ${running.pagesWithFooter} de ${pages.length} páginas`}
                  </span>
                </span>
              </label>
              <p className="text-xs text-slate-500">
                Arrastre los bordes naranjas o selecciónelos y use las flechas (Shift para mover
                más).
              </p>
              {manual && (
                <button
                  type="button"
                  className="self-start underline"
                  onClick={() =>
                    mode === "all"
                      ? setGlobalCrops(({ [keyOf(page)]: _, ...rest }) => rest)
                      : setPageCrops(({ [page]: _, ...rest }) => rest)
                  }
                >
                  Volver al recorte automático
                </button>
              )}
            </Section>

            <Section title="Salida">
              <NumberField
                label="Resolución"
                unit="dpi"
                value={dpi}
                min={72}
                max={600}
                step={10}
                onChange={setDpi}
              />
              <fieldset className="flex gap-4">
                <Radio
                  name="fmt"
                  checked={format === "png"}
                  onChange={() => setFormat("png")}
                  label="PNG (nítido)"
                />
                <Radio
                  name="fmt"
                  checked={format === "jpg"}
                  onChange={() => setFormat("jpg")}
                  label="JPG (liviano)"
                />
              </fieldset>
              <label className="flex flex-col gap-1">
                Nombre de salida
                <input
                  className="rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-600"
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                />
              </label>
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1">Páginas horizontales</legend>
                <Radio
                  name="land"
                  checked={landscapeMode === "rotate"}
                  onChange={() => setLandscapeMode("rotate")}
                  label="Girarlas para que queden de pie"
                />
                <Radio
                  name="land"
                  checked={landscapeMode === "section"}
                  onChange={() => setLandscapeMode("section")}
                  label="Ponerlas en hoja horizontal"
                />
              </fieldset>
            </Section>

            <Section title="Word">
              <div className="flex flex-col gap-1">
                <span>Plantilla con encabezado</span>
                <span className="flex items-center gap-2">
                  <label className="cursor-pointer rounded border border-slate-300 px-2 py-1 dark:border-slate-600">
                    Elegir…
                    <input
                      type="file"
                      accept=".docx,.dotx"
                      className="hidden"
                      onChange={(e) => {
                        onTemplate(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <span className="min-w-0 truncate text-xs" title={template?.name}>
                    {template ? template.name : "Ninguna: hoja carta en blanco"}
                  </span>
                  {template && (
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => {
                        setTemplate(null);
                        setMaxHeightMm(suggestedMaxHeightMm(DEFAULT_SETUP));
                      }}
                    >
                      Quitar
                    </button>
                  )}
                </span>
                <span className="text-xs text-slate-500">
                  Hoja de {Math.round(setup.widthMm)} × {Math.round(setup.heightMm)} mm; ancho útil{" "}
                  {Math.round(setup.widthMm - setup.marginLeftMm - setup.marginRightMm)} mm.
                </span>
              </div>
              <NumberField
                label="Altura máxima de cada imagen"
                unit="mm"
                value={maxHeightMm}
                min={50}
                max={Math.round(setup.heightMm)}
                onChange={setMaxHeightMm}
              />
              <p className="-mt-2 text-xs text-slate-500">
                Si alguna imagen pasa a la hoja siguiente, bájela unos milímetros.
              </p>
              <button
                type="button"
                disabled={busy || pages.length === 0}
                onClick={exportWord}
                className="rounded bg-orange-600 px-3 py-2 font-medium text-white disabled:opacity-50"
              >
                Exportar a Word…
              </button>
            </Section>

            <Section title="PDF vectorial">
              <p className="-mt-1 text-xs text-slate-500">
                Las páginas se copian sin pasar a imagen: nítidas a cualquier zoom y livianas.
              </p>
              <div className="flex flex-col gap-1">
                <span>Hoja membretada (PDF)</span>
                <span className="flex items-center gap-2">
                  <label className="cursor-pointer rounded border border-slate-300 px-2 py-1 dark:border-slate-600">
                    Elegir…
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        onLetterhead(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <span className="min-w-0 truncate text-xs" title={letterhead?.name}>
                    {letterhead ? letterhead.name : "Ninguna: hoja carta en blanco"}
                  </span>
                  {letterhead && (
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => setLetterhead(null)}
                    >
                      Quitar
                    </button>
                  )}
                </span>
                <span className="text-xs text-slate-500">
                  Guarde la plantilla de Word como PDF (Archivo → Guardar como → PDF). Si trae
                  número de página, saldrá el mismo en todas: bórrelo antes de guardarla.
                </span>
              </div>
              <fieldset className="grid grid-cols-2 gap-x-3 gap-y-2">
                <legend className="mb-1">Márgenes (mm)</legend>
                {(
                  [
                    ["top", "Arriba"],
                    ["bottom", "Abajo"],
                    ["left", "Izquierda"],
                    ["right", "Derecha"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex flex-col text-xs">
                    {label}
                    <input
                      type="number"
                      className="w-full rounded border border-slate-300 bg-transparent px-2 py-1 text-sm dark:border-slate-600"
                      min={0}
                      max={150}
                      value={Math.round(pdfMargins[key])}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n >= 0)
                          setPdfMargins((m) => ({ ...m, [key]: Math.min(150, n) }));
                      }}
                    />
                  </label>
                ))}
              </fieldset>
              <button
                type="button"
                disabled={busy || pages.length === 0}
                onClick={exportPdf}
                className="rounded bg-orange-600 px-3 py-2 font-medium text-white disabled:opacity-50"
              >
                Exportar a PDF…
              </button>
            </Section>

            <Section title="Imágenes sueltas">
              <span className="text-xs text-slate-500">
                {pageFileName(baseName, 1, doc.numPages, format)}, …
              </span>
              <button
                type="button"
                disabled={busy || pages.length === 0}
                onClick={exportImages}
                className="rounded border border-orange-600 px-3 py-2 font-medium text-orange-600 disabled:opacity-50"
              >
                Exportar {doc.numPages} imágenes…
              </button>
            </Section>
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col items-center gap-3 overflow-auto p-4">
          {!doc && (
            <p className="mt-20 max-w-md text-center text-slate-500">
              Abra el PDF de la memoria de cálculo. La app detecta sola el área con contenido de
              cada página.
            </p>
          )}
          {progress && (
            <div className="w-full max-w-md">
              <p className="mb-1 text-sm">
                {progress.label}: {progress.done} de {progress.total}
              </p>
              <progress className="w-full" value={progress.done} max={progress.total} />
            </div>
          )}
          {doc && (
            <nav className="flex items-center gap-3 text-sm">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ◀
              </button>
              <label className="flex items-center gap-1">
                Página
                <input
                  type="number"
                  className="w-16 rounded border border-slate-300 bg-transparent px-1 text-center dark:border-slate-600"
                  min={1}
                  max={doc.numPages}
                  value={page}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (n >= 1 && n <= doc.numPages) setPage(n);
                  }}
                />
                de {doc.numPages}
              </label>
              <button
                type="button"
                aria-label="Página siguiente"
                disabled={page >= doc.numPages}
                onClick={() => setPage((p) => p + 1)}
              >
                ▶
              </button>
              {info && info.bands.length === 0 && (
                <span className="text-slate-500">(página en blanco)</span>
              )}
            </nav>
          )}
          <div className="relative shadow-lg" hidden={!doc}>
            <canvas ref={canvasRef} className="block h-auto max-h-[calc(100vh-9rem)] w-auto" />
            {info && <CropEditor crop={crop} onChange={setCrop} />}
          </div>
        </main>
      </div>

      {about && <About onClose={() => setAbout(false)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Radio(props: { name: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2">
      <input type="radio" name={props.name} checked={props.checked} onChange={props.onChange} />
      {props.label}
    </label>
  );
}

function NumberField(props: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      {props.label}
      <span className="flex items-center gap-2">
        <input
          type="number"
          className="w-24 rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-600"
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) props.onChange(Math.min(props.max, Math.max(props.min, n)));
          }}
        />
        {props.unit}
      </span>
    </label>
  );
}
