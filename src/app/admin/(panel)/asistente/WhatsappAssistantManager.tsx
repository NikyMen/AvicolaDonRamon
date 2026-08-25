"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  CircleOff,
  Clock3,
  Edit3,
  Network,
  PauseCircle,
  Phone,
  Plus,
  Power,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/phone";
import type { WhatsappContact, WhatsappKnowledge } from "@/lib/types";
import {
  deleteKnowledgeAction,
  saveContactAction,
  saveKnowledgeAction,
  setAssistantEnabledAction,
  toggleKnowledgeAction,
  type AssistantActionState,
} from "./actions";

type Tab = "information" | "graph" | "control";

const tabs: { id: Tab; label: string; compact: string; icon: typeof BookOpen }[] = [
  { id: "information", label: "Información", compact: "Información", icon: BookOpen },
  { id: "graph", label: "Mapa de conocimiento", compact: "Mapa", icon: Network },
  { id: "control", label: "Control del asistente", compact: "Control", icon: Power },
];

function searchable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function formatDate(value?: string): string {
  if (!value) return "Sin interacciones todavía";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function WhatsappAssistantManager({
  initialEnabled,
  knowledge,
  contacts,
}: {
  initialEnabled: boolean;
  knowledge: WhatsappKnowledge[];
  contacts: WhatsappContact[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("information");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [editingKnowledge, setEditingKnowledge] = useState<
    WhatsappKnowledge | undefined | null
  >(null);
  const [editingContact, setEditingContact] = useState<WhatsappContact | undefined | null>(null);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => setEnabled(initialEnabled), [initialEnabled]);

  const visibleKnowledge = useMemo(() => {
    const query = searchable(knowledgeQuery.trim());
    if (!query) return knowledge;
    return knowledge.filter((item) =>
      searchable([item.title, item.category, item.content, ...item.tags].join(" ")).includes(query)
    );
  }, [knowledge, knowledgeQuery]);

  const visibleContacts = useMemo(() => {
    const query = searchable(contactQuery.trim());
    if (!query) return contacts;
    return contacts.filter((contact) =>
      searchable([contact.name, contact.phone, contact.notes].filter(Boolean).join(" ")).includes(query)
    );
  }, [contacts, contactQuery]);

  function runAction(action: () => Promise<AssistantActionState>, onSuccess?: () => void) {
    startTransition(() => {
      void action().then((result) => {
        if (result.error) {
          window.alert(result.error);
          return;
        }
        onSuccess?.();
        router.refresh();
      });
    });
  }

  function changeEnabled(next: boolean) {
    if (!next && !window.confirm("¿Apagar el asistente de WhatsApp para todos los contactos?")) {
      return;
    }
    runAction(() => setAssistantEnabledAction(next), () => setEnabled(next));
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-[4.1rem] z-30 rounded-2xl bg-white/95 p-1.5 shadow-soft backdrop-blur">
        <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Secciones del asistente">
          {tabs.map(({ id, label, compact, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "flex min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-semibold transition sm:text-sm",
                tab === id
                  ? "bg-brand-ink text-white shadow-sm"
                  : "text-brand-ink/55 hover:bg-brand-cream hover:text-brand-ink"
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span className="hidden truncate sm:inline">{label}</span>
              <span className="truncate sm:hidden">{compact}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "information" && (
        <InformationTab
          knowledge={visibleKnowledge}
          total={knowledge.length}
          query={knowledgeQuery}
          onQuery={setKnowledgeQuery}
          onCreate={() => setEditingKnowledge(undefined)}
          onEdit={setEditingKnowledge}
          pending={pending}
          onToggle={(item) =>
            runAction(() => toggleKnowledgeAction(item.id, !item.active))
          }
          onDelete={(item) => {
            if (window.confirm(`¿Eliminar “${item.title}” del conocimiento del bot?`)) {
              runAction(() => deleteKnowledgeAction(item.id));
            }
          }}
        />
      )}

      {tab === "graph" && (
        <KnowledgeGraph
          knowledge={visibleKnowledge}
          query={knowledgeQuery}
          onQuery={setKnowledgeQuery}
          selectedId={selectedKnowledgeId}
          onSelect={setSelectedKnowledgeId}
          onEdit={setEditingKnowledge}
        />
      )}

      {tab === "control" && (
        <ControlTab
          enabled={enabled}
          pending={pending}
          contacts={visibleContacts}
          total={contacts.length}
          query={contactQuery}
          onQuery={setContactQuery}
          onEnabledChange={changeEnabled}
          onCreate={() => setEditingContact(undefined)}
          onEdit={setEditingContact}
        />
      )}

      {editingKnowledge !== null && (
        <KnowledgeModal
          item={editingKnowledge}
          onClose={() => setEditingKnowledge(null)}
        />
      )}
      {editingContact !== null && (
        <ContactModal contact={editingContact} onClose={() => setEditingContact(null)} />
      )}
    </div>
  );
}

function InformationTab({
  knowledge,
  total,
  query,
  onQuery,
  onCreate,
  onEdit,
  onToggle,
  onDelete,
  pending,
}: {
  knowledge: WhatsappKnowledge[];
  total: number;
  query: string;
  onQuery: (value: string) => void;
  onCreate: () => void;
  onEdit: (item: WhatsappKnowledge) => void;
  onToggle: (item: WhatsappKnowledge) => void;
  onDelete: (item: WhatsappKnowledge) => void;
  pending: boolean;
}) {
  return (
    <section className="space-y-4" aria-labelledby="knowledge-title">
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="knowledge-title" className="font-semibold text-brand-ink">
            Información para el bot
          </h2>
          <p className="text-xs text-brand-ink/50">
            {knowledge.length === total ? `${total} entradas` : `${knowledge.length} de ${total} entradas`}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 gap-2 sm:max-w-2xl sm:justify-end">
          <SearchInput
            value={query}
            onChange={onQuery}
            placeholder="Buscar información o etiquetas"
          />
          <button type="button" onClick={onCreate} className="btn-primary shrink-0">
            <Plus size={16} /> <span className="hidden sm:inline">Añadir información</span>
            <span className="sm:hidden">Añadir</span>
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {knowledge.map((item) => (
          <article
            key={item.id}
            className={cn(
              "rounded-2xl bg-white p-4 shadow-soft ring-1",
              item.active ? "ring-black/5" : "opacity-70 ring-black/10"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
                <BrainCircuit size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-brand-ink">{item.title}</h3>
                  <span className="rounded-full bg-brand-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-ink/55">
                    {item.category}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      item.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-black/10 text-brand-ink/55"
                    )}
                  >
                    {item.active ? "Activa" : "Pausada"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-brand-ink/60">
                  {item.content}
                </p>
                {item.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-700">
                        <Tags size={10} /> {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-black/5 pt-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => onToggle(item)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-ink/60 hover:bg-black/5"
              >
                {item.active ? "Pausar" : "Activar"}
              </button>
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-brand-ink/70 hover:bg-black/5"
              >
                <Edit3 size={13} /> Editar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => onDelete(item)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>

      {knowledge.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title={total === 0 ? "Todavía no cargaste información" : "No encontramos coincidencias"}
          description={
            total === 0
              ? "Añadí políticas, horarios, formas de pago y respuestas frecuentes para mejorar al bot."
              : "Probá con otra palabra o etiqueta."
          }
        />
      )}
    </section>
  );
}

function KnowledgeGraph({
  knowledge,
  query,
  onQuery,
  selectedId,
  onSelect,
  onEdit,
}: {
  knowledge: WhatsappKnowledge[];
  query: string;
  onQuery: (value: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (item: WhatsappKnowledge) => void;
}) {
  const entries = knowledge.slice(0, 60);
  const graph = useMemo(() => buildGraph(entries), [entries]);
  const selected = entries.find((item) => item.id === selectedId) ?? entries[0];

  return (
    <section className="space-y-4" aria-labelledby="graph-title">
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="graph-title" className="font-semibold text-brand-ink">Mapa de conocimiento</h2>
          <p className="text-xs text-brand-ink/50">Las líneas conectan información con categorías o etiquetas compartidas.</p>
        </div>
        <div className="w-full sm:max-w-md">
          <SearchInput value={query} onChange={onQuery} placeholder="Buscar nodos" />
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="overflow-hidden rounded-2xl bg-[#17171c] shadow-soft">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold"><Network size={16} /> Cerebro del asistente</div>
            <span className="text-[11px] text-white/45">{entries.length} nodos · {graph.edges.length} conexiones</span>
          </div>
          <div className="overflow-x-auto">
            <svg viewBox="0 0 900 520" className="min-h-[25rem] min-w-[44rem] w-full" role="img" aria-label="Grafo del conocimiento del asistente">
              <g stroke="#555564" strokeOpacity="0.45" strokeWidth="1">
                {graph.edges.map((edge) => {
                  const from = graph.nodes[edge.from];
                  const to = graph.nodes[edge.to];
                  return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
                })}
              </g>
              {graph.nodes.map((node) => {
                const active = node.item.id === selected?.id;
                return (
                  <g
                    key={node.item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver ${node.item.title}`}
                    onClick={() => onSelect(node.item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") onSelect(node.item.id);
                    }}
                    className="cursor-pointer outline-none"
                  >
                    {active && <circle cx={node.x} cy={node.y} r="15" fill="#e83b45" fillOpacity="0.22" />}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={active ? 7 : 5}
                      fill={node.item.active ? (active ? "#f04a54" : "#d5b35a") : "#777783"}
                    />
                    <text x={node.x + 10} y={node.y + 4} fill={active ? "#ffffff" : "#b8b8c2"} fontSize="10">
                      {node.item.title.length > 22 ? `${node.item.title.slice(0, 22)}…` : node.item.title}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          {selected && (
            <div className="border-t border-white/10 bg-black/20 p-4 text-white">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{selected.title}</h3>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-white/60">{selected.category}</span>
                  </div>
                  <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/60">{selected.content}</p>
                </div>
                <button type="button" onClick={() => onEdit(selected)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">
                  <Edit3 size={13} /> Editar nodo
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState icon={Network} title="No hay nodos para mostrar" description="Cargá información o limpiá la búsqueda para construir el mapa." />
      )}
    </section>
  );
}

function buildGraph(entries: WhatsappKnowledge[]) {
  const nodes = entries.map((item, index) => {
    const categoryHash = [...item.category].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const angle = ((categoryHash % 12) / 12) * Math.PI * 2 + index * 0.42;
    const ring = 110 + (index % 4) * 48;
    return {
      item,
      x: 450 + Math.cos(angle) * ring,
      y: 260 + Math.sin(angle) * Math.min(ring, 205),
    };
  });
  const edges: { from: number; to: number }[] = [];
  for (let from = 0; from < entries.length; from++) {
    for (let to = from + 1; to < entries.length; to++) {
      const sameCategory = entries[from].category === entries[to].category;
      const sharedTag = entries[from].tags.some((tag) => entries[to].tags.includes(tag));
      if (sameCategory || sharedTag) edges.push({ from, to });
      if (edges.length >= 240) break;
    }
    if (edges.length >= 240) break;
  }
  return { nodes, edges };
}

function ControlTab({
  enabled,
  pending,
  contacts,
  total,
  query,
  onQuery,
  onEnabledChange,
  onCreate,
  onEdit,
}: {
  enabled: boolean;
  pending: boolean;
  contacts: WhatsappContact[];
  total: number;
  query: string;
  onQuery: (value: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onCreate: () => void;
  onEdit: (contact: WhatsappContact) => void;
}) {
  return (
    <section className="space-y-4" aria-labelledby="control-title">
      <div className={cn("rounded-2xl border p-5 shadow-soft", enabled ? "border-emerald-200 bg-white" : "border-red-200 bg-red-50")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", enabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
              {enabled ? <CheckCircle2 size={20} /> : <CircleOff size={20} />}
            </span>
            <div>
              <h2 id="control-title" className="font-semibold text-brand-ink">Estado global</h2>
              <p className="text-sm text-brand-ink/55">
                {enabled ? "n8n puede responder salvo a los contactos pausados." : "n8n recibirá la orden de no responder a ningún contacto."}
              </p>
              <p className={cn("mt-2 text-sm font-semibold", enabled ? "text-emerald-700" : "text-red-700")}>
                {enabled ? "Asistente activo" : "Asistente apagado"}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => onEnabledChange(!enabled)}
            className={cn("inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50", enabled ? "bg-red-700 hover:bg-red-800" : "bg-brand-ink hover:opacity-90")}
          >
            <Power size={16} /> {enabled ? "Apagar para todos" : "Volver a activar"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-brand-ink">Contactos de WhatsApp</h3>
            <p className="text-xs text-brand-ink/50">{contacts.length === total ? `${total} registrados` : `${contacts.length} de ${total} registrados`}</p>
          </div>
          <div className="flex min-w-0 flex-1 gap-2 sm:max-w-2xl sm:justify-end">
            <SearchInput value={query} onChange={onQuery} placeholder="Buscar nombre, teléfono o nota" />
            <button type="button" onClick={onCreate} className="btn-primary shrink-0"><Plus size={16} /> Añadir</button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
        <div className="divide-y divide-black/5">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-cream text-brand-red"><Phone size={17} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-brand-ink">{contact.name || "Contacto sin nombre"}</p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", contact.assistantPaused ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700")}>
                    {contact.assistantPaused ? "En pausa" : "Activo"}
                  </span>
                </div>
                <p className="text-sm text-brand-ink/60">{formatPhone(contact.phone)}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-brand-ink/40"><Clock3 size={11} /> {formatDate(contact.lastSeenAt)}</p>
                {contact.notes && <p className="mt-1 truncate text-xs text-brand-ink/50">Nota interna: {contact.notes}</p>}
              </div>
              <button type="button" onClick={() => onEdit(contact)} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold text-brand-ink/70 hover:bg-black/5"><Edit3 size={13} /> Editar</button>
            </div>
          ))}
        </div>
        {contacts.length === 0 && (
          <div className="p-4"><EmptyState icon={Phone} title={total === 0 ? "Todavía no hay contactos" : "No encontramos coincidencias"} description={total === 0 ? "Se agregarán automáticamente cuando n8n consulte el contexto o podés cargarlos ahora." : "Probá con otro nombre, teléfono o nota."} compact /></div>
        )}
      </div>
    </section>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{placeholder}</span>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/35" />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-black/10 bg-brand-cream py-2.5 pl-9 pr-3 text-sm text-brand-ink outline-none focus:border-brand-red/40" />
    </label>
  );
}

function KnowledgeModal({ item, onClose }: { item?: WhatsappKnowledge; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AssistantActionState, FormData>(saveKnowledgeAction, {});
  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state.ok, onClose, router]);

  return (
    <Modal title={item ? "Editar información" : "Añadir información"} onClose={onClose}>
      <form action={formAction} className="space-y-4 text-sm">
        {item && <input type="hidden" name="id" value={item.id} />}
        <Field label="Título"><input name="title" required maxLength={120} defaultValue={item?.title} placeholder="Ej. Horarios de atención" className="input-admin" /></Field>
        <Field label="Categoría"><input name="category" required maxLength={50} defaultValue={item?.category ?? "preguntas frecuentes"} list="knowledge-categories" className="input-admin" /><datalist id="knowledge-categories"><option value="preguntas frecuentes" /><option value="horarios" /><option value="envíos" /><option value="pagos" /><option value="políticas" /><option value="productos" /></datalist></Field>
        <Field label="Información para el bot"><textarea name="content" required maxLength={6000} rows={8} defaultValue={item?.content} placeholder="Escribí la respuesta o regla con lenguaje claro y concreto." className="input-admin resize-y" /></Field>
        <Field label="Etiquetas, separadas por coma"><input name="tags" defaultValue={item?.tags.join(", ")} placeholder="horarios, fin de semana, sucursales" className="input-admin" /></Field>
        <label className="flex items-center gap-2 rounded-xl bg-brand-cream px-3 py-2.5 font-semibold text-brand-ink"><input name="active" type="checkbox" defaultChecked={item?.active ?? true} className="h-4 w-4 accent-brand-red" /> Incluir en las respuestas de n8n</label>
        {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{state.error}</p>}
        <ModalActions pending={pending} onClose={onClose} />
      </form>
    </Modal>
  );
}

function ContactModal({ contact, onClose }: { contact?: WhatsappContact; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AssistantActionState, FormData>(saveContactAction, {});
  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state.ok, onClose, router]);

  return (
    <Modal title={contact ? "Editar contacto" : "Añadir contacto"} onClose={onClose}>
      <form action={formAction} className="space-y-4 text-sm">
        {contact && <input type="hidden" name="id" value={contact.id} />}
        <Field label="Nombre"><input name="name" maxLength={100} defaultValue={contact?.name} placeholder="Opcional" className="input-admin" /></Field>
        <Field label="Teléfono"><input name="phone" required defaultValue={contact?.phone} placeholder="Ej. +54 9 379 400 0000" className="input-admin" /></Field>
        <Field label="Notas internas"><textarea name="notes" maxLength={1000} rows={4} defaultValue={contact?.notes} placeholder="No se envían a n8n ni al modelo." className="input-admin resize-y" /></Field>
        <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 font-semibold text-amber-900"><input name="assistantPaused" type="checkbox" defaultChecked={contact?.assistantPaused} className="h-4 w-4 accent-amber-700" /><PauseCircle size={16} /> Pausar respuestas para este número</label>
        {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{state.error}</p>}
        <ModalActions pending={pending} onClose={onClose} />
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-soft sm:p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-brand-ink">{title}</h2><button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-brand-ink/45 hover:bg-black/5"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block font-semibold text-brand-ink">{label}</span>{children}</label>;
}

function ModalActions({ pending, onClose }: { pending: boolean; onClose: () => void }) {
  return <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 font-semibold text-brand-ink/65 hover:bg-black/5">Cancelar</button><button type="submit" disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar"}</button></div>;
}

function EmptyState({ icon: Icon, title, description, compact = false }: { icon: typeof BookOpen; title: string; description: string; compact?: boolean }) {
  return <div className={cn("rounded-2xl border border-dashed border-black/10 bg-white text-center", compact ? "p-5" : "p-9 shadow-soft")}><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-cream text-brand-ink/45"><Icon size={19} /></span><h3 className="mt-3 font-semibold text-brand-ink">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm text-brand-ink/50">{description}</p></div>;
}
