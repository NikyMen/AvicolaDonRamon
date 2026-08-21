"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Package,
  PackageCheck,
  Phone,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface Stop {
  id: string | null;
  code: string;
  routeSeq: number | null;
  customer: string;
  phone: string | null;
  address: string | null;
  status: "en_camino" | "entregado" | string;
  isNext: boolean;
  deliveredAt: string | null;
  mapUrl: string | null;
}

interface RutaResponse {
  stops: Stop[];
  pendientes: number;
  entregados: number;
  total: number;
  routeMapUrl: string | null;
  /** Nombre del repartidor logueado (null si mira un admin). */
  repartidor: string | null;
}

/** Una parada de un lote ya cerrado, tal como la devuelve el historial. */
interface HistorialStop {
  code: string;
  routeSeq: number | null;
  customer: string;
  phone: string | null;
  address: string | null;
  status: string;
  deliveredAt: string | null;
}

/** Reparto ya cerrado del repartidor logueado. */
interface HistorialLote {
  batchId: string;
  dispatchedAt: string | null;
  closedAt: string | null;
  origen: string | null;
  total: number;
  entregados: number;
  stops: HistorialStop[];
}

function horaCorta(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function loteLabel(batchId: string): string {
  return batchId.startsWith("legacy:") ? "Lote anterior" : `Lote ${batchId.slice(0, 8).toUpperCase()}`;
}

const LOGIN_URL = "/admin/login?next=%2Freparto";

export default function RepartoPage() {
  const [data, setData] = useState<RutaResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinSesion, setSinSesion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [cancelacion, setCancelacion] = useState<{ id: string; segundos: number } | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Historial de lotes cerrados: se pide recién cuando el repartidor lo abre.
  const [verHistorial, setVerHistorial] = useState(false);
  const [historial, setHistorial] = useState<HistorialLote[] | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const [loteAbierto, setLoteAbierto] = useState<string | null>(null);

  const cargarRuta = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/reparto/ruta", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        setSinSesion(true);
        setData(null);
        return;
      }
      if (!res.ok) throw new Error(json?.error || "No se pudo cargar la ruta.");
      setSinSesion(false);
      setData(json as RutaResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la ruta.");
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true);
    setErrorHistorial(null);
    try {
      const res = await fetch("/api/reparto/historial", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo cargar el historial.");
      setHistorial((json?.lotes ?? []) as HistorialLote[]);
    } catch (e) {
      setErrorHistorial(e instanceof Error ? e.message : "No se pudo cargar el historial.");
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  const toggleHistorial = () => {
    const abrir = !verHistorial;
    setVerHistorial(abrir);
    if (abrir && historial === null && !cargandoHistorial) cargarHistorial();
  };

  useEffect(() => {
    cargarRuta();
    // Refresco automático para reflejar cambios (p. ej. el local cierra otro lote).
    const t = setInterval(cargarRuta, 20000);
    return () => clearInterval(t);
  }, [cargarRuta]);

  const salir = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* sin conexión: igual mandamos al login */
    }
    window.location.href = LOGIN_URL;
  };

  const confirmar = async () => {
    const c = code.trim();
    if (!c || confirmando) return;
    setConfirmando(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/reparto/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setFeedback({ ok: true, msg: `✅ Entregado a ${json.customer} (${json.pedido}).` });
        setCode("");
        await cargarRuta();
      } else {
        setFeedback({ ok: false, msg: json?.error || "No se pudo confirmar." });
      }
    } catch {
      setFeedback({ ok: false, msg: "Error de conexión. Probá de nuevo." });
    } finally {
      setConfirmando(false);
      inputRef.current?.focus();
    }
  };

  const cancelarPedido = useCallback(
    async (id: string) => {
      setCancelacion(null);
      setCancelandoId(id);
      setFeedback(null);
      try {
        const res = await fetch("/api/reparto/cancelar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          setFeedback({
            ok: true,
            msg: `Pedido ${json.pedido} devuelto a Entregas para reasignarlo.`,
          });
          await cargarRuta();
        } else {
          setFeedback({ ok: false, msg: json?.error || "No se pudo cancelar el pedido." });
        }
      } catch {
        setFeedback({ ok: false, msg: "Error de conexión. Probá de nuevo." });
      } finally {
        setCancelandoId(null);
      }
    },
    [cargarRuta]
  );

  useEffect(() => {
    if (!cancelacion) return;
    if (cancelacion.segundos <= 0) {
      void cancelarPedido(cancelacion.id);
      return;
    }
    const timer = window.setTimeout(
      () => setCancelacion((actual) => (actual ? { ...actual, segundos: actual.segundos - 1 } : null)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [cancelacion, cancelarPedido]);

  // Sin sesión: invitación a entrar con el usuario del equipo.
  if (!cargando && sinSesion) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 bg-brand-cream px-6 text-center">
        <Navigation size={40} className="text-brand-red" />
        <h1 className="text-xl font-extrabold text-brand-ink">Reparto</h1>
        <p className="text-sm text-brand-ink/60">
          Iniciá sesión con tu usuario y contraseña para ver las entregas que tenés asignadas.
        </p>
        <a
          href={LOGIN_URL}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-soft"
        >
          <LogIn size={16} /> Iniciar sesión
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-brand-cream px-4 py-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Navigation size={22} className="flex-none text-brand-red" />
            <h1 className="truncate text-lg font-extrabold text-brand-ink">
              {data?.repartidor ? `Reparto de ${data.repartidor}` : "Reparto"}
            </h1>
          </div>
          {data?.repartidor && (
            <p className="text-xs text-brand-ink/55">Estas son tus entregas asignadas.</p>
          )}
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <button
            onClick={() => {
              setCargando(true);
              cargarRuta();
              if (historial !== null) cargarHistorial();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            onClick={salir}
            className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-ink/70"
            aria-label="Cerrar sesión"
          >
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>

      {/* Confirmar entrega por código */}
      <div className="mb-4 rounded-2xl bg-white p-4 shadow-soft">
        <label className="mb-1 block text-sm font-semibold text-brand-ink">
          Código del cliente
        </label>
        <p className="mb-2 text-xs text-brand-ink/55">
          Pedile al cliente el código de 4 dígitos e ingresalo para confirmar la entrega.
        </p>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && confirmar()}
            inputMode="numeric"
            placeholder="0000"
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-3 text-center text-2xl font-bold tracking-[0.3em] text-brand-ink"
          />
          <button
            onClick={confirmar}
            disabled={confirmando || code.trim().length < 4}
            className={`flex-none rounded-lg px-4 text-sm font-bold text-white transition ${
              confirmando || code.trim().length < 4
                ? "cursor-not-allowed bg-black/20"
                : "bg-brand-red hover:brightness-95"
            }`}
          >
            {confirmando ? <Loader2 size={18} className="animate-spin" /> : "Confirmar"}
          </button>
        </div>
        {feedback && (
          <p
            className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
              feedback.ok ? "bg-emerald-50 text-emerald-700" : "bg-brand-red/10 text-brand-red"
            }`}
          >
            {feedback.msg}
          </p>
        )}
      </div>

      {data?.routeMapUrl && (
        <a
          href={data.routeMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-ink px-4 py-3 text-sm font-bold text-white shadow-soft"
        >
          <Navigation size={16} /> Abrir ruta en Google Maps
        </a>
      )}

      {/* Lista de paradas */}
      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-brand-ink/60">
          <Loader2 size={18} className="animate-spin" /> Cargando ruta…
        </div>
      ) : error ? (
        <p className="rounded-xl bg-brand-red/10 px-3 py-3 text-center text-sm font-semibold text-brand-red">
          {error}
        </p>
      ) : !data || data.stops.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-brand-ink/55">
          <Package size={36} className="opacity-40" />
          <p className="text-sm font-medium">No tenés entregas asignadas ahora.</p>
          <p className="text-xs">Cuando el local te cierre un reparto vas a ver la ruta acá.</p>
        </div>
      ) : (
        <>
          {/* Progreso del reparto */}
          <div className="mb-3 rounded-2xl bg-white p-4 shadow-soft">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-bold text-brand-ink">
                {data.entregados} de {data.total} entregados
              </span>
              <span className="text-brand-ink/55">{data.pendientes} sin entregar</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-cream">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${data.total > 0 ? Math.round((data.entregados / data.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
          <ol className="space-y-2">
            {data.stops.map((s) => {
              const entregado = s.status === "entregado";
              return (
                <li
                  key={s.id ?? s.code}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 shadow-soft ${
                    entregado
                      ? "border-emerald-100 bg-emerald-50/60"
                      : s.isNext
                        ? "border-brand-red bg-white ring-1 ring-brand-red/30"
                        : "border-black/5 bg-white"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-bold ${
                      entregado ? "bg-emerald-500 text-white" : "bg-brand-cream text-brand-ink"
                    }`}
                  >
                    {entregado ? <CheckCircle2 size={16} /> : (s.routeSeq ?? "–")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-brand-ink">
                      {s.customer}
                      {s.isNext && (
                        <span className="chip bg-brand-red/10 text-brand-red">Próximo</span>
                      )}
                      {entregado && horaCorta(s.deliveredAt) && (
                        <span className="chip bg-emerald-100 text-emerald-700">
                          Entregado {horaCorta(s.deliveredAt)}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm text-brand-ink/60">{s.address}</p>
                    {s.phone && (
                      <a
                        href={`tel:${s.phone}`}
                        className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-brand-red"
                      >
                        <Phone size={13} /> {s.phone}
                      </a>
                    )}
                    {!entregado && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={cancelandoId === (s.id ?? s.code)}
                          onClick={() =>
                            setCancelacion({ id: s.id ?? s.code, segundos: 5 })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-red/30 px-2 py-1 text-xs font-bold text-brand-red disabled:opacity-50"
                        >
                          <XCircle size={13} />
                          {cancelandoId === (s.id ?? s.code)
                            ? "Cancelando…"
                            : cancelacion?.id === (s.id ?? s.code)
                              ? `Cancelando en ${cancelacion.segundos}s`
                              : "Cancelar pedido"}
                        </button>
                        {cancelacion?.id === (s.id ?? s.code) && !cancelandoId && (
                          <button
                            type="button"
                            onClick={() => setCancelacion(null)}
                            className="text-xs font-semibold text-brand-ink/60 underline"
                          >
                            Deshacer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {s.mapUrl && !entregado && (
                    <a
                      href={s.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-none rounded-lg border border-black/10 p-2 text-brand-red"
                      aria-label="Abrir en el mapa"
                    >
                      <MapPin size={16} />
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {/* Historial de repartos ya cerrados, agrupado por lote */}
      <section className="mt-5">
        <button
          onClick={toggleHistorial}
          aria-expanded={verHistorial}
          className="flex w-full items-center gap-2 rounded-2xl bg-white px-4 py-3 text-left shadow-soft"
        >
          <History size={18} className="flex-none text-brand-gold" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-brand-ink">Mi historial de repartos</span>
            <span className="block text-xs text-brand-ink/55">
              Lotes cerrados con lo que entregaste en cada uno.
            </span>
          </span>
          {verHistorial ? (
            <ChevronUp size={18} className="flex-none text-brand-ink/40" />
          ) : (
            <ChevronDown size={18} className="flex-none text-brand-ink/40" />
          )}
        </button>

        {verHistorial && (
          <div className="mt-2 space-y-2">
            {cargandoHistorial ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-brand-ink/60">
                <Loader2 size={16} className="animate-spin" /> Cargando historial…
              </div>
            ) : errorHistorial ? (
              <p className="rounded-xl bg-brand-red/10 px-3 py-3 text-center text-sm font-semibold text-brand-red">
                {errorHistorial}
              </p>
            ) : !historial || historial.length === 0 ? (
              <p className="rounded-xl bg-white px-3 py-4 text-center text-sm text-brand-ink/55 shadow-soft">
                Todavía no tenés lotes cerrados.
              </p>
            ) : (
              historial.map((lote) => {
                const abierto = loteAbierto === lote.batchId;
                return (
                  <div key={lote.batchId} className="overflow-hidden rounded-2xl bg-white shadow-soft">
                    <button
                      onClick={() => setLoteAbierto(abierto ? null : lote.batchId)}
                      aria-expanded={abierto}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left"
                    >
                      <PackageCheck size={16} className="flex-none text-emerald-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-brand-ink">
                          {loteLabel(lote.batchId)}
                        </span>
                        <span className="block text-xs text-brand-ink/55">
                          {fechaCorta(lote.closedAt ?? lote.dispatchedAt)}
                          {lote.origen ? ` · sale de ${lote.origen}` : ""}
                        </span>
                      </span>
                      <span className="chip flex-none bg-emerald-100 text-emerald-700">
                        {lote.entregados}/{lote.total}
                      </span>
                      {abierto ? (
                        <ChevronUp size={16} className="flex-none text-brand-ink/40" />
                      ) : (
                        <ChevronDown size={16} className="flex-none text-brand-ink/40" />
                      )}
                    </button>

                    {abierto && (
                      <ul className="border-t border-black/5 bg-brand-cream/20 px-3 py-2">
                        {lote.stops.map((s) => (
                          <li
                            key={s.code}
                            className="flex items-start gap-2.5 border-b border-black/5 py-2 last:border-b-0"
                          >
                            <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-cream text-[11px] font-bold text-brand-ink">
                              {s.routeSeq ?? "–"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-brand-ink">
                                {s.customer}
                                <span className="font-mono text-xs font-normal text-brand-ink/50">
                                  {s.code}
                                </span>
                              </p>
                              {s.address && (
                                <p className="truncate text-xs text-brand-ink/55">{s.address}</p>
                              )}
                              {s.phone && (
                                <a
                                  href={`tel:${s.phone}`}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red"
                                >
                                  <Phone size={11} /> {s.phone}
                                </a>
                              )}
                            </div>
                            <span
                              className={`chip flex-none ${
                                s.status === "entregado"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-brand-cream text-brand-ink/60"
                              }`}
                            >
                              {s.status === "entregado"
                                ? (horaCorta(s.deliveredAt) ?? "Entregado")
                                : "Sin entregar"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
}
