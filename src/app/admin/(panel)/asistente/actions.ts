"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { assertPerm } from "@/lib/auth/permissions";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import {
  deleteWhatsappKnowledge,
  saveWhatsappContact,
  saveWhatsappKnowledge,
  setWhatsappAssistantEnabled,
  toggleWhatsappKnowledge,
} from "@/lib/whatsapp-assistant";
import { NoDatabaseError } from "@/lib/repo";
import {
  normalizeWhatsappConversation,
  type NormalizedWhatsappConversation,
} from "@/lib/ai";

export interface AssistantActionState {
  ok?: boolean;
  error?: string;
}

async function requireAssistantPermission(): Promise<string | null> {
  return assertPerm("asistente");
}

function failure(error: unknown): AssistantActionState {
  if (error instanceof NoDatabaseError) return { error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { error: "Ese teléfono ya está registrado." };
  }
  return { error: "No se pudieron guardar los cambios." };
}

function refreshAssistant() {
  revalidatePath("/admin/asistente");
  revalidatePath("/admin/conocimiento");
}

async function requireKnowledgePermission(): Promise<string | null> {
  return assertPerm("conocimiento");
}

export async function saveKnowledgeAction(
  _previous: AssistantActionState,
  formData: FormData
): Promise<AssistantActionState> {
  const denied = await requireKnowledgePermission();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "general";
  const transcript = String(formData.get("conversationTranscript") ?? "").trim();
  const guidance = String(formData.get("desiredResponse") ?? "").trim();
  const content = transcript
    ? `CONVERSACIÓN DE EJEMPLO:\n${transcript}\n\nCÓMO DEBERÍA RESPONDER:\n${guidance}`.trim()
    : String(formData.get("content") ?? "").trim();
  const tags = [...new Set(
    String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim().toLocaleLowerCase("es"))
      .filter(Boolean)
  )].slice(0, 12);

  if (!title || title.length > 120) return { error: "El título debe tener entre 1 y 120 caracteres." };
  if (category.length > 50) return { error: "La categoría no puede superar 50 caracteres." };
  if (transcript && !guidance) return { error: "Indicá cómo debería responder el bot." };
  if (!content || content.length > 16000) {
    return { error: "La información debe tener entre 1 y 16.000 caracteres." };
  }

  try {
    await saveWhatsappKnowledge({
      id,
      title,
      category,
      content,
      tags,
      active: formData.get("active") === "on",
    });
    refreshAssistant();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export type NormalizeConversationState =
  | { ok: true; conversation: NormalizedWhatsappConversation }
  | { ok?: false; error: string };

export async function normalizeConversationAction(
  rawConversation: string,
  desiredResponse: string
): Promise<NormalizeConversationState> {
  const denied = await requireKnowledgePermission();
  if (denied) return { error: denied };
  const raw = rawConversation.trim();
  if (!raw) return { error: "Pegá una conversación o seleccioná al menos una captura." };
  if (raw.length > 24_000) return { error: "La conversación supera el máximo de 24.000 caracteres." };
  if (desiredResponse.length > 4_000) return { error: "La pauta supera el máximo de 4.000 caracteres." };

  try {
    return {
      ok: true,
      conversation: await normalizeWhatsappConversation(raw, desiredResponse),
    };
  } catch (error) {
    console.error("Error al normalizar conversación", error);
    return { error: "No se pudo normalizar la conversación. Revisá la configuración de IA e intentá de nuevo." };
  }
}

export async function toggleKnowledgeAction(
  id: string,
  active: boolean
): Promise<AssistantActionState> {
  const denied = await requireKnowledgePermission();
  if (denied) return { error: denied };
  try {
    await toggleWhatsappKnowledge(id, active);
    refreshAssistant();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteKnowledgeAction(id: string): Promise<AssistantActionState> {
  const denied = await requireKnowledgePermission();
  if (denied) return { error: denied };
  try {
    await deleteWhatsappKnowledge(id);
    refreshAssistant();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveContactAction(
  _previous: AssistantActionState,
  formData: FormData
): Promise<AssistantActionState> {
  const denied = await requireAssistantPermission();
  if (denied) return { error: denied };

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  if (!isValidPhone(phoneRaw)) return { error: "Ingresá un teléfono válido." };
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (name.length > 100) return { error: "El nombre no puede superar 100 caracteres." };
  if (notes.length > 1000) return { error: "Las notas no pueden superar 1000 caracteres." };

  try {
    await saveWhatsappContact({
      id: String(formData.get("id") ?? "").trim() || undefined,
      leadId: String(formData.get("leadId") ?? "").trim() || undefined,
      phone: normalizePhone(phoneRaw),
      name,
      notes,
      assistantPaused: formData.get("assistantPaused") === "on",
    });
    refreshAssistant();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setAssistantEnabledAction(enabled: boolean): Promise<AssistantActionState> {
  const denied = await requireAssistantPermission();
  if (denied) return { error: denied };
  try {
    await setWhatsappAssistantEnabled(enabled);
    refreshAssistant();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
