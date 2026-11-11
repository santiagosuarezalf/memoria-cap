import { useEffect, useRef } from "react";

export function About({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Acerca de MemoriaCap"
      className="m-auto max-w-md rounded-lg bg-white p-6 shadow-xl backdrop:bg-black/40 dark:bg-slate-800 dark:text-slate-100"
    >
      <h2 className="text-lg font-semibold">MemoriaCap</h2>
      <p className="mt-3 text-sm">
        Idea y versión original (<em>ImageCap</em>): <strong>Alejandro Jara</strong>, ingeniero
        civil, que la creó para preparar los anexos de las memorias de cálculo.
      </p>
      <p className="mt-2 text-sm">
        Esta versión la reconstruye para Windows, Linux y macOS. Los PDF se procesan en el
        computador; no se envían a ningún lado.
      </p>
      <form method="dialog">
        <button
          type="submit"
          className="mt-5 rounded bg-slate-800 px-4 py-2 text-sm text-white dark:bg-slate-200 dark:text-slate-900"
        >
          Cerrar
        </button>
      </form>
    </dialog>
  );
}
