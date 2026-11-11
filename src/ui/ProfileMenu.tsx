import { useRef, useState } from "react";
import {
  parseProfile,
  parseVic,
  type Settings,
  serializeProfile,
  type VicSettings,
} from "../core/profile";
import { saveFile } from "../platform/save";

/** Guardar la configuración como perfil .json, o abrir un perfil o un .vic de ImageCap. */
export function ProfileMenu({
  settings,
  disabled,
  onApply,
  onVic,
  onError,
  onSaved,
}: {
  settings: Settings;
  disabled: boolean;
  onApply: (s: Settings) => void;
  onVic: (v: VicSettings) => void;
  onError: (message: string) => void;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function save() {
    setOpen(false);
    const bytes = new TextEncoder().encode(serializeProfile(settings));
    if (
      await saveFile("perfil.json", bytes, { name: "Perfil de MemoriaCap", extensions: ["json"] })
    )
      onSaved();
  }

  async function load(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".vic")) onVic(parseVic(text));
      else onApply(parseProfile(text, settings));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600"
        onClick={() => setOpen((o) => !o)}
      >
        Perfil ▾
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 flex w-60 flex-col rounded border border-slate-300 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <button
            type="button"
            className="px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={save}
          >
            Guardar configuración…
          </button>
          <button
            type="button"
            className="px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => {
              setOpen(false);
              input.current?.click();
            }}
          >
            Abrir perfil o .vic de ImageCap…
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept=".json,.vic"
        className="hidden"
        onChange={(e) => {
          load(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
