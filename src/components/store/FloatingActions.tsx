"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { WHATSAPP_SOPORTE_TEXTO, WHATSAPP_SOPORTE_URL } from "@/lib/whatsapp";

const SALUDO =
  "¡Hola! Soy el asistente de Avícola Don Ramón 🍗 Preguntame por productos, precios, ubicación o envíos.";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/**
 * Botones flotantes de la tienda: WhatsApp de soporte (abajo) y asistente de IA
 * (arriba). El WhatsApp es SOLO para consultas o problemas: las compras se
 * cierran en el carrito con Mercado Pago.
 * En mobile se levantan por encima de la BottomNav para no taparla.
 */
export function FloatingActions() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3 md:bottom-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar el asistente" : "Abrir el asistente"}
          aria-expanded={open}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-ink text-white shadow-card transition hover:scale-105 hover:bg-brand-red active:scale-95"
        >
          {open ? <X size={24} /> : <Sparkles size={24} />}
        </button>

        <a
          href={WHATSAPP_SOPORTE_URL}
          target="_blank"
          rel="noopener noreferrer"
          title={WHATSAPP_SOPORTE_TEXTO}
          aria-label={WHATSAPP_SOPORTE_TEXTO}
          className="flex items-center gap-1.5 rounded-full bg-[#25D366] py-2.5 pl-3 pr-4 text-white shadow-card transition hover:scale-105 active:scale-95"
        >
          <WhatsAppIcon />
          <span className="max-w-[7.5rem] text-left leading-none">
            <span className="block text-[9px] font-semibold text-white/80">
              ¿Tenés un problema?
            </span>
            <span className="mt-1 block text-[11px] font-bold">Escribinos</span>
          </span>
        </a>
      </div>

      {open && <ChatPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.87 9.87 0 0 0 4.74 1.21c5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: SALUDO }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cerrar con Escape, como el carrito y el menú lateral.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El saludo inicial es del cliente, no del modelo: no se manda.
        body: JSON.stringify({ messages: next.slice(1).slice(-12) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pudimos responderte.");
      setMsgs([...next, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos responderte.");
    } finally {
      setLoading(false);
    }
  }

  // El panel arranca justo arriba de la pila de botones (WhatsApp + IA), así no
  // tapa el botón que lo abre: la pila mide 56 + 12 + 48 px por encima de su
  // propio offset (bottom-24 en mobile, bottom-6 en escritorio).
  // El max-h evita que se salga por arriba en pantallas bajas (teléfono
  // horizontal, ventana chica): ahí el panel se achica en vez de desbordar.
  return (
    <div
      role="dialog"
      aria-label="Asistente de Avícola Don Ramón"
      className="fixed bottom-56 right-4 z-40 flex h-[26rem] max-h-[calc(100dvh-15rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-xl2 bg-white shadow-card ring-1 ring-black/5 md:bottom-40 md:max-h-[calc(100dvh-11rem)]"
    >
      <header className="flex items-center gap-2 border-b border-black/5 bg-brand-cream px-4 py-3">
        <Sparkles size={18} className="text-brand-red" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-brand-ink">Asistente Don Ramón</p>
          <p className="text-[11px] text-brand-ink/55">Respuestas generadas por IA</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-full p-1 text-brand-ink/50 transition hover:bg-black/5 hover:text-brand-ink"
        >
          <X size={18} />
        </button>
      </header>

      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm",
              m.role === "user"
                ? "ml-auto bg-brand-red text-white"
                : "bg-brand-cream text-brand-ink"
            )}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 rounded-xl bg-brand-cream px-3 py-2 text-sm text-brand-ink/60">
            <Loader2 size={14} className="animate-spin" />
            Escribiendo…
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-black/5 p-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Escribí tu consulta…"
          className="flex-1 rounded-full bg-brand-cream px-4 py-2 text-sm text-brand-ink outline-none ring-brand-red/30 placeholder:text-brand-ink/40 focus:ring-2"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red text-white transition hover:opacity-90 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
