"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Printer,
  RefreshCw,
  List,
  Truck,
  XCircle,
} from "lucide-react";
import {
  cerrarReparto,
  confirmarEntrega,
  reasignarEntrega,
  type ConfirmarEntregaState,
} from "./actions";

export interface RutaStop {
  id: string;
  code: string;
  routeSeq: number | null;
  customer: string;
  phone: string | null;
  address: string | null;
  deliveryCode: string | null;
  status: string;
  mapUrl: string | null;
  deliveredAt: string | null;
  /** Nombre del repartidor a cargo de esta entrega. */
  repartidor: string | null;
}

export interface RutaEnCursoProps {
  stops: RutaStop[];
  routeMapUrl: string | null;
  originName: string;
  routeKey: string;
  batchId: string;
  repartidor: string;
  dispatchedAt: string | null;
}

function horaCorta(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

export function RutaEnCursoClient({
  stops,
  routeMapUrl,
  originName,
  routeKey,
  batchId,
  repartidor,
  dispatchedAt,
}: RutaEnCursoProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [state, setState] = useState<ConfirmarEntregaState | null>(null);
  const [pending, startTransition] = useTransition();
  const [closing, startClosing] = useTransition();
  const [reassigning, startReassigning] = useTransition();
  const [closeError, setCloseError] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [reassignFeedback, setReassignFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [mostrarTodo, setMostrarTodo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const total = stops.length;
  const entregados = stops.filter((s) => s.status === "entregado").length;
  const pct = total > 0 ? Math.round((entregados / total) * 100) : 0;
  const nextId = stops.find((s) => s.status === "en_camino")?.id ?? null;
  const pedidoActual = stops.find((s) => s.id === nextId) ?? null;
  const visibleStops = mostrarTodo || nextId === null ? stops : stops.filter((s) => s.status !== "entregado");
  const loteLabel = batchId.startsWith("legacy:")
    ? "Lote anterior"
    : `Lote ${batchId.slice(0, 8).toUpperCase()}`;

  // Refresco automático para reflejar lo que confirma el repartidor.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && !pending && !closing && !reassigning) {
        router.refresh();
      }
    }, 20000);
    return () => clearInterval(t);
  }, [closing, pending, reassigning, router]);

  const confirmar = () => {
    const c = code.trim();
    if (c.length < 4 || pending) return;
    setState(null);
    startTransition(async () => {
      try {
        const res = await confirmarEntrega(c);
        setState(res);
        if (res.ok) {
          setCode("");
          router.refresh();
        }
      } catch {
        setState({ error: "No se pudo conectar. Actualizá e intentá nuevamente." });
      }
      inputRef.current?.focus();
    });
  };

  const cerrar = () => {
    if (
      closing ||
      entregados < total ||
      !window.confirm("\u00bfCerrar este reparto? Dejar\u00e1 de aparecer en curso.")
    ) return;
    setCloseError(null);
    startClosing(async () => {
      try {
        const result = await cerrarReparto(routeKey);
        if (result.ok) router.refresh();
        else setCloseError(result.error ?? "No se pudo cerrar el reparto.");
      } catch {
        setCloseError("No se pudo conectar. Actualizá la página antes de reintentar.");
      }
    });
  };

  const reasignar = (stop: RutaStop) => {
    if (
      reassigning ||
      !window.confirm(
        `¿Cancelar la entrega de ${stop.code}? El pedido volverá a la lista como Reasignado.`
      )
    ) {
      return;
    }

    setReassigningId(stop.id);
    setReassignFeedback(null);
    startReassigning(async () => {
      try {
        const result = await reasignarEntrega(stop.id);
        if (result.ok) {
          setReassignFeedback({
            ok: true,
            message: `Pedido ${result.pedido ?? stop.code} marcado como Reasignado.`,
          });
          router.refresh();
        } else {
          setReassignFeedback({
            ok: false,
            message: result.error ?? "No se pudo reasignar el pedido.",
          });
        }
      } catch {
        setReassignFeedback({
          ok: false,
          message: "No se pudo conectar. Actualizá la página antes de reintentar.",
        });
      } finally {
        setReassigningId(null);
      }
    });
  };

  return (
    <section className="rounded-2xl border-2 border-violet-200 bg-white p-4 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Truck size={18} className="text-violet-600" />
        <div>
          <h2 className="font-semibold text-brand-ink">{repartidor}</h2>
          <p className="text-xs text-brand-ink/50">
            Reparto en curso{dispatchedAt ? ` · ${new Date(dispatchedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" })}` : ""}
          </p>
        </div>
        <span className="chip bg-violet-100 text-violet-700">Sale de {originName}</span>
        <span className="chip bg-brand-cream text-brand-ink/70">{loteLabel}</span>
        {pedidoActual && (
          <span className="chip bg-brand-red/10 text-brand-red">
            Pedido actual: {pedidoActual.code} · {pedidoActual.customer}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {entregados > 0 && nextId !== null && (
            <button
              onClick={() => setMostrarTodo((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-bold text-brand-ink hover:bg-black/5"
            >
              <List size={14} /> {mostrarTodo ? "Solo llegando" : `Ver todo (${total})`}
            </button>
          )}
          <button onClick={() => router.refresh()} className="rounded-lg border border-black/10 p-2 text-brand-ink/60 hover:bg-black/5" aria-label="Actualizar">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={cerrar}
            disabled={closing || entregados < total}
            title={entregados < total ? "Completá todas las entregas para cerrar" : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {closing ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            Cerrar reparto
          </button>
        </div>
      </div>
      {closeError && <p className="mb-3 rounded-lg bg-brand-red/10 px-3 py-2 text-sm font-semibold text-brand-red">{closeError}</p>}
      {reassignFeedback && (
        <p
          className={`mb-3 rounded-lg px-3 py-2 text-sm font-semibold ${
            reassignFeedback.ok
              ? "bg-amber-50 text-amber-700"
              : "bg-brand-red/10 text-brand-red"
          }`}
        >
          {reassignFeedback.message}
        </p>
      )}

      {/* Progreso */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-semibold text-brand-ink">
            {entregados} de {total} entregados
          </span>
          <span className="text-brand-ink/55">{total - entregados} en camino</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-cream">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Cargar código de entrega */}
      <div className="mb-4 rounded-xl bg-brand-cream/60 p-3">
        <label className="mb-1 block text-xs font-semibold text-brand-ink/70">
          Confirmar entrega por código
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && confirmar()}
            inputMode="numeric"
            placeholder="0000"
            className="w-32 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-center text-xl font-bold tracking-[0.25em] text-brand-ink"
          />
          <button
            onClick={confirmar}
            disabled={pending || code.trim().length < 4}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white transition ${
              pending || code.trim().length < 4
                ? "cursor-not-allowed bg-black/20"
                : "bg-emerald-600 hover:brightness-95"
            }`}
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {pending ? "Confirmando…" : "Marcar entregado"}
          </button>
        </div>
        {state && (
          <p
            className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
              state.ok
                ? "bg-emerald-50 text-emerald-700"
                : "bg-brand-red/10 text-brand-red"
            }`}
          >
            {state.ok ? `✅ Entregado a ${state.customer} (${state.pedido}).` : state.error}
          </p>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {routeMapUrl && (
          <a
            href={routeMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-bold text-white"
          >
            <Navigation size={15} /> Abrir ruta completa en Google Maps
          </a>
        )}
        <a
          href={`/admin/etiquetas?ids=${encodeURIComponent(stops.map((s) => s.id).join(","))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-none items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-brand-ink hover:bg-black/5"
        >
          <Printer size={15} /> Etiquetas
        </a>
      </div>

      {/* Paradas */}
      <ol className="space-y-2">
        {visibleStops.map((s) => {
          const entregado = s.status === "entregado";
          const esProximo = s.id === nextId;
          const hora = horaCorta(s.deliveredAt);
          return (
            <li
              key={s.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                entregado
                  ? "border-emerald-100 bg-emerald-50/60"
                  : esProximo
                    ? "border-violet-300 bg-violet-50/60 ring-1 ring-violet-200"
                    : "border-black/5 bg-white"
              }`}
            >
              <span
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-bold ${
                  entregado
                    ? "bg-emerald-500 text-white"
                    : esProximo
                      ? "bg-violet-600 text-white"
                      : "bg-brand-cream text-brand-ink"
                }`}
              >
                {entregado ? <CheckCircle2 size={16} /> : (s.routeSeq ?? "–")}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-brand-ink">
                  {s.customer}
                  {esProximo && (
                    <span className="chip bg-violet-100 text-violet-700">Próximo</span>
                  )}
                  {entregado && hora && (
                    <span className="chip bg-emerald-100 text-emerald-700">Entregado {hora}</span>
                  )}
                </p>
                {s.address && (
                  <p className="truncate text-sm text-brand-ink/60">{s.address}</p>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-ink/55">
                  <span className="font-mono font-semibold text-brand-ink/70">{s.code}</span>
                  {s.deliveryCode && !entregado && (
                    <span className="font-mono">
                      Código:{" "}
                      <b className="tracking-widest text-brand-ink">{s.deliveryCode}</b>
                    </span>
                  )}
                  {s.phone && (
                    <a
                      href={`tel:${s.phone}`}
                      className="inline-flex items-center gap-1 hover:text-brand-ink"
                    >
                      <Phone size={12} /> {s.phone}
                    </a>
                  )}
                </div>
              </div>

              {!entregado && (
                <span className="flex flex-none items-center gap-1">
                  {s.mapUrl && (
                    <a
                      href={s.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-black/10 p-2 text-brand-red"
                      aria-label="Abrir en el mapa"
                    >
                      <MapPin size={16} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => reasignar(s)}
                    disabled={reassigning}
                    title="Cancelar esta entrega y devolverla para reasignación"
                    aria-label={`Reasignar pedido ${s.code}`}
                    className="rounded-lg border border-amber-300 p-2 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    {reassigningId === s.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <XCircle size={16} />
                    )}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
