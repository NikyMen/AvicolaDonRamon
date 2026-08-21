"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, Gift, Loader2, PackageCheck, XCircle } from "lucide-react";
import { useCart } from "@/store/cart";

type Estado = "verificando" | "aprobado" | "pendiente" | "rechazado";
const CHECKOUT_ATTEMPT_KEY = "entrerios-checkout-attempt";

/** Datos del pedido que devuelve /confirm para mostrarle al cliente. */
interface DatosPedido {
  codigo: string | null;
  deliveryCode: string | null;
  franjaHoraria: string | null;
  regalo: string | null;
}

// Estado que Mercado Pago manda en la URL (render inmediato).
function clasificarMp(status: string): Estado {
  if (status === "approved") return "aprobado";
  if (status === "pending" || status === "in_process") return "pendiente";
  if (!status) return "verificando";
  return "rechazado";
}

// Estado interno del pedido (devuelto por /confirm) -> estado visual.
function mapEstadoInterno(estado: string): Estado | null {
  if (estado === "en_preparacion" || estado === "en_camino" || estado === "entregado")
    return "aprobado";
  if (estado === "cancelado" || estado === "no_pagado") return "rechazado";
  if (estado === "pendiente") return "pendiente";
  return null;
}

function ResultadoContenido() {
  const params = useSearchParams();
  const clear = useCart((s) => s.clear);

  // MP agrega status/payment_id/external_reference al volver del checkout.
  const urlStatus = params.get("status") || params.get("collection_status") || "";
  const paymentId = params.get("payment_id") || params.get("collection_id") || "";
  const orderId = params.get("external_reference") || params.get("orderId") || "";
  // Modo demo: el pago ya quedó aprobado en el servidor.
  const demo = params.get("demo") === "1";

  const [estado, setEstado] = useState<Estado>(() =>
    demo ? "aprobado" : clasificarMp(urlStatus) === "pendiente" ? "pendiente" : "verificando"
  );
  const [pedido, setPedido] = useState<DatosPedido | null>(null);

  useEffect(() => {
    if (demo) {
      clear();
      sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
      return;
    }

    if (!orderId) {
      setEstado((prev) => (prev === "verificando" ? "pendiente" : prev));
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // MP puede acreditar unos segundos después de volver al sitio. Reintentamos
    // la verificación y vaciamos el carrito únicamente con pago real confirmado.
    const verificar = async (intento = 0) => {
      try {
        const response = await fetch("/api/checkout/mercadopago/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ orderId, paymentId }),
        });
        if (!response.ok) throw new Error("No se pudo verificar el pago.");
        const d = await response.json();
        if (cancelled) return;
        setPedido({
          codigo: d?.codigo ?? null,
          deliveryCode: d?.deliveryCode ?? null,
          franjaHoraria: d?.franjaHoraria ?? null,
          regalo: d?.regalo ?? null,
        });
        const e = d?.estado ? mapEstadoInterno(d.estado) : null;
        if (e) {
          setEstado(e);
          if (e === "aprobado") {
            clear();
            sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
            return;
          }
          if (e === "rechazado") {
            sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
            return;
          }
        } else {
          setEstado((prev) => (prev === "verificando" ? "pendiente" : prev));
        }
      } catch {
        if (cancelled) return;
        setEstado((prev) => (prev === "verificando" ? "pendiente" : prev));
      }
      if (intento < 9) timer = setTimeout(() => void verificar(intento + 1), 2000);
    };

    void verificar();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [clear, demo, orderId, paymentId]);

  const ui = {
    verificando: {
      color: "text-brand-ink/60",
      bg: "bg-black/5",
      titulo: "Verificando el pago…",
      texto:
        "Estamos confirmando el estado de tu pago. Aguardá un instante, no cierres la ventana.",
      icon: <Loader2 size={40} className="animate-spin" />,
    },
    aprobado: {
      color: "text-green-600",
      bg: "bg-green-50",
      titulo: "Gracias por tu compra, la estamos procesando.",
      texto: "Recibimos tu pago y ya estamos preparando tu pedido.",
      icon: <CheckCircle2 size={40} />,
    },
    pendiente: {
      color: "text-brand-gold",
      bg: "bg-brand-gold/10",
      titulo: "Pago pendiente",
      texto:
        "Tu pago está siendo procesado. En cuanto se acredite empezamos a preparar tu pedido. Podés cerrar esta ventana.",
      icon: <Clock3 size={40} />,
    },
    rechazado: {
      color: "text-brand-red",
      bg: "bg-brand-red/10",
      titulo: "No se pudo completar el pago",
      texto: "El pago fue rechazado o cancelado. Podés volver al carrito e intentar de nuevo.",
      icon: <XCircle size={40} />,
    },
  }[estado];

  // El código que el cliente le pasa al repartidor. Si por algún motivo no
  // llegó, mostramos el número de pedido como respaldo.
  const codigoParaRepartidor = pedido?.deliveryCode ?? pedido?.codigo ?? null;

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-5 py-12 text-center">
      <div className={`flex h-20 w-20 items-center justify-center rounded-full ${ui.bg} ${ui.color}`}>
        {ui.icon}
      </div>

      <h1 className={`mt-6 text-2xl font-extrabold ${ui.color}`}>{ui.titulo}</h1>
      <p className="mt-3 max-w-md text-sm text-brand-ink/70">{ui.texto}</p>

      {estado === "aprobado" && (
        <div className="mt-6 w-full space-y-4">
          {/* Confirmación de stock + código para el repartidor */}
          <div className="rounded-2xl bg-green-50 p-5 ring-1 ring-green-600/20">
            <p className="flex items-center justify-center gap-2 text-base font-extrabold text-green-700 md:text-lg">
              <PackageCheck size={22} className="shrink-0" />
              Ya tenemos todo listo para tu entrega.
            </p>

            {codigoParaRepartidor && (
              <>
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-brand-ink/50">
                  Código de tu pedido
                </p>
                <p className="mt-1 break-all text-4xl font-extrabold tracking-[0.2em] text-brand-ink">
                  {codigoParaRepartidor}
                </p>
                <p className="mt-3 rounded-xl bg-brand-gold/25 px-4 py-3 text-sm font-bold text-brand-ink">
                  Informale este código al repartidor al recibir tu pedido.
                </p>
              </>
            )}

            {pedido?.codigo && pedido.codigo !== codigoParaRepartidor && (
              <p className="mt-3 text-xs text-brand-ink/50">
                N° de pedido: <span className="font-semibold">{pedido.codigo}</span>
              </p>
            )}

            {pedido?.franjaHoraria && (
              <p className="mt-1 text-xs text-brand-ink/60">
                Horario de entrega: <span className="font-semibold">{pedido.franjaHoraria}</span>
              </p>
            )}
          </div>

          {pedido?.regalo && (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-brand-red/10 px-4 py-3 text-sm font-bold text-brand-red">
              <Gift size={18} className="shrink-0" /> ¡Sumamos tu regalo de bienvenida:{" "}
              {pedido.regalo}!
            </p>
          )}
        </div>
      )}

      {paymentId && (
        <p className="mt-4 text-xs text-brand-ink/40">N° de operación: {paymentId}</p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/productos" className="btn-primary px-6 py-3">
          Seguir comprando
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-black/10 px-6 py-3 text-sm font-semibold text-brand-ink/70 hover:bg-black/5"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

export default function ResultadoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-brand-ink/60">
          Verificando el pago…
        </div>
      }
    >
      <ResultadoContenido />
    </Suspense>
  );
}
