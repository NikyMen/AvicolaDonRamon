"use client";

import { useEffect, useRef, useState } from "react";
import { PauseCircle, PlayCircle } from "lucide-react";
import { pauseAllProducts, resumeAllProducts } from "./actions";

/** Cuánto hay que sostener el botón antes de que se apague la tienda. */
const ESPERA_MS = 5000;

/**
 * Pausa todo el catálogo de una vez, para cuando hay que cerrar la venta de
 * golpe: se cortó la cadena de frío, se acabó la mercadería, el local cierra
 * unos días.
 *
 * Se activa manteniéndolo apretado cinco segundos, no con un click. Apagar la
 * tienda entera es demasiado grave para que dependa de un dedo apurado, y una
 * ventana de confirmación se acepta sin leerla. Soltar antes de tiempo cancela.
 */
export function PausarCatalogo({ pausados }: { pausados: number }) {
  const [progreso, setProgreso] = useState(0);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const inicio = useRef<number | null>(null);
  const cuadro = useRef<number | null>(null);

  // Si el componente se va mientras el botón está apretado, el bucle de
  // animación tiene que morir con él.
  useEffect(() => cancelarCuenta, []);

  function cancelarCuenta() {
    if (cuadro.current !== null) cancelAnimationFrame(cuadro.current);
    cuadro.current = null;
    inicio.current = null;
    setProgreso(0);
  }

  function correrCuenta() {
    const desde = inicio.current;
    if (desde === null) return;
    const transcurrido = Date.now() - desde;
    if (transcurrido >= ESPERA_MS) {
      cancelarCuenta();
      void ejecutarPausa();
      return;
    }
    setProgreso(transcurrido / ESPERA_MS);
    cuadro.current = requestAnimationFrame(correrCuenta);
  }

  function empezar() {
    if (trabajando || inicio.current !== null) return;
    setAviso(null);
    inicio.current = Date.now();
    cuadro.current = requestAnimationFrame(correrCuenta);
  }

  async function ejecutarPausa() {
    setTrabajando(true);
    const resultado = await pauseAllProducts();
    setTrabajando(false);
    if (resultado.error) {
      setAviso(resultado.error);
      return;
    }
    window.location.reload();
  }

  async function reanudar() {
    if (!window.confirm(`¿Volver a poner a la venta ${pausados} productos?`)) return;
    setTrabajando(true);
    const resultado = await resumeAllProducts();
    setTrabajando(false);
    if (resultado.error) {
      setAviso(resultado.error);
      return;
    }
    window.location.reload();
  }

  const restantes = Math.max(1, Math.ceil((1 - progreso) * (ESPERA_MS / 1000)));
  const sosteniendo = progreso > 0;

  if (pausados > 0) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={reanudar}
          disabled={trabajando}
          className="btn-primary disabled:opacity-40"
        >
          <PlayCircle size={16} />
          {trabajando ? "Reactivando…" : `Reactivar ${pausados} productos pausados`}
        </button>
        <span className="text-xs text-brand-ink/55">
          El catálogo está pausado y no se ve en la tienda.
        </span>
        {aviso && <span className="text-xs font-semibold text-brand-red">{aviso}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onPointerDown={empezar}
        onPointerUp={cancelarCuenta}
        onPointerLeave={cancelarCuenta}
        onPointerCancel={cancelarCuenta}
        disabled={trabajando}
        aria-label="Mantené apretado cinco segundos para pausar todo el catálogo"
        className="relative select-none overflow-hidden rounded-xl border border-brand-red/30 px-4 py-2 text-sm font-semibold text-brand-red transition hover:bg-brand-red/5 disabled:opacity-40"
      >
        {/* La barra crece por debajo del texto: muestra cuánto falta sin mover nada. */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-brand-red/15"
          style={{ width: `${progreso * 100}%` }}
        />
        <span className="relative flex items-center gap-2">
          <PauseCircle size={16} />
          {trabajando
            ? "Pausando…"
            : sosteniendo
              ? `Soltá para cancelar · ${restantes}`
              : "Pausar todo el catálogo"}
        </span>
      </button>
      <span className="text-xs text-brand-ink/55">
        Mantenelo apretado 5 segundos. Se puede reactivar después.
      </span>
      {aviso && <span className="text-xs font-semibold text-brand-red">{aviso}</span>}
    </div>
  );
}
