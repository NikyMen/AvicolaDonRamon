"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
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
  ImagePlus,
  LoaderCircle,
  MessageSquarePlus,
  Network,
  PauseCircle,
  Phone,
  Plus,
  Power,
  Search,
  Tags,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/phone";
import type { NormalizedWhatsappConversation } from "@/lib/ai";
import type { WhatsappContact, WhatsappKnowledge } from "@/lib/types";
import {
  deleteKnowledgeAction,
  normalizeConversationAction,
  saveContactAction,
  saveKnowledgeAction,
  setAssistantEnabledAction,
  toggleKnowledgeAction,
  type AssistantActionState,
} from "./actions";

type Tab = "information" | "graph" | "control";

const knowledgeTabs: { id: Tab; label: string; compact: string; icon: typeof BookOpen }[] = [
  { id: "information", label: "Información", compact: "Información", icon: BookOpen },
  { id: "graph", label: "Mapa de conocimiento", compact: "Mapa", icon: Network },
];

const controlTabs: { id: Tab; label: string; compact: string; icon: typeof BookOpen }[] = [
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
  mode,
}: {
  initialEnabled: boolean;
  knowledge: WhatsappKnowledge[];
  contacts: WhatsappContact[];
  mode: "knowledge" | "control";
}) {
  const router = useRouter();
  const tabs = mode === "knowledge" ? knowledgeTabs : controlTabs;
  const [tab, setTab] = useState<Tab>(mode === "knowledge" ? "information" : "control");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [editingKnowledge, setEditingKnowledge] = useState<
    WhatsappKnowledge | undefined | null
  >(null);
  const [editingContact, setEditingContact] = useState<WhatsappContact | undefined | null>(null);
  const [conversationOpen, setConversationOpen] = useState(false);
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
      searchable([contact.name, contact.phone, contact.leadId, contact.notes].filter(Boolean).join(" ")).includes(query)
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
        <div className={cn("grid gap-1", mode === "knowledge" ? "grid-cols-2" : "grid-cols-1")} role="tablist" aria-label="Secciones del módulo">
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

      {mode === "knowledge" && tab === "information" && (
        <InformationTab
          knowledge={visibleKnowledge}
          total={knowledge.length}
          query={knowledgeQuery}
          onQuery={setKnowledgeQuery}
          onCreate={() => setEditingKnowledge(undefined)}
          onCreateConversation={() => setConversationOpen(true)}
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

      {mode === "knowledge" && tab === "graph" && (
        <KnowledgeGraph
          knowledge={visibleKnowledge}
          query={knowledgeQuery}
          onQuery={setKnowledgeQuery}
          selectedId={selectedKnowledgeId}
          onSelect={setSelectedKnowledgeId}
          onEdit={setEditingKnowledge}
        />
      )}

      {mode === "control" && tab === "control" && (
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
      {conversationOpen && <ConversationModal onClose={() => setConversationOpen(false)} />}
    </div>
  );
}

function InformationTab({
  knowledge,
  total,
  query,
  onQuery,
  onCreate,
  onCreateConversation,
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
  onCreateConversation: () => void;
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
          <button
            type="button"
            onClick={onCreateConversation}
            aria-label="Añadir conversación"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-red/25 bg-brand-red/5 px-3 py-2.5 text-sm font-semibold text-brand-red transition hover:bg-brand-red/10"
          >
            <MessageSquarePlus size={16} />
            <span className="hidden lg:inline">Añadir conversación</span>
            <span className="lg:hidden">Conversación</span>
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
  const entries = useMemo(() => knowledge.slice(0, 60), [knowledge]);
  const graph = useMemo(() => buildGraph(entries), [entries]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(graph.nodes.map((node) => [node.item.id, { x: node.x, y: node.y }]))
  );
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<
    | { type: "canvas"; start: { x: number; y: number }; origin: { x: number; y: number } }
    | { type: "node"; id: string; offset: { x: number; y: number } }
    | null
  >(null);
  const selected = entries.find((item) => item.id === selectedId) ?? entries[0];

  useEffect(() => {
    setPositions((current) =>
      Object.fromEntries(
        graph.nodes.map((node) => [
          node.item.id,
          current[node.item.id] ?? { x: node.x, y: node.y },
        ])
      )
    );
  }, [graph.nodes]);

  function svgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : point;
  }

  function startCanvasDrag(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const point = svgPoint(event.clientX, event.clientY);
    dragRef.current = { type: "canvas", start: point, origin: pan };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function startNodeDrag(event: React.PointerEvent<SVGGElement>, id: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const point = svgPoint(event.clientX, event.clientY);
    const position = positions[id];
    dragRef.current = {
      type: "node",
      id,
      offset: {
        x: (point.x - pan.x) / zoom - position.x,
        y: (point.y - pan.y) / zoom - position.y,
      },
    };
    svgRef.current?.setPointerCapture(event.pointerId);
    onSelect(id);
    setDragging(true);
  }

  function moveGraph(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = svgPoint(event.clientX, event.clientY);
    if (drag.type === "canvas") {
      setPan({
        x: drag.origin.x + point.x - drag.start.x,
        y: drag.origin.y + point.y - drag.start.y,
      });
      return;
    }
    setPositions((current) => ({
      ...current,
      [drag.id]: {
        x: (point.x - pan.x) / zoom - drag.offset.x,
        y: (point.y - pan.y) / zoom - drag.offset.y,
      },
    }));
  }

  function stopDrag(event: React.PointerEvent<SVGSVGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  }

  function resetView() {
    setPositions(Object.fromEntries(graph.nodes.map((node) => [node.item.id, { x: node.x, y: node.y }])));
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }

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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold"><Network size={16} /> Cerebro del asistente</div>
            <div className="flex items-center gap-1">
              <span className="mr-2 hidden text-[11px] text-white/45 sm:inline">Arrastrá nodos o el fondo · doble clic para editar</span>
              <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.15))} aria-label="Alejar" className="rounded-lg bg-white/10 p-2 hover:bg-white/15"><ZoomOut size={14} /></button>
              <span className="w-11 text-center text-[10px] text-white/60">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(2.5, value + 0.15))} aria-label="Acercar" className="rounded-lg bg-white/10 p-2 hover:bg-white/15"><ZoomIn size={14} /></button>
              <button type="button" onClick={resetView} aria-label="Centrar mapa" title="Centrar y restaurar posiciones" className="rounded-lg bg-white/10 p-2 hover:bg-white/15"><Maximize2 size={14} /></button>
            </div>
          </div>
          <div className="overflow-hidden">
            <svg
              ref={svgRef}
              viewBox="0 0 900 520"
              className={cn("h-[32rem] w-full select-none", dragging ? "cursor-grabbing" : "cursor-grab")}
              role="img"
              aria-label="Grafo interactivo del conocimiento del asistente"
              style={{ touchAction: "none" }}
              onPointerDown={startCanvasDrag}
              onPointerMove={moveGraph}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              onWheel={(event) => {
                event.preventDefault();
                setZoom((value) => Math.min(2.5, Math.max(0.5, value + (event.deltaY < 0 ? 0.1 : -0.1))));
              }}
            >
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              <g stroke="#555564" strokeOpacity="0.45" strokeWidth={1 / zoom}>
                {graph.edges.map((edge) => {
                  const from = graph.nodes[edge.from];
                  const to = graph.nodes[edge.to];
                  const fromPosition = positions[from.item.id] ?? from;
                  const toPosition = positions[to.item.id] ?? to;
                  return <line key={`${edge.from}-${edge.to}`} x1={fromPosition.x} y1={fromPosition.y} x2={toPosition.x} y2={toPosition.y} />;
                })}
              </g>
              {graph.nodes.map((node) => {
                const active = node.item.id === selected?.id;
                const position = positions[node.item.id] ?? node;
                return (
                  <g
                    key={node.item.id}
                    transform={`translate(${position.x} ${position.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver ${node.item.title}`}
                    onPointerDown={(event) => startNodeDrag(event, node.item.id)}
                    onClick={() => onSelect(node.item.id)}
                    onDoubleClick={() => onEdit(node.item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") onSelect(node.item.id);
                    }}
                    className="cursor-move outline-none"
                  >
                    {active && <circle r="15" fill="#e83b45" fillOpacity="0.22" />}
                    <circle
                      r={active ? 7 : 5}
                      fill={node.item.active ? (active ? "#f04a54" : "#d5b35a") : "#777783"}
                    />
                    <text x="10" y="4" fill={active ? "#ffffff" : "#b8b8c2"} fontSize="10">
                      {node.item.title.length > 22 ? `${node.item.title.slice(0, 22)}…` : node.item.title}
                    </text>
                  </g>
                );
              })}
              </g>
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
                  <p className="text-xs text-brand-ink/45">Lead: {contact.leadId || "—"}</p>
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
        <Field label="Información para el bot"><textarea name="content" required maxLength={16000} rows={8} defaultValue={item?.content} placeholder="Escribí la respuesta o regla con lenguaje claro y concreto." className="input-admin resize-y" /></Field>
        <Field label="Etiquetas, separadas por coma"><input name="tags" defaultValue={item?.tags.join(", ")} placeholder="horarios, fin de semana, sucursales" className="input-admin" /></Field>
        <label className="flex items-center gap-2 rounded-xl bg-brand-cream px-3 py-2.5 font-semibold text-brand-ink"><input name="active" type="checkbox" defaultChecked={item?.active ?? true} className="h-4 w-4 accent-brand-red" /> Incluir en las respuestas de n8n</label>
        {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{state.error}</p>}
        <ModalActions pending={pending} onClose={onClose} />
      </form>
    </Modal>
  );
}

type ScreenshotPerspective = "auto" | "business-right" | "business-left";

async function readScreenshotConversation(
  files: File[],
  perspective: ScreenshotPerspective,
  onProgress: (value: number) => void
): Promise<string> {
  const { createWorker, OEM } = await import("tesseract.js");
  let currentFileIndex = 0;
  const worker = await createWorker("spa", OEM.LSTM_ONLY, {
    logger: (message) => {
      if (message.status === "recognizing text") onProgress(currentFileIndex + message.progress);
    },
  });
  const pages: string[] = [];
  try {
    for (let index = 0; index < files.length; index++) {
      currentFileIndex = index;
      const file = files[index];
      const bitmap = await createImageBitmap(file);
      const width = bitmap.width;
      bitmap.close();
      const result = await worker.recognize(file, {}, { text: true, blocks: true });
      const paragraphs = (result.data.blocks ?? [])
        .flatMap((block) => block.paragraphs)
        .filter((paragraph) => paragraph.text.trim())
        .sort((a, b) => a.bbox.y0 - b.bbox.y0);
      const text = paragraphs.length
        ? paragraphs
            .map((paragraph) => {
              const side = (paragraph.bbox.x0 + paragraph.bbox.x1) / 2 >= width / 2
                ? "right"
                : "left";
              const speaker = perspective === "auto"
                ? `Burbuja ${side === "right" ? "derecha" : "izquierda"}`
                : perspective === `business-${side}`
                  ? "Negocio"
                  : "Cliente";
              return `[${speaker}] ${paragraph.text.replace(/\s*\n\s*/g, " ").trim()}`;
            })
            .join("\n")
        : `[Sin identificar] ${result.data.text.replace(/\n{2,}/g, "\n").trim()}`;
      pages.push(`[Captura ${index + 1}: ${file.name}]\n${text}`);
      onProgress(index + 1);
    }
  } finally {
    await worker.terminate();
  }
  return pages.join("\n\n");
}

function ConversationModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [saveState, saveAction, saving] = useActionState<AssistantActionState, FormData>(saveKnowledgeAction, {});
  const [raw, setRaw] = useState("");
  const [context, setContext] = useState("");
  const [desired, setDesired] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [extractedText, setExtractedText] = useState("");
  const [perspective, setPerspective] = useState<ScreenshotPerspective>("auto");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [normalized, setNormalized] = useState<NormalizedWhatsappConversation>();

  useEffect(() => {
    if (saveState.ok) {
      router.refresh();
      onClose();
    }
  }, [saveState.ok, onClose, router]);

  async function normalize() {
    if (!raw.trim() && files.length === 0 && !extractedText) {
      setError("Pegá una conversación o seleccioná al menos una captura.");
      return;
    }
    setProcessing(true);
    setError("");
    setProgress(0);
    try {
      const screenshotText = files.length
        ? await readScreenshotConversation(
            files,
            perspective,
            (value) => setProgress(value / files.length)
          )
        : extractedText;
      if (files.length) {
        setExtractedText(screenshotText);
        setFiles([]);
        setFileInputKey((value) => value + 1);
      }
      const combined = [
        context.trim() && `[Contexto del administrador]\n${context.trim()}`,
        raw.trim() && `[Texto escrito]\n${raw.trim()}`,
        screenshotText,
      ]
        .filter(Boolean)
        .join("\n\n");
      const result = await normalizeConversationAction(combined, desired);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNormalized(result.conversation);
    } catch (cause) {
      console.error(cause);
      setError("No se pudieron leer las capturas. Probá con imágenes más nítidas o pegá el texto.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Modal title="Añadir conversación" onClose={onClose} wide>
      {!normalized ? (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800">
            Podés cargar varias capturas en orden. El texto se extrae en este dispositivo: las imágenes no se suben ni se guardan y se descartan al terminar el OCR.
          </div>
          <Field label="Conversación por escrito">
            <textarea
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              maxLength={24000}
              rows={7}
              placeholder="Pegá la conversación. Si podés, indicá Cliente: y Negocio: en cada mensaje."
              className="input-admin resize-y"
            />
          </Field>
          <Field label="Capturas de la conversación">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-brand-red/30 bg-brand-red/[.03] px-4 py-6 text-center transition hover:bg-brand-red/[.06]">
              <ImagePlus size={24} className="text-brand-red" />
              <span className="mt-2 font-semibold text-brand-ink">Seleccionar capturas</span>
              <span className="mt-1 text-xs text-brand-ink/50">PNG, JPG o WebP · podés elegir varias</span>
              <input
                key={fileInputKey}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => {
                  setFiles(Array.from(event.target.files ?? []));
                  setExtractedText("");
                }}
              />
            </label>
            {files.length > 0 && (
              <p className="mt-2 text-xs text-brand-ink/55">{files.length} captura(s): {files.map((file) => file.name).join(", ")}</p>
            )}
            {!files.length && extractedText && (
              <p className="mt-2 text-xs font-semibold text-emerald-700">Texto extraído. Las capturas ya fueron descartadas.</p>
            )}
          </Field>
          <Field label="¿Desde qué teléfono se tomó la captura?">
            <select
              value={perspective}
              onChange={(event) => setPerspective(event.target.value as ScreenshotPerspective)}
              className="input-admin"
            >
              <option value="auto">Automático: que la IA identifique al negocio</option>
              <option value="business-right">Del negocio: sus mensajes están a la derecha</option>
              <option value="business-left">Del cliente: el negocio está a la izquierda</option>
            </select>
          </Field>
          <Field label="Contexto para interpretar las capturas">
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Ej. La captura la mandó el cliente; el asistente es quien informa precios y horarios."
              className="input-admin resize-y"
            />
          </Field>
          <Field label="¿Qué debe aprender o cambiar el bot?">
            <textarea
              value={desired}
              onChange={(event) => setDesired(event.target.value)}
              maxLength={4000}
              rows={4}
              placeholder="Ej. No digas siempre «te paso con una persona». Si preguntan por envío, respondé primero el costo y después pedí la zona."
              className="input-admin resize-y"
            />
          </Field>
          {processing && (
            <div className="rounded-xl bg-brand-cream px-3 py-3">
              <p className="flex items-center gap-2 font-semibold text-brand-ink"><LoaderCircle size={16} className="animate-spin" /> {files.length ? "Leyendo y normalizando capturas…" : "Normalizando conversación…"}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-brand-red transition-all" style={{ width: `${Math.max(8, Math.round(progress * 100))}%` }} /></div>
            </div>
          )}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 font-semibold text-brand-ink/65 hover:bg-black/5">Cancelar</button>
            <button type="button" disabled={processing} onClick={normalize} className="btn-primary disabled:opacity-50">{processing ? "Procesando…" : "Normalizar conversación"}</button>
          </div>
        </div>
      ) : (
        <form action={saveAction} className="space-y-4 text-sm">
          <input type="hidden" name="category" value="conversaciones" />
          <input type="hidden" name="active" value="on" />
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {normalized.usedAi ? "La conversación fue limpiada y ordenada. Revisala antes de guardarla." : "Se aplicó una limpieza básica porque la IA no está configurada. Revisá especialmente quién dijo cada mensaje."}
          </div>
          <Field label="Título"><input name="title" required maxLength={120} defaultValue={normalized.title} className="input-admin" /></Field>
          <Field label="Conversación normalizada"><textarea name="conversationTranscript" required maxLength={12000} rows={10} defaultValue={normalized.transcript} className="input-admin resize-y" /></Field>
          <Field label="Cómo debería contestar"><textarea name="desiredResponse" required maxLength={4000} rows={5} defaultValue={normalized.guidance} className="input-admin resize-y" /></Field>
          <Field label="Etiquetas, separadas por coma"><input name="tags" defaultValue={normalized.tags.join(", ")} className="input-admin" /></Field>
          {saveState.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{saveState.error}</p>}
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <button type="button" onClick={() => setNormalized(undefined)} className="rounded-lg border border-black/10 px-4 py-2 font-semibold text-brand-ink/65 hover:bg-black/5">Volver</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Guardando…" : "Guardar aprendizaje"}</button>
          </div>
        </form>
      )}
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
          <Field label="Lead ID"><input name="leadId" defaultValue={contact?.leadId} placeholder="Se completa desde n8n" className="input-admin" /></Field>
          <Field label="Teléfono"><input name="phone" required defaultValue={contact?.phone} placeholder="Ej. +54 9 379 400 0000" className="input-admin" /></Field>
        <Field label="Notas internas"><textarea name="notes" maxLength={1000} rows={4} defaultValue={contact?.notes} placeholder="No se envían a n8n ni al modelo." className="input-admin resize-y" /></Field>
        <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 font-semibold text-amber-900"><input name="assistantPaused" type="checkbox" defaultChecked={contact?.assistantPaused} className="h-4 w-4 accent-amber-700" /><PauseCircle size={16} /> Pausar respuestas para este número</label>
        {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{state.error}</p>}
        <ModalActions pending={pending} onClose={onClose} />
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cn("max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-soft sm:p-6", wide ? "max-w-3xl" : "max-w-xl")} onClick={(event) => event.stopPropagation()}>
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
