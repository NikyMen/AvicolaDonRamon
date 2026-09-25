import "server-only";

import { isCommercialConditionFieldName, normalizeCommercialCondition } from "./commercial-condition";

/**
 * Cliente mínimo de la API v4 de Kommo para sincronizar el campo
 * "Condición comercial" del contacto. Usa un token de larga duración
 * (el mismo que la credencial "AvicolaDonRamonKommo" de n8n).
 */

const TIMEOUT_MS = 8000;
const FIELD_CACHE_MS = 10 * 60 * 1000;

export class KommoError extends Error {}

interface KommoField {
  id: number;
  name: string;
  enums?: { id: number; value: string }[] | null;
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
  // Kommo responde 204 cuando la entidad o la lista no existen.
  if (response.status === 204) return null;
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
  if (!/^\d+$/.test(leadId)) return undefined;
  const lead = await kommoRequest<{
    _embedded?: { contacts?: { id: number; is_main?: boolean }[] };
  }>(`/api/v4/leads/${leadId}?with=contacts`);
  const contacts = lead?._embedded?.contacts ?? [];
  const main = contacts.find((contact) => contact.is_main) ?? contacts[0];
  return main ? String(main.id) : undefined;
}

export async function setKommoCommercialCondition(kommoContactId: string, condition: string): Promise<void> {
  if (!/^\d+$/.test(kommoContactId)) throw new KommoError("ID de contacto de Kommo inválido.");
  const field = await commercialConditionField();
  const target = normalizeCommercialCondition(condition);
  const option = field.enums?.find((item) => normalizeCommercialCondition(item.value) === target);
  if (field.enums?.length && !option) {
    throw new KommoError(`La opción "${condition}" no existe en el campo "Condición comercial" de Kommo.`);
  }
  await kommoRequest(`/api/v4/contacts/${kommoContactId}`, {
    method: "PATCH",
    body: JSON.stringify({
      custom_fields_values: [
        { field_id: field.id, values: [option ? { enum_id: option.id } : { value: condition }] },
      ],
    }),
  });
}
