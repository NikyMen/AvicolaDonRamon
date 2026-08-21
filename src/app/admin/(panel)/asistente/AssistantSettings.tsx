"use client";

import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Loader2, Phone, Power } from "lucide-react";

const AI_ENABLED_KEY = "assistant:enabled";
const BLOCKED_PHONES_KEY = "assistant:blocked-phones";

export function AssistantSettings() {
  const [phone, setPhone] = useState("");
  const [blockedPhones, setBlockedPhones] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setEnabled(localStorage.getItem(AI_ENABLED_KEY) !== "false");
    try { const value = JSON.parse(localStorage.getItem(BLOCKED_PHONES_KEY) ?? "[]"); if (Array.isArray(value)) setBlockedPhones(value); } catch {}
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  function blockPhone(event: React.FormEvent) {
    event.preventDefault();
    const value = phone.trim();
    if (!value || blockedPhones.includes(value)) return;
    const next = [...blockedPhones, value];
    setBlockedPhones(next); setPhone(""); localStorage.setItem(BLOCKED_PHONES_KEY, JSON.stringify(next));
  }

  function startShutdown() { setConfirming(true); setCountdown(5); }
  function confirmShutdown() { if (countdown > 0) return; setEnabled(false); setConfirming(false); localStorage.setItem(AI_ENABLED_KEY, "false"); }
  function turnOn() { setEnabled(true); localStorage.setItem(AI_ENABLED_KEY, "true"); }

  return <div className="space-y-4">
    <section className="rounded-2xl bg-white p-5 shadow-soft"><div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red"><Phone size={18} /></span><div><h2 className="font-semibold text-brand-ink">Apagar por número de teléfono</h2><p className="text-sm text-brand-ink/55">Esos números no verán el asistente de IA en la tienda.</p></div></div><form onSubmit={blockPhone} className="flex max-w-xl gap-2"><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Ej. +54 9 379 400 0000" className="min-w-0 flex-1 rounded-xl bg-brand-cream px-4 py-3 text-sm outline-none ring-brand-red/30 focus:ring-2" /><button type="submit" disabled={!phone.trim()} className="rounded-xl bg-brand-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Agregar</button></form>{blockedPhones.length > 0 && <ul className="mt-4 space-y-2">{blockedPhones.map((value) => <li key={value} className="flex items-center gap-2 rounded-lg bg-brand-cream px-3 py-2 text-sm text-brand-ink"><Ban size={14} className="text-brand-red" />{value}<button type="button" onClick={() => { const next = blockedPhones.filter((item) => item !== value); setBlockedPhones(next); localStorage.setItem(BLOCKED_PHONES_KEY, JSON.stringify(next)); }} className="ml-auto text-xs text-brand-ink/50 hover:text-brand-red">Quitar</button></li>)}</ul>}</section>
    <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-soft"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700"><Power size={18} /></span><div><h2 className="font-semibold text-brand-ink">Apagado total</h2><p className="text-sm text-brand-ink/55">Desactiva el asistente de IA para todos los visitantes.</p><p className={`mt-2 text-sm font-semibold ${enabled ? "text-emerald-700" : "text-red-700"}`}>{enabled ? "Asistente activo" : "Asistente apagado"}</p></div></div>{enabled ? (!confirming ? <button type="button" onClick={startShutdown} className="mt-5 rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800">Apagar asistente de IA</button> : <div className="mt-5 rounded-xl bg-red-50 p-4"><p className="text-sm font-semibold text-red-900">¿Estás seguro de apagar el asistente de IA?</p><p className="mt-1 text-xs text-red-800/70">La confirmación estará disponible en {countdown} segundos.</p><div className="mt-3 flex gap-2"><button type="button" onClick={confirmShutdown} disabled={countdown > 0} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{countdown > 0 && <Loader2 size={14} className="animate-spin" />}Confirmar apagado</button><button type="button" onClick={() => setConfirming(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-ink/65 hover:bg-black/5">Cancelar</button></div></div>) : <button type="button" onClick={turnOn} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-ink px-4 py-3 text-sm font-semibold text-white"><CheckCircle2 size={16} /> Volver a activar</button>}</section>
  </div>;
}
