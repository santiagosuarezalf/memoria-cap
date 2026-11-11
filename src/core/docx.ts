// Arma un .docx con una imagen por hoja. Si hay plantilla, conserva su encabezado, pie, estilos y
// márgenes, y reemplaza el cuerpo. Todo se hace sobre el XML con texto, sin DOM, para que se
// pueda probar en Node y no dependa del navegador.

import JSZip from "jszip";
import { mmToEmu } from "./units";

const TWIP_PER_MM = 1440 / 25.4;
const twipToMm = (t: number) => t / TWIP_PER_MM;
const mmToTwip = (mm: number) => Math.round(mm * TWIP_PER_MM);

export interface PageSetup {
  widthMm: number;
  heightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
}

/** Carta con márgenes de 2,5 cm: lo que sale si no se elige plantilla. */
export const DEFAULT_SETUP: PageSetup = {
  widthMm: 215.9,
  heightMm: 279.4,
  marginTopMm: 25,
  marginBottomMm: 25,
  marginLeftMm: 25,
  marginRightMm: 25,
};

/** Espacio que se le deja al encabezado y al pie además de los márgenes. */
export const HEADER_FOOTER_RESERVE_MM = 25;

export const usableWidthMm = (s: PageSetup) => s.widthMm - s.marginLeftMm - s.marginRightMm;
export const usableHeightMm = (s: PageSetup) => s.heightMm - s.marginTopMm - s.marginBottomMm;

/** Altura máxima sugerida para las imágenes en una hoja vertical. */
export const suggestedMaxHeightMm = (s: PageSetup) =>
  Math.max(50, Math.floor(usableHeightMm(s) - HEADER_FOOTER_RESERVE_MM));

export interface Template {
  /** Bytes originales: se vuelven a abrir en cada exportación para no acumular cambios. */
  bytes: Uint8Array;
  setup: PageSetup;
  /** El sectPr final del cuerpo, con referencias a encabezado y pie. */
  sectPr: string;
}

const attr = (xml: string, el: string, name: string): number | null => {
  const m = xml.match(new RegExp(`<w:${el}\\b[^>]*\\sw:${name}="(-?\\d+)"`));
  return m ? Number(m[1]) : null;
};

/** Lee la configuración de página de la última sección del documento. */
export function parseSectPr(sectPr: string): PageSetup {
  const w = attr(sectPr, "pgSz", "w");
  const h = attr(sectPr, "pgSz", "h");
  if (!w || !h) throw new Error("La plantilla no define el tamaño de la hoja");
  const m = (name: string, fallback: number) => Math.abs(attr(sectPr, "pgMar", name) ?? fallback);
  return {
    widthMm: twipToMm(w),
    heightMm: twipToMm(h),
    marginTopMm: twipToMm(m("top", 1440)),
    marginBottomMm: twipToMm(m("bottom", 1440)),
    marginLeftMm: twipToMm(m("left", 1440)),
    marginRightMm: twipToMm(m("right", 1440)),
  };
}

/**
 * El sectPr que cierra el cuerpo (la última sección). Un documento con varias secciones tiene
 * otros sectPr dentro de párrafos; por eso se busca hacia atrás desde </w:body> y no con una
 * expresión regular, que empezaría en el primero y se tragaría el cuerpo entero.
 */
export function finalSectPr(doc: string): string | null {
  const end = doc.lastIndexOf("</w:body>");
  if (end === -1) return null;
  const start = doc.lastIndexOf("<w:sectPr", end);
  if (start === -1) return null;
  const close = doc.indexOf("</w:sectPr>", start);
  if (close === -1 || close > end) return null;
  const xml = doc.slice(start, close + "</w:sectPr>".length);
  // Entre el sectPr y </w:body> no debe haber nada más: si no, es de un párrafo.
  return doc.slice(start + xml.length, end).trim() === "" ? xml : null;
}

export async function loadTemplate(bytes: Uint8Array): Promise<Template> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error("El archivo no es un documento de Word (.docx o .dotx)");
  }
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) throw new Error("El archivo no es un documento de Word (.docx o .dotx)");
  const sectPr = finalSectPr(doc);
  if (!sectPr) throw new Error("No se encontró la configuración de página de la plantilla");
  return { bytes, setup: parseSectPr(sectPr), sectPr };
}

export interface DocxImage {
  bytes: Uint8Array;
  ext: "png" | "jpeg";
  /** Tamaño real del recorte en mm (antes de escalar). */
  widthMm: number;
  heightMm: number;
  /** Ponerla en una sección horizontal. */
  landscape: boolean;
}

export interface DocxOptions {
  /** Altura máxima de la imagen en una hoja vertical. */
  maxHeightMm: number;
  /** Número de la primera hoja, para seguir la numeración del informe; null = como la plantilla. */
  pageNumberStart?: number | null;
}

/** Escala para que la imagen quepa en la caja, agrandando o achicando y sin deformar. */
export function fitInBox(wMm: number, hMm: number, boxW: number, boxH: number) {
  const k = Math.min(boxW / wMm, boxH / hMm);
  return { widthMm: wMm * k, heightMm: hMm * k };
}

/** Caja disponible para la imagen en una hoja vertical u horizontal. */
export function boxFor(setup: PageSetup, maxHeightMm: number, landscape: boolean) {
  const reserve = usableHeightMm(setup) - maxHeightMm;
  if (!landscape) return { w: usableWidthMm(setup), h: maxHeightMm };
  // En horizontal la hoja se gira y los márgenes se quedan como están.
  return {
    w: setup.heightMm - setup.marginLeftMm - setup.marginRightMm,
    h: setup.widthMm - setup.marginTopMm - setup.marginBottomMm - reserve,
  };
}

/** Elementos que en un sectPr van después de <w:pgNumType> (Word exige ese orden). */
const AFTER_PGNUMTYPE = [
  "cols",
  "formProt",
  "vAlign",
  "noEndnote",
  "titlePg",
  "textDirection",
  "bidi",
  "rtlGutter",
  "docGrid",
  "printerSettings",
  "sectPrChange",
];

/**
 * Ajusta la numeración de una sección. La primera puede empezar en un número dado (el anexo
 * continúa la numeración del informe); las demás nunca reinician, aunque la plantilla lo diga, o
 * cada cambio a horizontal volvería a empezar la cuenta.
 */
export function withPageNumbering(sectPr: string, startAt: number | null, first: boolean): string {
  const existing = sectPr.match(/<w:pgNumType\b[^>]*\/>/)?.[0] ?? null;
  const fmt = existing?.match(/\sw:fmt="[^"]*"/)?.[0] ?? "";
  let el: string | null;
  if (first && startAt !== null) el = `<w:pgNumType${fmt} w:start="${startAt}"/>`;
  else if (first)
    el = existing; // la primera sección queda como la plantilla
  else el = fmt ? `<w:pgNumType${fmt}/>` : null;
  const without = existing ? sectPr.replace(existing, "") : sectPr;
  if (!el) return without;
  for (const name of AFTER_PGNUMTYPE) {
    const i = without.indexOf(`<w:${name}`);
    if (i !== -1) return without.slice(0, i) + el + without.slice(i);
  }
  return without.replace("</w:sectPr>", `${el}</w:sectPr>`);
}

/** sectPr para una sección, girando la hoja si es horizontal. */
export function sectPrFor(base: string, landscape: boolean, setup: PageSetup): string {
  const portraitW = mmToTwip(Math.min(setup.widthMm, setup.heightMm));
  const portraitH = mmToTwip(Math.max(setup.widthMm, setup.heightMm));
  const pgSz = landscape
    ? `<w:pgSz w:w="${portraitH}" w:h="${portraitW}" w:orient="landscape"/>`
    : `<w:pgSz w:w="${portraitW}" w:h="${portraitH}"/>`;
  // Sin <w:type>, cada sección empieza en hoja nueva.
  return base.replace(/<w:pgSz\b[^>]*\/>/, pgSz).replace(/<w:type\b[^>]*\/>/, "");
}

const NS = {
  wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  pic: "http://schemas.openxmlformats.org/drawingml/2006/picture",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
};

function imageParagraph(
  relId: string,
  n: number,
  wMm: number,
  hMm: number,
  opts: { pageBreakBefore: boolean; sectPr?: string },
) {
  const cx = mmToEmu(wMm);
  const cy = mmToEmu(hMm);
  const id = 90000 + n;
  return (
    "<w:p><w:pPr>" +
    (opts.pageBreakBefore ? "<w:pageBreakBefore/>" : "") +
    '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>' +
    (opts.sectPr ?? "") +
    "</w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing>" +
    `<wp:inline xmlns:wp="${NS.wp}" distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Pagina ${n}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${NS.a}" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="${NS.a}"><a:graphicData uri="${NS.pic}">` +
    `<pic:pic xmlns:pic="${NS.pic}"><pic:nvPicPr><pic:cNvPr id="${id}" name="Pagina ${n}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip xmlns:r="${NS.r}" r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>"
  );
}

const BLANK_SECTPR = (s: PageSetup) =>
  `<w:sectPr><w:pgSz w:w="${mmToTwip(s.widthMm)}" w:h="${mmToTwip(s.heightMm)}"/>` +
  `<w:pgMar w:top="${mmToTwip(s.marginTopMm)}" w:right="${mmToTwip(s.marginRightMm)}" ` +
  `w:bottom="${mmToTwip(s.marginBottomMm)}" w:left="${mmToTwip(s.marginLeftMm)}" ` +
  'w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';

function blankPackage(setup: PageSetup): { zip: JSZip; sectPr: string } {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      "</Types>",
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>",
  );
  zip.file(
    "word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',
  );
  const sectPr = BLANK_SECTPR(setup);
  zip.file(
    "word/document.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${NS.r}">` +
      `<w:body>${sectPr}</w:body></w:document>`,
  );
  return { zip, sectPr };
}

/** Construye el .docx. Las imágenes van en el orden en que llegan, una por hoja. */
export async function buildDocx(
  images: DocxImage[],
  options: DocxOptions,
  template?: Template,
): Promise<Uint8Array> {
  const setup = template?.setup ?? DEFAULT_SETUP;
  const { zip, sectPr: baseSectPr } = template
    ? { zip: await JSZip.loadAsync(template.bytes), sectPr: template.sectPr }
    : blankPackage(setup);

  // Imágenes y relaciones
  const relsPath = "word/_rels/document.xml.rels";
  let rels = (await zip.file(relsPath)?.async("string")) ?? "";
  const relIds: string[] = [];
  images.forEach((img, i) => {
    const relId = `rIdMemoriaCap${i + 1}`;
    const target = `media/memoriacap-${String(i + 1).padStart(4, "0")}.${img.ext === "png" ? "png" : "jpg"}`;
    zip.file(`word/${target}`, img.bytes);
    rels = rels.replace(
      "</Relationships>",
      `<Relationship Id="${relId}" Type="${NS.r}/image" Target="${target}"/></Relationships>`,
    );
    relIds.push(relId);
  });
  zip.file(relsPath, rels);

  // Tipos de contenido: png y jpg, y una plantilla .dotx pasa a ser documento .docx
  const ctPath = "[Content_Types].xml";
  let ct = (await zip.file(ctPath)?.async("string")) ?? "";
  ct = ct.replace("wordprocessingml.template.main+xml", "wordprocessingml.document.main+xml");
  for (const [ext, type] of [
    ["png", "image/png"],
    ["jpg", "image/jpeg"],
  ]) {
    if (!new RegExp(`Extension="${ext}"`, "i").test(ct)) {
      ct = ct.replace("<Default ", `<Default Extension="${ext}" ContentType="${type}"/><Default `);
    }
  }
  zip.file(ctPath, ct);

  // Cuerpo: una imagen por hoja. Cada cambio de orientación cierra una sección.
  let body = "";
  let sectionsEmitted = 0;
  const numbered = (sectPr: string) =>
    withPageNumbering(sectPr, options.pageNumberStart ?? null, sectionsEmitted++ === 0);
  images.forEach((img, i) => {
    const box = boxFor(setup, options.maxHeightMm, img.landscape);
    const size = fitInBox(img.widthMm, img.heightMm, box.w, box.h);
    const next = images[i + 1];
    const endsSection = next !== undefined && next.landscape !== img.landscape;
    const startsSection = i === 0 || images[i - 1].landscape !== img.landscape;
    body += imageParagraph(relIds[i], i + 1, size.widthMm, size.heightMm, {
      pageBreakBefore: !startsSection,
      sectPr: endsSection ? numbered(sectPrFor(baseSectPr, img.landscape, setup)) : undefined,
    });
  });
  const lastLandscape = images.at(-1)?.landscape ?? false;
  const finalSectPr = numbered(sectPrFor(baseSectPr, lastLandscape, setup));

  const docPath = "word/document.xml";
  const doc = (await zip.file(docPath)?.async("string")) ?? "";
  const start = doc.indexOf("<w:body>");
  const end = doc.lastIndexOf("</w:body>");
  if (start === -1 || end === -1) throw new Error("La plantilla no tiene cuerpo de documento");
  zip.file(
    docPath,
    `${doc.slice(0, start)}<w:body>${body}${finalSectPr}</w:body>${doc.slice(end + "</w:body>".length)}`,
  );

  await dropOrphanImages(zip);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/**
 * Al reemplazar el cuerpo de la plantilla, sus figuras quedan sin uso pero siguen dentro del
 * archivo (un informe de 150 figuras pesaba 20 MB de más). Se borran las relaciones de imagen del
 * documento que ya nadie cita, y el archivo si ninguna otra parte (encabezado, pie) lo usa.
 */
async function dropOrphanImages(zip: JSZip) {
  const relsPath = "word/_rels/document.xml.rels";
  const rels = await zip.file(relsPath)?.async("string");
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!rels || !doc) return;
  const used = new Set([...doc.matchAll(/r:(?:embed|link|id)="([^"]+)"/g)].map((m) => m[1]));
  const orphans: string[] = [];
  const kept = rels.replace(/<Relationship\b[^>]*\/>/g, (rel) => {
    const id = rel.match(/\bId="([^"]+)"/)?.[1];
    const isImage = /Type="[^"]*\/image"/.test(rel);
    const external = /TargetMode="External"/.test(rel);
    if (!id || !isImage || external || used.has(id)) return rel;
    const target = rel.match(/\bTarget="([^"]+)"/)?.[1];
    if (target) orphans.push(target);
    return "";
  });
  zip.file(relsPath, kept);

  // ¿Lo usa otra parte? (los encabezados y pies tienen su propio .rels)
  const otherRels = await Promise.all(
    Object.keys(zip.files)
      .filter((p) => p.endsWith(".rels") && p !== relsPath)
      .map((p) => zip.file(p)?.async("string") ?? ""),
  );
  const stillUsed = (target: string) =>
    kept.includes(`Target="${target}"`) ||
    otherRels.some((r) => r.includes(`Target="${target}"`) || r.includes(`Target="../${target}"`));
  for (const target of orphans) {
    const path = target.startsWith("/") ? target.slice(1) : `word/${target}`;
    if (!stillUsed(target)) zip.remove(path);
  }
}
