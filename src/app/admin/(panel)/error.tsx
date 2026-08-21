"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] error de interfaz:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 text-center shadow-soft">
      <h1 className="text-xl font-bold text-brand-ink">No pudimos cargar esta sección</h1>
      <p className="mt-2 text-sm text-brand-ink/60">
        Tus cambios guardados no se perdieron. Reintentá o recargá la versión más reciente.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="btn-primary px-5 py-2.5">
          Reintentar
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-black/10 px-5 py-2.5 text-sm font-semibold text-brand-ink"
        >
          Recargar página
        </button>
      </div>
    </div>
  );
}
