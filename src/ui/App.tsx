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
import { appliesTo, MASK_COLORS, type Mask } from "../core/mask";
import { openPdf, renderPage } from "../core/pdf";
import {
  cropFromMarginsMm,
  loadLastSettings,
  type Settings,
  saveLastSettings,
  serializeProfile,
  type VicSettings,
} from "../core/profile";
import {
  analyzePages,
  canvasToBytes,
  type ImageFormat,
  type PageInfo,
  renderCropped,
  rotateLeft,
} from "../core/render";
import { reviewReasons } from "../core/review";
import { buildVectorPdf, type MarginsMm, marginsFrom, type Numbering } from "../core/vectorpdf";
import { chooseFolder, saveFile } from "../platform/save";
import { About } from "./About";
import { CropEditor } from "./CropEditor";
import { FileButton, Icon, Logo, NumberInput } from "./controls";
import { ExportPanel, type Target } from "./ExportPanel";
import { MaskEditor } from "./MaskEditor";
import { ProfileMenu } from "./ProfileMenu";
import { ReviewPanel } from "./ReviewPanel";
import { StartScreen } from "./StartScreen";
import { type Step, Stepper } from "./Stepper";
import { type Thumb, type ThumbFilter, Thumbnails } from "./Thumbnails";

const PREVIEW_DPI = 110;

const DEFAULT_SETTINGS: Settings = {
  mode: "all",
  paddingMm: 3,
  skipRepeated: true,
  globalCrops: {},
  dpi: 250,
  format: "png",
  landscapeMode: "rotate",
  maxHeightMm: suggestedMaxHeightMm(DEFAULT_SETUP),
  pdfMargins: marginsFrom(DEFAULT_SETUP),
  numbering: null,
  masks: [],
};

type Mode = "all" | "page";

export function App() {
  // La última configuración usada en este equipo se lee antes del primer render, para que nada
  // la pise mientras se carga.
  const [initial] = useState(() => loadLastSettings(DEFAULT_SETTINGS) ?? DEFAULT_SETTINGS);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [paddingMm, setPaddingMm] = useState(initial.paddingMm);
  // En modo "todas", el recorte manual se guarda por tamaño de hoja (vertical y horizontal aparte).
  const [globalCrops, setGlobalCrops] = useState<Record<string, Crop>>(initial.globalCrops);
  const [pageCrops, setPageCrops] = useState<Record<number, Crop>>({});
  // Un recorte general que vino de un perfil o un .vic sirve para el próximo PDF; uno ajustado a
  // mano era para este PDF y se descarta al abrir otro.
  const [cropsFromProfile, setCropsFromProfile] = useState(false);
  const [dpi, setDpi] = useState(initial.dpi);
  const [format, setFormat] = useState<ImageFormat>(initial.format);
  const [baseName, setBaseName] = useState("anexo");
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(
    null,
  );
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [about, setAbout] = useState(false);
  const [template, setTemplate] = useState<{ name: string; t: Template } | null>(null);
  const [maxHeightMm, setMaxHeightMm] = useState(initial.maxHeightMm);
  const [landscapeMode, setLandscapeMode] = useState(initial.landscapeMode);
  const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null);
  const [letterhead, setLetterhead] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [pdfMargins, setPdfMargins] = useState<MarginsMm>(initial.pdfMargins);
  const [numbering, setNumbering] = useState<Numbering | null>(initial.numbering);
  const [masks, setMasks] = useState<Mask[]>(initial.masks);
  const [selectedMask, setSelectedMask] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("open");
  /** Número de la primera hoja del Word para seguir la numeración del informe (null = plantilla). */
  const [wordStartAt, setWordStartAt] = useState<number | null>(null);
  const [filter, setFilter] = useState<ThumbFilter>("all");
  const [target, setTarget] = useState<Target>("word");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busy = progress !== null;

  const [skipRepeated, setSkipRepeated] = useState(initial.skipRepeated);

  // ---- Perfil: toda la configuración junta, para guardarla, cargarla y recordarla ----
  const settings: Settings = {
    mode,
    paddingMm,
    skipRepeated,
    globalCrops,
    dpi,
    format,
    landscapeMode,
    maxHeightMm,
    pdfMargins,
    numbering,
    masks,
  };
  function applySettings(s: Settings) {
    setMode(s.mode);
    setPaddingMm(s.paddingMm);
    setSkipRepeated(s.skipRepeated);
    setGlobalCrops(s.globalCrops);
    setDpi(s.dpi);
    setFormat(s.format);
    setLandscapeMode(s.landscapeMode);
    setMaxHeightMm(s.maxHeightMm);
    setPdfMargins(s.pdfMargins);
    setNumbering(s.numbering);
    setMasks(s.masks);
    setSelectedMask(null);
    setCropsFromProfile(Object.keys(s.globalCrops).length > 0);
  }
  // Se recuerda en este equipo cada vez que cambia algo.
  const serialized = serializeProfile(settings);
  useEffect(() => saveLastSettings(serialized), [serialized]);

  /** Un .vic de ImageCap trae márgenes de recorte: se aplican a cada tamaño de hoja del PDF. */
  function applyVic(v: VicSettings) {
    if (pages.length === 0) {
      setMessage({
        kind: "error",
        text: "Abra primero el PDF: los márgenes del .vic dependen del tamaño de la hoja.",
      });
      return;
    }
    const crops: Record<string, Crop> = {};
    for (const p of pages) {
      crops[sizeKey(p.widthMm, p.heightMm)] = cropFromMarginsMm(v.marginsMm, p.widthMm, p.heightMm);
    }
    setMode("all");
    setGlobalCrops(crops);
    setCropsFromProfile(true);
    setDpi(v.dpi);
    setFormat(v.format);
    if (v.maxHeightMm) setMaxHeightMm(v.maxHeightMm);
    setMessage({ kind: "ok", text: "Márgenes de ImageCap aplicados." });
  }
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
    // Una página con recorte propio manda, también en "Igual en todas".
    if (pageCrops[n]) return pageCrops[n];
    if (mode === "all") {
      const key = keyOf(n);
      const auto = unionAuto[key];
      return globalCrops[key] ?? (auto ? pad(auto) : FULL_PAGE);
    }
    const auto = autos[n - 1]?.auto;
    return auto ? pad(auto) : FULL_PAGE;
  }

  function setCrop(c: Crop) {
    if (mode === "all" && !pageCrops[page]) {
      setGlobalCrops((prev) => ({ ...prev, [keyOf(page)]: c }));
      setCropsFromProfile(false);
    } else setPageCrops((prev) => ({ ...prev, [page]: c }));
  }

  const ownCrop = pageCrops[page] !== undefined;
  const manual = mode === "all" ? globalCrops[keyOf(page)] !== undefined : ownCrop;

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
    setStep("open");
    setDoc(pdf);
    setSourceBytes(new Uint8Array(bytes)); // para copiar las páginas en vectorial
    setFileName(file.name);
    setBaseName(file.name.replace(/\.pdf$/i, ""));
    setPage(1);
    setPages([]);
    setPageCrops({}); // los recortes por página eran del PDF anterior
    if (!cropsFromProfile) setGlobalCrops({});
    try {
      setProgress({ label: "Analizando páginas", done: 0, total: pdf.numPages });
      const info = await analyzePages(pdf, (done, total) =>
        setProgress({ label: "Analizando páginas", done, total }),
      );
      setPages(info);
      setFilter("all");
      setStep("review");
    } catch {
      setMessage({ kind: "error", text: "No se pudieron analizar las páginas del PDF." });
    } finally {
      setProgress(null);
    }
  }

  // El lienzo de la vista previa aparece cuando termina el análisis: por eso depende de las páginas.
  const workspace = pages.length > 0 && step !== "open";
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas || !workspace) return;
    renderPage(doc, page, PREVIEW_DPI, canvas).catch(() => {});
  }, [doc, page, workspace]);

  async function exportImages() {
    if (!doc || pages.length === 0) return;
    setMessage(null);
    const folder = await chooseFolder(`${baseName}-imagenes.zip`);
    if (!folder) return;
    const total = doc.numPages;
    try {
      for (let n = 1; n <= total; n++) {
        setProgress({ label: "Exportando imágenes", done: n - 1, total });
        const canvas = await renderCropped(doc, n, dpi, cropFor(n), masks);
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
        let canvas = await renderCropped(doc, n, dpi, c, masks);
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
      const docx = await buildDocx(
        images,
        { maxHeightMm, pageNumberStart: wordStartAt },
        template?.t,
      );
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
      const crops = pages.map((_, i) => ({
        crop: cropFor(i + 1),
        masks: masks
          .filter((m) => appliesTo(m, i + 1))
          .map((m) => ({ rect: m.rect, rgb: MASK_COLORS[m.color].rgb })),
      }));
      const pdf = await buildVectorPdf(sourceBytes, crops, {
        margins: pdfMargins,
        landscapeMode,
        letterhead: letterhead?.bytes,
        numbering: numbering ?? undefined,
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

  // ---- Qué páginas merecen una mirada ----
  const documentHasRepeated = skipRepeated && running.pagesWithHeader + running.pagesWithFooter > 0;
  const thumbs: Thumb[] = pages.map((p, i) => {
    const crop = cropFor(i + 1);
    return {
      n: i + 1,
      src: p.thumb,
      crop,
      landscape: p.widthMm > p.heightMm,
      own: mode === "all" && pageCrops[i + 1] !== undefined,
      reasons: reviewReasons({
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        bandCount: p.bands.length,
        content: autos[i]?.auto ?? null,
        crop,
        hadRepeated: (running.repeated[i]?.size ?? 0) > 0,
        documentHasRepeated,
      }),
    };
  });
  const reviewCount = thumbs.filter((t) => t.reasons.some((r) => r !== "landscape")).length;
  const cutCount = thumbs.filter((t) => t.reasons.includes("cut")).length;

  function exportNow() {
    if (target === "word") return exportWord();
    if (target === "pdf") return exportPdf();
    return exportImages();
  }

  const info = pages[page - 1];
  const crop = cropFor(page);
  const setup = template?.t.setup ?? DEFAULT_SETUP;
  const ready = doc !== null && pages.length > 0;

  return (
    <div className="flex h-screen flex-col bg-canvas text-ink">
      {/* Barra superior */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <Logo size={24} />
        <span className="text-[15px] font-semibold">MemoriaCap</span>
        {ready && (
          <span className="min-w-0 truncate text-[13px] text-subtle" title={fileName}>
            {fileName} · {pages.length} páginas
          </span>
        )}
        <span className="flex-1" />
        {ready && (
          <FileButton accept="application/pdf" onFile={onFile} disabled={busy}>
            Abrir otro PDF
          </FileButton>
        )}
        <ProfileMenu
          settings={settings}
          disabled={busy}
          onApply={(s) => {
            applySettings(s);
            setMessage({ kind: "ok", text: "Perfil cargado." });
          }}
          onVic={applyVic}
          onError={(text) => setMessage({ kind: "error", text })}
          onSaved={() => setMessage({ kind: "ok", text: "Perfil guardado." })}
        />
        <button
          type="button"
          className="h-9 rounded-md px-2 text-[13px] text-muted hover:text-ink"
          onClick={() => setAbout(true)}
        >
          Acerca de
        </button>
      </header>

      <Stepper
        step={ready ? step : "open"}
        canReach={(s) => (s === "open" ? true : ready)}
        onStep={setStep}
      />

      {!ready || step === "open" ? (
        <StartScreen
          onFile={onFile}
          progress={progress}
          current={ready ? { name: fileName, pages: pages.length } : null}
          onContinue={() => setStep("review")}
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          <Thumbnails
            thumbs={thumbs}
            page={page}
            filter={filter}
            onFilter={setFilter}
            onPage={setPage}
          />

          {/* Vista previa */}
          <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 overflow-auto p-5">
            <div className="relative shadow-[0_1px_3px_rgba(20,32,46,0.12),0_8px_24px_rgba(20,32,46,0.08)]">
              <canvas
                ref={canvasRef}
                className="block h-auto max-h-[calc(100vh-15rem)] w-auto bg-surface"
              />
              {info && step === "review" && <CropEditor crop={crop} onChange={setCrop} />}
              {info && step === "export" && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-hidden"
                >
                  <span
                    className="absolute border-2 border-accent shadow-[0_0_0_9999px_rgba(20,32,46,0.38)]"
                    style={{
                      left: `${crop.x0 * 100}%`,
                      top: `${crop.y0 * 100}%`,
                      width: `${(crop.x1 - crop.x0) * 100}%`,
                      height: `${(crop.y1 - crop.y0) * 100}%`,
                    }}
                  />
                </span>
              )}
              {info && (
                <MaskEditor
                  masks={masks}
                  page={page}
                  selected={step === "review" ? selectedMask : null}
                  onSelect={setSelectedMask}
                  onChange={(id, rect) =>
                    setMasks((all) => all.map((m) => (m.id === id ? { ...m, rect } : m)))
                  }
                />
              )}
            </div>
            <nav aria-label="Páginas" className="flex items-center gap-2.5 text-[13px] text-muted">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => setPage((n) => n - 1)}
                className="flex size-9 items-center justify-center rounded-md border border-line-strong bg-surface text-ink disabled:opacity-40"
              >
                <Icon name="left" />
              </button>
              <label className="flex items-center gap-1.5">
                Página
                <NumberInput
                  aria-label="Número de página"
                  className="h-9 w-16 rounded-md border border-line-strong bg-surface text-center font-mono text-sm text-ink"
                  min={1}
                  max={pages.length}
                  value={page}
                  onChange={(n) => setPage(Math.round(n))}
                />
                de {pages.length}
              </label>
              <button
                type="button"
                aria-label="Página siguiente"
                disabled={page >= pages.length}
                onClick={() => setPage((n) => n + 1)}
                className="flex size-9 items-center justify-center rounded-md border border-line-strong bg-surface text-ink disabled:opacity-40"
              >
                <Icon name="right" />
              </button>
            </nav>
          </main>

          {/* Panel del paso */}
          <aside className="w-[22rem] shrink-0 border-l border-line bg-surface">
            {step === "export" ? (
              <ExportPanel
                totalPages={pages.length}
                target={target}
                onTarget={setTarget}
                baseName={baseName}
                onBaseName={setBaseName}
                dpi={dpi}
                onDpi={setDpi}
                format={format}
                onFormat={setFormat}
                landscapeMode={landscapeMode}
                onLandscapeMode={setLandscapeMode}
                hasLandscape={thumbs.some((t) => t.landscape)}
                hasMasks={masks.length > 0}
                templateName={template?.name ?? null}
                setup={setup}
                onTemplate={onTemplate}
                onClearTemplate={() => {
                  setTemplate(null);
                  setMaxHeightMm(suggestedMaxHeightMm(DEFAULT_SETUP));
                }}
                maxHeightMm={maxHeightMm}
                onMaxHeight={setMaxHeightMm}
                wordStartAt={wordStartAt}
                onWordStartAt={setWordStartAt}
                letterheadName={letterhead?.name ?? null}
                onLetterhead={onLetterhead}
                onClearLetterhead={() => setLetterhead(null)}
                pdfMargins={pdfMargins}
                onPdfMargins={setPdfMargins}
                numbering={numbering}
                onNumbering={setNumbering}
                progress={progress}
                cutCount={cutCount}
                onReview={() => {
                  setStep("review");
                  setFilter("review");
                }}
                onExport={exportNow}
              />
            ) : (
              <ReviewPanel
                totalPages={pages.length}
                page={page}
                pageReasons={thumbs[page - 1]?.reasons ?? []}
                pagesWithHeader={running.pagesWithHeader}
                pagesWithFooter={running.pagesWithFooter}
                reviewCount={reviewCount}
                mode={mode}
                onMode={setMode}
                paddingMm={paddingMm}
                onPadding={setPaddingMm}
                skipRepeated={skipRepeated}
                onSkipRepeated={setSkipRepeated}
                manual={manual}
                ownCrop={ownCrop}
                onOwnCrop={(on) =>
                  on
                    ? setPageCrops((prev) => ({ ...prev, [page]: cropFor(page) }))
                    : setPageCrops(({ [page]: _, ...rest }) => rest)
                }
                onResetCrop={() =>
                  mode === "all"
                    ? setGlobalCrops(({ [keyOf(page)]: _, ...rest }) => rest)
                    : setPageCrops(({ [page]: _, ...rest }) => rest)
                }
                masks={masks}
                selectedMask={selectedMask}
                onSelectMask={setSelectedMask}
                onMasks={setMasks}
                onShowReview={() => {
                  setFilter("review");
                  const first = thumbs.find((t) => t.reasons.some((r) => r !== "landscape"));
                  if (first) setPage(first.n);
                }}
                onNext={() => setStep("export")}
              />
            )}
          </aside>
        </div>
      )}

      {/* Mensajes */}
      {message && (
        <div
          role="status"
          className={`fixed right-5 bottom-5 z-40 flex max-w-md items-start gap-3 rounded-lg p-4 text-[13px] shadow-lg ${
            message.kind === "ok" ? "bg-ok-soft text-ok-ink" : "bg-bad-soft text-bad-ink"
          }`}
        >
          <span className="mt-px shrink-0">
            <Icon name={message.kind === "ok" ? "check" : "alert"} size={17} />
          </span>
          <span className="flex-1">{message.text}</span>
          <button
            type="button"
            aria-label="Cerrar mensaje"
            onClick={() => setMessage(null)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {about && <About onClose={() => setAbout(false)} />}
    </div>
  );
}
