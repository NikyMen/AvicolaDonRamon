import "server-only";

import { hasDatabase, prisma } from "./prisma";
import { NoDatabaseError } from "./repo";
import { normalizePhone } from "./phone";
import type { WhatsappContact, WhatsappKnowledge } from "./types";

export const WHATSAPP_SETTINGS_ID = "main";

const GLOBAL_KNOWLEDGE_CATEGORIES = new Set([
  "general",
  "instrucciones",
  "politicas",
  "reglas",
  "tono",
]);

const SEARCH_STOP_WORDS = new Set([
  "como",
  "con",
  "cuando",
  "donde",
  "para",
  "pero",
  "porque",
  "por",
  "que",
  "quiero",
  "sobre",
  "tiene",
  "tienen",
  "una",
  "uno",
  "unos",
  "unas",
]);

function searchable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchTerms(value: string): string[] {
  return [...new Set(
    searchable(value)
      .split(" ")
      .filter((term) => term.length >= 3 && !SEARCH_STOP_WORDS.has(term))
  )].slice(0, 24);
}

/**
 * Prioriza reglas globales y ejemplos relacionados con el mensaje actual.
 * Evita enviar toda la base a la IA cuando el aprendizaje crece sin sumar
 * una dependencia de embeddings ni perder las instrucciones generales.
 */
export function selectRelevantWhatsappKnowledge(
  knowledge: WhatsappKnowledge[],
  message: string,
  options: { maxEntries?: number; maxCharacters?: number } = {}
): WhatsappKnowledge[] {
  const terms = searchTerms(message);
  const maxEntries = options.maxEntries ?? 16;
  const maxCharacters = options.maxCharacters ?? 24_000;

  const scored = knowledge.map((item, index) => {
    const category = searchable(item.category);
    const title = searchable(item.title);
    const tags = searchable(item.tags.join(" "));
    const content = searchable(item.content);
    const global = GLOBAL_KNOWLEDGE_CATEGORIES.has(category);
    const relevance = terms.reduce(
      (score, term) =>
        score
        + (title.includes(term) ? 8 : 0)
        + (tags.includes(term) ? 6 : 0)
        + (category.includes(term) ? 4 : 0)
        + (content.includes(term) ? 1 : 0),
      0
    );
    return { item, index, global, relevance };
  });

  scored.sort((a, b) =>
    Number(b.global) - Number(a.global)
    || b.relevance - a.relevance
    || a.index - b.index
  );

  const selected: WhatsappKnowledge[] = [];
  let characters = 0;
  for (const candidate of scored) {
    if (selected.length >= maxEntries) break;
    if (!candidate.global && terms.length > 0 && candidate.relevance === 0) continue;
    const size = candidate.item.title.length + candidate.item.content.length;
    if (selected.length > 0 && characters + size > maxCharacters) continue;
    selected.push(candidate.item);
    characters += size;
  }

  // Sin coincidencias claras, conserva ejemplos recientes para que la base no
  // quede invisible ante mensajes cortos o con errores de escritura.
  if (selected.length === 0) return knowledge.slice(0, Math.min(6, maxEntries));
  return selected;
}

function ensureDatabase() {
  if (!hasDatabase) throw new NoDatabaseError();
}

function mapKnowledge(row: {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): WhatsappKnowledge {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapContact(row: {
  id: string;
  leadId?: string | null;
  phone: string;
  name: string | null;
  notes: string | null;
  assistantPaused: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): WhatsappContact {
  return {
    id: row.id,
    leadId: row.leadId ?? undefined,
    phone: row.phone,
    name: row.name ?? undefined,
    notes: row.notes ?? undefined,
    assistantPaused: row.assistantPaused,
    lastSeenAt: row.lastSeenAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getWhatsappAssistantEnabled(): Promise<boolean> {
  if (!hasDatabase) return true;
  const settings = await prisma.whatsappAssistantSettings.upsert({
    where: { id: WHATSAPP_SETTINGS_ID },
    update: {},
    create: { id: WHATSAPP_SETTINGS_ID, enabled: true },
  });
  return settings.enabled;
}

export async function setWhatsappAssistantEnabled(enabled: boolean): Promise<boolean> {
  ensureDatabase();
  const settings = await prisma.whatsappAssistantSettings.upsert({
    where: { id: WHATSAPP_SETTINGS_ID },
    update: { enabled },
    create: { id: WHATSAPP_SETTINGS_ID, enabled },
  });
  return settings.enabled;
}

export async function listWhatsappKnowledge(options?: {
  activeOnly?: boolean;
}): Promise<WhatsappKnowledge[]> {
  if (!hasDatabase) return [];
  const rows = await prisma.whatsappKnowledge.findMany({
    where: options?.activeOnly ? { active: true } : undefined,
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(mapKnowledge);
}

export async function saveWhatsappKnowledge(input: {
  id?: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  active: boolean;
}): Promise<WhatsappKnowledge> {
  ensureDatabase();
  const data = {
    title: input.title,
    category: input.category,
    content: input.content,
    tags: input.tags,
    active: input.active,
  };
  const row = input.id
    ? await prisma.whatsappKnowledge.update({ where: { id: input.id }, data })
    : await prisma.whatsappKnowledge.create({ data });
  return mapKnowledge(row);
}

export async function toggleWhatsappKnowledge(id: string, active: boolean): Promise<void> {
  ensureDatabase();
  await prisma.whatsappKnowledge.update({ where: { id }, data: { active } });
}

export async function deleteWhatsappKnowledge(id: string): Promise<void> {
  ensureDatabase();
  await prisma.whatsappKnowledge.delete({ where: { id } });
}

export async function listWhatsappContacts(): Promise<WhatsappContact[]> {
  if (!hasDatabase) return [];
  const rows = await prisma.whatsappContact.findMany({
    orderBy: [{ lastSeenAt: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(mapContact);
}

export async function saveWhatsappContact(input: {
  id?: string;
  leadId?: string;
  phone: string;
  name?: string;
  notes?: string;
  assistantPaused: boolean;
}): Promise<WhatsappContact> {
  ensureDatabase();
  const phone = input.phone ? normalizePhone(input.phone) : undefined;
  if (input.id && !phone) {
    const row = await prisma.whatsappContact.update({
      where: { id: input.id },
      data: { assistantPaused: input.assistantPaused },
    });
    return mapContact(row);
  }
  if (!phone) throw new Error("El teléfono es obligatorio.");
  const data = {
    leadId: input.leadId?.trim() || null,
    phone,
    name: input.name?.trim() || null,
    notes: input.notes?.trim() || null,
    assistantPaused: input.assistantPaused,
  };
  const row = input.id
    ? await prisma.whatsappContact.update({ where: { id: input.id }, data })
    : await prisma.whatsappContact.upsert({
        where: { phone },
        update: data,
        create: data,
      });
  return mapContact(row);
}

/** Registra la interacción que n8n consulta sin guardar mensajes. */
export async function touchWhatsappContact(phoneRaw: string, name?: string, leadId?: string): Promise<WhatsappContact> {
  ensureDatabase();
  const phone = normalizePhone(phoneRaw);
  const cleanName = name?.trim();
  const cleanLeadId = leadId?.trim() || undefined;
  const row = await prisma.whatsappContact.upsert({
    where: { phone },
    update: {
      lastSeenAt: new Date(),
      ...(cleanName ? { name: cleanName } : {}),
      ...(cleanLeadId ? { leadId: cleanLeadId } : {}),
    },
    create: {
      phone,
      leadId: cleanLeadId,
      name: cleanName || null,
      lastSeenAt: new Date(),
    },
  });
  return mapContact(row);
}

export async function recordWhatsappInteraction(input: { contactId: string; leadId?: string | null; phone: string; message?: string }) {
  if (!hasDatabase) return;
  await prisma.whatsappInteraction.create({ data: {
    contactId: input.contactId,
    leadId: input.leadId ?? null,
    phone: input.phone,
    message: input.message?.slice(0, 4000) || null,
  }});
}

export async function getWhatsappFlowDashboard() {
  if (!hasDatabase) return { today: { interactions: 0, contacts: 0 }, byDay: [], activeContacts: 0, totalContacts: 0 };
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const interactions = await prisma.whatsappInteraction.findMany({ where: { createdAt: { gte: new Date(Date.now() - 6 * 86400000) } }, select: { contactId: true, createdAt: true } });
  const today = interactions.filter((x) => x.createdAt >= start);
  const byDay = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6-i)); return { label: d.toLocaleDateString("es-AR", { weekday: "short" }), value: interactions.filter((x) => x.createdAt.toDateString() === d.toDateString()).length }; });
  return { today: { interactions: today.length, contacts: new Set(today.map((x) => x.contactId)).size }, byDay, activeContacts: new Set(interactions.map((x) => x.contactId)).size, totalContacts: await prisma.whatsappContact.count() };
}
