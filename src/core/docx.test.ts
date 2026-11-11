import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  boxFor,
  buildDocx,
  DEFAULT_SETUP,
  type DocxImage,
  fitInBox,
  loadTemplate,
  parseSectPr,
  suggestedMaxHeightMm,
} from "./docx";

const LETTER_SECTPR =
  '<w:sectPr><w:headerReference w:type="default" r:id="rId8"/><w:pgSz w:w="12240" w:h="15840"/>' +
  '<w:pgMar w:top="1440" w:right="720" w:bottom="280" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>' +
  '<w:type w:val="continuous"/></w:sectPr>';

/** Plantilla .dotx mínima con encabezado y un párrafo de texto en el cuerpo. */
async function template(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml"/></Types>',
  );
  zip.file(
    "word/_rels/document.xml.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    '<w:document xmlns:w="w" xmlns:r="r"><w:body><w:p><w:r><w:t>TEXTO VIEJO</w:t></w:r></w:p>' +
      `${LETTER_SECTPR}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}

const img = (landscape: boolean): DocxImage => ({
  bytes: new Uint8Array([1, 2, 3]),
  ext: "png",
  widthMm: landscape ? 250 : 180,
  heightMm: landscape ? 180 : 250,
  landscape,
});

describe("configuración de página", () => {
  it("lee tamaño y márgenes en mm", () => {
    const s = parseSectPr(LETTER_SECTPR);
    expect(s.widthMm).toBeCloseTo(215.9, 1);
    expect(s.heightMm).toBeCloseTo(279.4, 1);
    expect(s.marginLeftMm).toBeCloseTo(19.05, 1);
    expect(s.marginBottomMm).toBeCloseTo(4.94, 1);
  });

  it("sugiere una altura parecida a la que usaban a mano (unos 220 mm en carta)", () => {
    expect(suggestedMaxHeightMm(parseSectPr(LETTER_SECTPR))).toBe(224);
  });

  it("escala para llenar la caja sin deformar", () => {
    expect(fitInBox(100, 200, 150, 150)).toEqual({ widthMm: 75, heightMm: 150 });
    expect(fitInBox(100, 50, 150, 150)).toEqual({ widthMm: 150, heightMm: 75 });
  });

  it("en horizontal gira la caja y conserva la reserva para encabezado y pie", () => {
    const s = DEFAULT_SETUP;
    const portrait = boxFor(s, 200, false);
    const landscape = boxFor(s, 200, true);
    expect(portrait.w).toBeCloseTo(165.9, 1);
    expect(landscape.w).toBeCloseTo(229.4, 1);
    // altura útil vertical 229.4, reserva 29.4 → en horizontal 165.9 - 29.4
    expect(landscape.h).toBeCloseTo(136.5, 1);
  });
});

describe("buildDocx", () => {
  it("sin plantilla arma un documento válido con una imagen por hoja", async () => {
    const bytes = await buildDocx([img(false), img(false)], { maxHeightMm: 200 });
    const zip = await JSZip.loadAsync(bytes);
    const doc = await zip.file("word/document.xml")?.async("string");
    expect(doc?.match(/<w:drawing>/g)).toHaveLength(2);
    expect(doc?.match(/<w:pageBreakBefore\/>/g)).toHaveLength(1);
    expect(zip.file("word/media/memoriacap-0001.png")).not.toBeNull();
    const rels = await zip.file("word/_rels/document.xml.rels")?.async("string");
    expect(rels).toContain('Target="media/memoriacap-0002.png"');
    const ct = await zip.file("[Content_Types].xml")?.async("string");
    expect(ct).toContain('Extension="png"');
  });

  it("con plantilla conserva el encabezado, reemplaza el cuerpo y pasa .dotx a .docx", async () => {
    const t = await loadTemplate(await template());
    const zip = await JSZip.loadAsync(await buildDocx([img(false)], { maxHeightMm: 200 }, t));
    const doc = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(doc).not.toContain("TEXTO VIEJO");
    expect(doc).toContain('<w:headerReference w:type="default" r:id="rId8"/>');
    expect(doc).not.toContain("<w:type ");
    const ct = await zip.file("[Content_Types].xml")?.async("string");
    expect(ct).toContain("document.main+xml");
    expect(ct).not.toContain("template.main+xml");
  });

  it("cada cambio de orientación cierra una sección, y las horizontales van giradas", async () => {
    const t = await loadTemplate(await template());
    const pages = [img(false), img(false), img(true), img(true), img(false)];
    const zip = await JSZip.loadAsync(await buildDocx(pages, { maxHeightMm: 200 }, t));
    const doc = (await zip.file("word/document.xml")?.async("string")) ?? "";
    // vertical(2) | horizontal(2) | vertical(1) → 3 secciones
    expect(doc.match(/<w:sectPr>/g)).toHaveLength(3);
    expect(doc.match(/w:orient="landscape"/g)).toHaveLength(1);
    expect(doc.match(/<w:headerReference/g)).toHaveLength(3);
    // salto de página solo dentro de una misma sección
    expect(doc.match(/<w:pageBreakBefore\/>/g)).toHaveLength(2);
  });

  it("exportar dos veces con la misma plantilla no acumula imágenes", async () => {
    const t = await loadTemplate(await template());
    await buildDocx([img(false), img(false)], { maxHeightMm: 200 }, t);
    const zip = await JSZip.loadAsync(await buildDocx([img(false)], { maxHeightMm: 200 }, t));
    const rels = await zip.file("word/_rels/document.xml.rels")?.async("string");
    expect(rels?.match(/rIdMemoriaCap/g)).toHaveLength(1);
  });

  it("borra las figuras del cuerpo viejo, pero no las del encabezado", async () => {
    const zip = await JSZip.loadAsync(await template());
    zip.file("word/media/vieja.png", new Uint8Array([9]));
    zip.file("word/media/logo.png", new Uint8Array([8]));
    zip.file(
      "word/_rels/header1.xml.rels",
      '<Relationships><Relationship Id="rId1" Type="x/image" Target="media/logo.png"/></Relationships>',
    );
    const rels = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
    zip.file(
      "word/_rels/document.xml.rels",
      rels.replace(
        "</Relationships>",
        '<Relationship Id="rId20" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/vieja.png"/>' +
          '<Relationship Id="rId21" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>',
      ),
    );
    const t = await loadTemplate(await zip.generateAsync({ type: "uint8array" }));
    const out = await JSZip.loadAsync(await buildDocx([img(false)], { maxHeightMm: 200 }, t));
    expect(out.file("word/media/vieja.png")).toBeNull();
    expect(out.file("word/media/logo.png")).not.toBeNull();
    const outRels = await out.file("word/_rels/document.xml.rels")?.async("string");
    expect(outRels).not.toContain("rId20");
    expect(outRels).toContain('Id="rId8"'); // el encabezado sigue
  });

  it("con varias secciones toma solo la última y no arrastra el cuerpo viejo", async () => {
    const zip = await JSZip.loadAsync(await template());
    const midSect = '<w:sectPr><w:pgSz w:w="15840" w:h="12240"/></w:sectPr>';
    zip.file(
      "word/document.xml",
      `<w:document xmlns:w="w" xmlns:r="r"><w:body><w:p><w:pPr>${midSect}</w:pPr><w:r><w:t>SECCION UNO</w:t></w:r></w:p>` +
        `<w:p><w:r><w:t>TEXTO VIEJO</w:t></w:r></w:p>${LETTER_SECTPR}</w:body></w:document>`,
    );
    const t = await loadTemplate(await zip.generateAsync({ type: "uint8array" }));
    expect(t.sectPr).toBe(LETTER_SECTPR);
    const out = await JSZip.loadAsync(await buildDocx([img(false)], { maxHeightMm: 200 }, t));
    const doc = (await out.file("word/document.xml")?.async("string")) ?? "";
    expect(doc).not.toContain("SECCION UNO");
    expect(doc).not.toContain("TEXTO VIEJO");
  });

  it("rechaza archivos que no son Word", async () => {
    await expect(loadTemplate(new Uint8Array([1, 2, 3]))).rejects.toThrow(/Word/);
  });
});
