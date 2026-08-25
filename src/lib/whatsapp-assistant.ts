import "server-only";

import { hasDatabase, prisma } from "./prisma";
import { NoDatabaseError } from "./repo";
import { normalizePhone } from "./phone";
import type { WhatsappContact, WhatsappKnowledge } from "./types";

export const WHATSAPP_SETTINGS_ID = "main";

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
  phone: string;
  name?: string;
  notes?: string;
  assistantPaused: boolean;
}): Promise<WhatsappContact> {
  ensureDatabase();
  const phone = normalizePhone(input.phone);
  const data = {
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
export async function touchWhatsappContact(phoneRaw: string, name?: string): Promise<WhatsappContact> {
  ensureDatabase();
  const phone = normalizePhone(phoneRaw);
  const cleanName = name?.trim();
  const row = await prisma.whatsappContact.upsert({
    where: { phone },
    update: {
      lastSeenAt: new Date(),
      ...(cleanName ? { name: cleanName } : {}),
    },
    create: {
      phone,
      name: cleanName || null,
      lastSeenAt: new Date(),
    },
  });
  return mapContact(row);
}
