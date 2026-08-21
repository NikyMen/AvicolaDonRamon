"use client";

import { useEffect, useRef, useState } from "react";
import { History as HistoryIcon, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: number;
  createdAt: string;
  messages: Message[];
}

const INITIAL_MESSAGE =
  "Puedo analizar ventas, precios históricos, ofertas, stock, clientes, visitas y tiempos de entrega. ¿Qué querés revisar?";

const SUGGESTIONS = [
  "¿Cómo variaron los precios y qué ofertas funcionaron mejor?",
  "¿Cuánto tarda cada etapa de preparación y entrega?",
  "Dame tres mejoras concretas para el negocio",
];

const HISTORY_STORAGE_KEY = "polleria-admin-ai-history";

function conversationTitle(messages: Message[]) {
  const firstQuestion = messages.find((message) => message.role === "user")?.content;
  return firstQuestion ? `${firstQuestion.slice(0, 58)}${firstQuestion.length > 58 ? "…" : ""}` : "Nueva charla";
}

function formatConversationDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function BusinessAIChat({ enabled }: { enabled: boolean }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: INITIAL_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Conversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) setHistory(JSON.parse(stored) as Conversation[]);
    } catch {
      // El historial es opcional y no debe impedir usar el chat.
    }
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!content || loading || !enabled) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/ai/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(1).slice(-12) }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !data.reply) throw new Error(data.error ?? "No pude responder.");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude responder.");
    } finally {
      setLoading(false);
    }
  }

  function startNewConversation() {
    if (messages.some((message) => message.role === "user")) {
      const nextHistory = [
        { id: Date.now(), createdAt: new Date().toISOString(), messages },
        ...history,
      ].slice(0, 12);
      setHistory(nextHistory);
      try {
        window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
      } catch {
        // El historial es opcional y no debe impedir iniciar una charla.
      }
    }
    setMessages([{ role: "assistant", content: INITIAL_MESSAGE }]);
    setError(null);
    setHistoryOpen(false);
  }

  return (
    <section className="relative flex h-full min-h-[42rem] flex-col overflow-hidden rounded-2xl bg-white shadow-soft">
      <header className="flex items-center justify-between gap-3 border-b border-black/5 bg-brand-ink px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Sparkles size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Analista IA del negocio</h2>
            <p className="text-[11px] text-white/60">Consulta los datos actuales en cada respuesta</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            aria-expanded={historyOpen}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/10 hover:text-white"
          >
            <HistoryIcon size={14} /> Historial
            {history.length > 0 && <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">{history.length}</span>}
          </button>
          <button
            type="button"
            onClick={startNewConversation}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/10 hover:text-white"
          >
            <RotateCcw size={14} /> Nueva charla
          </button>
        </div>
      </header>

      {historyOpen && (
        <div className="absolute inset-x-0 bottom-0 top-[4.25rem] z-10 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-brand-ink">Historial de charlas</h3>
              <p className="text-[11px] text-brand-ink/50">Guardado en este navegador</p>
            </div>
            <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Cerrar historial" className="rounded-lg p-1.5 text-brand-ink/50 hover:bg-black/5 hover:text-brand-ink">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-[#faf9f7] p-4">
            {history.length === 0 ? (
              <p className="rounded-xl bg-white p-4 text-xs text-brand-ink/55 shadow-sm ring-1 ring-black/5">
                Todavía no hay charlas guardadas. Al iniciar una nueva charla, la conversación actual aparecerá acá.
              </p>
            ) : (
              history.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => {
                    setMessages(conversation.messages);
                    setError(null);
                    setHistoryOpen(false);
                  }}
                  className="block w-full rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-black/5 transition hover:ring-brand-red/30"
                >
                  <p className="truncate text-xs font-semibold text-brand-ink">{conversationTitle(conversation.messages)}</p>
                  <p className="mt-1 text-[10px] text-brand-ink/45">{formatConversationDate(conversation.createdAt)} · {conversation.messages.length} mensajes</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-[#faf9f7] p-4" aria-live="polite">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
              message.role === "user"
                ? "ml-auto bg-brand-red text-white"
                : "bg-white text-brand-ink shadow-sm ring-1 ring-black/5"
            )}
          >
            {message.content}
          </div>
        ))}
        {messages.length === 1 && enabled && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => sendMessage(suggestion)}
                className="rounded-full border border-brand-red/15 bg-white px-3 py-2 text-left text-xs font-medium text-brand-ink/65 transition hover:border-brand-red/40 hover:text-brand-red"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div className="flex w-fit items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-brand-ink/55 shadow-sm ring-1 ring-black/5">
            <Loader2 size={15} className="animate-spin" /> Analizando datos…
          </div>
        )}
        {!enabled && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Configurá la clave de IA del servidor para habilitar el chat.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage(input);
        }}
        className="flex items-end gap-2 border-t border-black/5 bg-white p-3"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={500}
          rows={2}
          disabled={!enabled || loading}
          placeholder="Preguntá por ventas, precios, ofertas, clientes o entregas…"
          aria-label="Consulta para el analista IA"
          className="max-h-28 min-h-[2.75rem] flex-1 resize-y rounded-xl bg-brand-cream px-4 py-3 text-sm text-brand-ink outline-none ring-brand-red/30 placeholder:text-brand-ink/40 focus:ring-2 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!enabled || loading || !input.trim()}
          aria-label="Enviar consulta"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-red text-white transition hover:opacity-90 disabled:opacity-40"
        >
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}
