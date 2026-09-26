/**
 * Condición comercial del contacto en Kommo (datos puros, sin `server-only`).
 *
 * Kommo guarda el campo "Condición comercial" en el contacto con las opciones
 * de abajo. Solo "Cuenta corriente" cambia el comportamiento: el asistente
 * responde con la lista mayorista en lugar del catálogo minorista.
 */

export const CUENTA_CORRIENTE = "Cuenta corriente";
export const SIN_DEFINIR = "Sin definir";

export const COMMERCIAL_CONDITIONS = [
  SIN_DEFINIR,
  "Contado efectivo",
  "Transferencia",
  "Debito",
  "QR",
  CUENTA_CORRIENTE,
] as const;

function searchable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve la etiqueta canónica si coincide con una opción conocida. */
export function normalizeCommercialCondition(value: unknown): string | undefined {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return undefined;
  const key = searchable(raw);
  return COMMERCIAL_CONDITIONS.find((option) => searchable(option) === key) ?? raw.slice(0, 100);
}

export function isCuentaCorriente(value: string | null | undefined): boolean {
  return !!value && searchable(value) === searchable(CUENTA_CORRIENTE);
}

export function isCommercialConditionFieldName(name: string | null | undefined): boolean {
  return !!name && searchable(name) === "condicion comercial";
}

/**
 * Decide qué hacer con la condición que n8n leyó de Kommo en un mensaje.
 *
 * Kommo suele crear un contacto nuevo (vacío) por cada chat o lead, así que el
 * mismo teléfono puede tener varios contactos. La web guarda la última
 * condición elegida para ese teléfono:
 * - Si el mensaje viene del contacto vinculado, manda Kommo.
 * - Si viene de otro contacto de Kommo, la web conserva su condición y se la
 *   copia a ese contacto (así un duplicado no saca a nadie de cuenta corriente).
 */
export function reconcileCommercialCondition(input: {
  stored?: { commercialCondition?: string | null; kommoContactId?: string | null } | null;
  reportedContactId?: string;
  reportedCondition?: string;
  /** true si n8n pudo leer el contacto de Kommo (campo vacío = sin valor). */
  reportedKnown: boolean;
}): { save?: string; pushToKommo?: string } {
  const reported = normalizeCommercialCondition(input.reportedCondition);
  // Kommo no respondió: no hay nada confiable para comparar.
  if (!reported && !input.reportedKnown) return {};

  const storedCondition = input.stored?.commercialCondition || undefined;
  if (!storedCondition) return { save: reported };

  const sameContact =
    !input.reportedContactId || input.reportedContactId === input.stored?.kommoContactId;
  if (sameContact) return { save: reported ?? SIN_DEFINIR };

  if ((reported ?? SIN_DEFINIR) === storedCondition) return {};
  return { pushToKommo: storedCondition };
}

export interface KommoContactConditionUpdate {
  kommoContactId: string;
  phones: string[];
  commercialCondition: string;
}

type FormTree = { [key: string]: FormTree | string };

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Convierte `contacts[update][0][id]=1` en objetos anidados. */
function parseBracketForm(entries: Iterable<[string, string]>): FormTree {
  const root: FormTree = Object.create(null);
  for (const [rawKey, value] of entries) {
    const parts = rawKey.replace(/\]/g, "").split("[");
    if (parts.some((part) => UNSAFE_KEYS.has(part))) continue;
    let node = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        node[part] = value;
        return;
      }
      if (typeof node[part] !== "object") node[part] = Object.create(null);
      node = node[part] as FormTree;
    });
  }
  return root;
}

function children(value: FormTree | string | undefined): (FormTree | string)[] {
  return value && typeof value === "object" ? Object.values(value) : [];
}

function text(value: FormTree | string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Lee el webhook de contactos de Kommo (formulario `x-www-form-urlencoded`).
 * Solo devuelve los contactos que traen el campo "Condición comercial": si el
 * campo no viene no se asume ningún valor, para no pisar la condición local.
 */
export function parseKommoContactWebhook(
  entries: Iterable<[string, string]>,
  options: { fieldId?: string } = {}
): KommoContactConditionUpdate[] {
  const tree = parseBracketForm(entries);
  const contacts = tree.contacts;
  if (!contacts || typeof contacts !== "object") return [];

  const updates: KommoContactConditionUpdate[] = [];
  for (const action of ["add", "update"]) {
    for (const contact of children(contacts[action])) {
      if (typeof contact !== "object") continue;
      const kommoContactId = text(contact.id);
      if (!kommoContactId) continue;

      const phones: string[] = [];
      let commercialCondition: string | undefined;
      for (const field of children(contact.custom_fields)) {
        if (typeof field !== "object") continue;
        const values = children(field.values)
          .map((item) => (typeof item === "string" ? item.trim() : text(item.value)))
          .filter(Boolean);
        if (text(field.code).toUpperCase() === "PHONE") phones.push(...values);
        const matches = options.fieldId
          ? text(field.id) === options.fieldId
          : isCommercialConditionFieldName(text(field.name));
        if (matches) commercialCondition = normalizeCommercialCondition(values[0]) ?? SIN_DEFINIR;
      }

      if (commercialCondition) updates.push({ kommoContactId, phones, commercialCondition });
    }
  }
  return updates;
}
