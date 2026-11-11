// Guardar archivos: en la app de escritorio con los diálogos nativos de Tauri; en el navegador
// (solo para desarrollo) como descarga.
import { isTauri } from "@tauri-apps/api/core";

export interface OutFile {
  name: string;
  bytes: Uint8Array;
}

/**
 * Pide una carpeta y devuelve una función para escribir archivos en ella, o null si el usuario
 * canceló. En el navegador no hay carpetas: se juntan en un .zip que se descarga al final.
 */
export async function chooseFolder(zipName: string): Promise<{
  write: (f: OutFile) => Promise<void>;
  finish: () => Promise<void>;
  label: string;
} | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const dir = await open({
      directory: true,
      recursive: true, // el permiso de escritura cubre lo que queda dentro de la carpeta
      title: "Carpeta donde guardar las imágenes",
    });
    if (typeof dir !== "string") return null;
    const sep = dir.includes("\\") ? "\\" : "/";
    return {
      write: (f) => writeFile(`${dir}${sep}${f.name}`, f.bytes),
      finish: async () => {},
      label: dir,
    };
  }
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  return {
    write: async (f) => {
      zip.file(f.name, f.bytes);
    },
    finish: async () => download(zipName, await zip.generateAsync({ type: "uint8array" })),
    label: zipName,
  };
}

/** Pide dónde guardar un archivo y lo escribe. Devuelve false si el usuario canceló. */
export async function saveFile(
  suggestedName: string,
  bytes: Uint8Array,
  filter: { name: string; extensions: string[] },
): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: suggestedName, filters: [filter] });
    if (!path) return false;
    await writeFile(path, bytes);
    return true;
  }
  download(suggestedName, bytes);
  return true;
}

function download(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
