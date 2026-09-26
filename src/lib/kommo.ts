import "server-only";

import { isCommercialConditionFieldName, normalizeCommercialCondition } from "./commercial-condition";
import { normalizePhone } from "./phone";

/**
 * Cliente mínimo de la API v4 de Kommo para sincronizar el campo
 * "Condición comercial" del contacto. Usa un token de larga duración
 * (el mismo que la credencial "AvicolaDonRamonKommo" de n8n).
 *
 * Trabaja solo con contactos: no crea leads ni depende del embudo, así que
 * cambiar de embudo o de número de WhatsApp no afecta la sincronización.
 */

const TIMEOUT_MS = 8000;
const FIELD_CACHE_MS = 10 * 60 * 1000;
const KOMMO_ID = /^\d+$/;

export class KommoError extends Error {}

interface KommoField {
  id: number;
  name: string;
  enums?: { id: number; value: string }[] | null;
}

interface KommoContact {
  id: number;
  custom_fields_values?: { field_code?: string | null; values?: { value?: unknown }[] }[] | null;
}

function kommoConfig() {
  const baseUrl = process.env.KOMMO_BASE_URL?.trim().replace(/\/+$/, "");
  // Acepta el valor copiado del header de n8n ("Bearer <token>") o solo el token.
  const token = process.env.KOMMO_ACCESS_TOKEN?.trim().replace(/^bearer\s+/i, "");
  return baseUrl && token ? { baseUrl, token } : null;
}

export function isKommoConfigured(): boolean {
  return kommoConfig() !== null;
}

async function kommoRequest<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const config = kommoConfig();
  if (!config) {
    throw new KommoError("Falta configurar KOMMO_BASE_URL y KOMMO_ACCESS_TOKEN en el servidor.");
  }
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new KommoError("No se pudo conectar con Kommo.");
  }
  // Kommo responde 204 (o 404 en lecturas) cuando la entidad o la lista no existen.
  if (response.status === 204) return null;
  if (response.status === 404 && (init.method ?? "GET") === "GET") return null;
  if (response.status === 401) throw new KommoError("Kommo rechazó el token (KOMMO_ACCESS_TOKEN).");
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new KommoError(`Kommo respondió HTTP ${response.status}.${detail ? ` ${detail}` : ""}`);
  }
  return (await response.json()) as T;
}

let fieldCache: { at: number; field: KommoField } | null = null;

async function commercialConditionField(): Promise<KommoField> {
  if (fieldCache && Date.now() - fieldCache.at < FIELD_CACHE_MS) return fieldCache.field;

  const configuredId = process.env.KOMMO_COMMERCIAL_CONDITION_FIELD_ID?.trim();
  let field: KommoField | undefined;
  if (configuredId) {
    field = (await kommoRequest<KommoField>(`/api/v4/contacts/custom_fields/${encodeURIComponent(configuredId)}`)) ?? undefined;
  } else {
    for (let page = 1; page <= 10 && !field; page++) {
      const result = await kommoRequest<{
        _embedded?: { custom_fields?: KommoField[] };
        _links?: { next?: unknown };
      }>(`/api/v4/contacts/custom_fields?limit=250&page=${page}`);
      field = result?._embedded?.custom_fields?.find((item) => isCommercialConditionFieldName(item.name));
      if (!result?._links?.next) break;
    }
  }
  if (!field) throw new KommoError('No se encontró el campo "Condición comercial" en los contactos de Kommo.');
  fieldCache = { at: Date.now(), field };
  return field;
}

/** Contacto principal del lead (dueño del campo "Condición comercial"). */
export async function findKommoContactIdForLead(leadId: string): Promise<string | undefined> {
  if (!KOMMO_ID.test(leadId)) return undefined;
  const lead = await kommoRequest<{
    _embedded?: { contacts?: { id: number; is_main?: boolean }[] };
  }>(`/api/v4/leads/${leadId}?with=contacts`);
  const contacts = lead?._embedded?.contacts ?? [];
  const main = contacts.find((contact) => contact.is_main) ?? contacts[0];
  return main ? String(main.id) : undefined;
}

async function kommoContactExists(kommoContactId: string): Promise<boolean> {
  if (!KOMMO_ID.test(kommoContactId)) return false;
  return (await kommoRequest<KommoContact>(`/api/v4/contacts/${kommoContactId}`)) !== null;
}

/**
 * Todos los contactos de Kommo con ese teléfono, del más nuevo al más viejo.
 * Kommo suele crear un contacto por chat o lead, así que puede haber varios.
 */
export async function findKommoContactIdsByPhone(phone: string): Promise<string[]> {
  const national = normalizePhone(phone);
  if (!national) return [];
  const result = await kommoRequest<{ _embedded?: { contacts?: KommoContact[] } }>(
    `/api/v4/contacts?limit=50&query=${encodeURIComponent(national)}`
  );
  return (result?._embedded?.contacts ?? [])
    .filter((contact) =>
      (contact.custom_fields_values ?? []).some(
        (field) =>
          field.field_code === "PHONE" &&
          (field.values ?? []).some((item) => normalizePhone(String(item.value ?? "")) === national)
      )
    )
    .sort((a, b) => b.id - a.id)
    .map((contact) => String(contact.id));
}

/** Crea solo el contacto (sin lead ni embudo), con el teléfono en formato de WhatsApp. */
async function createKommoContact(input: { name?: string; phone: string }): Promise<string> {
  const national = normalizePhone(input.phone);
  const international = national.length === 10 ? `+549${national}` : `+${national}`;
  const result = await kommoRequest<{ _embedded?: { contacts?: { id: number }[] } }>("/api/v4/contacts", {
    method: "POST",
    body: JSON.stringify([
      {
        name: input.name?.trim() || `WhatsApp ${international}`,
        custom_fields_values: [{ field_code: "PHONE", values: [{ value: international, enum_code: "MOB" }] }],
      },
    ]),
  });
  const id = result?._embedded?.contacts?.[0]?.id;
  if (!id) throw new KommoError("Kommo no devolvió el contacto creado.");
  return String(id);
}

/**
 * Aplica la condición a todos los contactos de Kommo de ese teléfono y
 * devuelve el principal (el vinculado, el del lead o el más nuevo). Con
 * `createIfMissing` crea el contacto si el teléfono todavía no existe en Kommo.
 */
export async function applyKommoCommercialCondition(
  contact: { kommoContactId?: string; leadId?: string; phone: string; name?: string },
  condition: string,
  options: { createIfMissing: boolean }
): Promise<string | undefined> {
  let primary =
    contact.kommoContactId && (await kommoContactExists(contact.kommoContactId))
      ? contact.kommoContactId
      : undefined;
  if (!primary && contact.leadId) primary = await findKommoContactIdForLead(contact.leadId);
  const samePhone = await findKommoContactIdsByPhone(contact.phone);
  primary ??= samePhone[0];
  if (!primary && options.createIfMissing) primary = await createKommoContact(contact);
  if (!primary) return undefined;
  await setKommoCommercialCondition([primary, ...samePhone], condition);
  return primary;
}

export async function setKommoCommercialCondition(
  kommoContactIds: string | string[],
  condition: string
): Promise<void> {
  const ids = [...new Set(Array.isArray(kommoContactIds) ? kommoContactIds : [kommoContactIds])];
  if (ids.length === 0 || ids.some((id) => !KOMMO_ID.test(id))) {
    throw new KommoError("ID de contacto de Kommo inválido.");
  }
  const field = await commercialConditionField();
  const target = normalizeCommercialCondition(condition);
  const option = field.enums?.find((item) => normalizeCommercialCondition(item.value) === target);
  if (field.enums?.length && !option) {
    throw new KommoError(`La opción "${condition}" no existe en el campo "Condición comercial" de Kommo.`);
  }
  const values = [option ? { enum_id: option.id } : { value: condition }];
  await kommoRequest("/api/v4/contacts", {
    method: "PATCH",
    body: JSON.stringify(
      ids.map((id) => ({ id: Number(id), custom_fields_values: [{ field_id: field.id, values }] }))
    ),
  });
}
