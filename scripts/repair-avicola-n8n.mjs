import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const WORKFLOW_ID = "JNWCvr3ySNm6YqC7";
const KOMMO_BASE = "https://contactoavicoladonramoncomar.kommo.com";
const KOMMO_CREDENTIAL = {
  httpHeaderAuth: {
    id: "4qOglB9rbGyOcxeW",
    name: "AvicolaDonRamonKommo",
  },
};

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

function apiRoot(url) {
  const clean = url.replace(/\/$/, "");
  return clean.endsWith("/api/v1") ? clean : `${clean}/api/v1`;
}

function node({ id, name, type, typeVersion, position, parameters, credentials, onError }) {
  return {
    id,
    name,
    type,
    typeVersion,
    position,
    parameters,
    ...(credentials ? { credentials } : {}),
    ...(onError ? { onError } : {}),
  };
}

function httpNode({ id, name, position, method = "GET", url, body, headers, credentials, onError = "continueRegularOutput" }) {
  return node({
    id,
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.3,
    position,
    parameters: {
      ...(method !== "GET" ? { method } : {}),
      url,
      ...(headers
        ? {
            sendHeaders: true,
            headerParameters: { parameters: headers },
          }
        : {}),
      ...(body
        ? {
            sendBody: true,
            specifyBody: "json",
            jsonBody: body,
          }
        : {}),
      options: { timeout: 8000 },
    },
    credentials: credentials ?? (url.includes("kommo.com") ? KOMMO_CREDENTIAL : undefined),
    onError,
  });
}

function codeNode(id, name, position, jsCode) {
  return node({
    id,
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    parameters: { jsCode },
  });
}

function ifNode(id, name, position, leftValue) {
  return node({
    id,
    name,
    type: "n8n-nodes-base.if",
    typeVersion: 2.3,
    position,
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: "",
          typeValidation: "strict",
          version: 3,
        },
        conditions: [
          {
            id: randomUUID(),
            leftValue,
            rightValue: true,
            operator: { type: "boolean", operation: "true", singleValue: true },
          },
        ],
        combinator: "and",
      },
      options: {},
    },
  });
}

const ids = {
  validLead: "2a0379ad-1791-4aca-9aa8-efda7c7d1001",
  lead: "2a0379ad-1791-4aca-9aa8-efda7c7d1002",
  resolveContact: "2a0379ad-1791-4aca-9aa8-efda7c7d1003",
  contact: "2a0379ad-1791-4aca-9aa8-efda7c7d1004",
  prepareContext: "2a0379ad-1791-4aca-9aa8-efda7c7d1005",
  webContext: "2a0379ad-1791-4aca-9aa8-efda7c7d1006",
  shouldReply: "2a0379ad-1791-4aca-9aa8-efda7c7d1007",
  aiInput: "2a0379ad-1791-4aca-9aa8-efda7c7d1008",
  parse: "2a0379ad-1791-4aca-9aa8-efda7c7d1009",
  pipelines: "2a0379ad-1791-4aca-9aa8-efda7c7d1010",
  stage: "2a0379ad-1791-4aca-9aa8-efda7c7d1011",
  hasStage: "2a0379ad-1791-4aca-9aa8-efda7c7d1012",
  move: "2a0379ad-1791-4aca-9aa8-efda7c7d1013",
  fields: "2a0379ad-1791-4aca-9aa8-efda7c7d1014",
  responseField: "2a0379ad-1791-4aca-9aa8-efda7c7d1015",
  hasResponseField: "2a0379ad-1791-4aca-9aa8-efda7c7d1016",
  bots: "2a0379ad-1791-4aca-9aa8-efda7c7d1017",
  selectBot: "2a0379ad-1791-4aca-9aa8-efda7c7d1018",
  hasBot: "2a0379ad-1791-4aca-9aa8-efda7c7d1019",
};

const managedNames = new Set([
  "Lead valido Don Ramon",
  "Buscar lead Don Ramon",
  "Resolver contacto Don Ramon",
  "Buscar contacto Don Ramon",
  "Preparar contexto Don Ramon",
  "Contexto web Don Ramon",
  "Responder Don Ramon",
  "Preparar entrada IA Don Ramon",
  "Parsear respuesta IA Don Ramon",
  "Buscar pipelines Don Ramon",
  "Decidir etapa Don Ramon",
  "Mover etapa Don Ramon",
  "Mover lead Don Ramon",
  "Buscar campos Don Ramon",
  "Validar campo respuesta Don Ramon",
  "Campo respuesta disponible Don Ramon",
  "Buscar Salesbots Don Ramon",
  "Elegir Salesbot Don Ramon",
  "Salesbot disponible Don Ramon",
]);

const dedupCode = `// Normaliza variantes del webhook de Kommo y descarta duplicados durante 24 h.
const item = $input.first();
const root = item.json ?? {};
const body = root.body ?? root;
const flat = (key) => body?.[key] ?? root?.[key];
const first = (value) => Array.isArray(value) ? value[0] : value;
const nested = first(body?.message?.add) ?? first(body?.message) ?? first(body?.messages) ?? {};
const content = nested?.message && typeof nested.message === 'object' ? nested.message : nested;
const pick = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

const normalized = {
  messageId: pick(flat('message[add][0][id]'), content?.id, nested?.id, nested?.message_id),
  leadId: pick(flat('message[add][0][element_id]'), flat('message[add][0][entity_id]'), nested?.element_id, nested?.entity_id, nested?.lead_id),
  contactId: pick(flat('message[add][0][contact_id]'), nested?.contact_id, nested?.author?.id),
  phone: pick(flat('message[add][0][author][phone]'), flat('message[add][0][phone]'), nested?.author?.phone, nested?.sender?.phone, nested?.phone),
  text: pick(flat('message[add][0][text]'), content?.text, nested?.text, body?.text) ?? '',
  type: pick(flat('message[add][0][type]'), nested?.type === 'incoming' || nested?.type === 'outgoing' ? nested.type : undefined, body?.type, 'incoming'),
  messageType: pick(flat('message[add][0][message_type]'), flat('message[add][0][attachment][type]'), nested?.message_type, nested?.attachment?.type, content?.type, 'text'),
  mediaUrl: pick(flat('message[add][0][attachment][link]'), flat('message[add][0][media]'), nested?.attachment?.link, content?.media, nested?.media) ?? '',
  fileName: pick(flat('message[add][0][attachment][file_name]'), flat('message[add][0][file_name]'), nested?.attachment?.file_name, content?.file_name, nested?.file_name) ?? '',
  authorName: pick(flat('message[add][0][author][name]'), nested?.author?.name, nested?.author_name) ?? '',
  createdAt: pick(flat('message[add][0][created_at]'), nested?.created_at, body?.created_at) ?? '',
};

for (const key of ['leadId', 'contactId', 'phone', 'text', 'mediaUrl', 'fileName']) {
  normalized[key] = String(normalized[key] ?? '').trim();
}
normalized.type = String(normalized.type ?? '').toLowerCase();
normalized.messageType = String(normalized.messageType ?? 'text').toLowerCase();

const fingerprint = normalized.messageId
  ? 'id:' + normalized.messageId
  : [normalized.leadId, normalized.contactId, normalized.text, normalized.createdAt].filter(Boolean).join('|');
const now = Date.now();
const ttlMs = 24 * 60 * 60 * 1000;
const store = $getWorkflowStaticData('global');
if (!store.seenMessages || typeof store.seenMessages !== 'object') store.seenMessages = {};
for (const [key, timestamp] of Object.entries(store.seenMessages)) {
  if (!Number.isFinite(timestamp) || now - timestamp > ttlMs) delete store.seenMessages[key];
}
if (fingerprint && store.seenMessages[fingerprint]) return [];
if (fingerprint) store.seenMessages[fingerprint] = now;
const entries = Object.entries(store.seenMessages);
if (entries.length > 2000) {
  entries.sort((a, b) => a[1] - b[1]).slice(0, entries.length - 2000).forEach(([key]) => delete store.seenMessages[key]);
}
normalized.receivedAtMs = now;
item.json._normalized = normalized;
return [item];`;

const resolveContactCode = `const base = $('Edit Fields').first().json;
const leadResponse = $input.first().json ?? {};
const lead = leadResponse.data ?? leadResponse;
const embeddedContacts = lead?._embedded?.contacts ?? [];
const contactId = base.contactId || embeddedContacts[0]?.id || '';
return [{ json: { ...base, contactId: String(contactId || ''), currentLead: lead?.id ? lead : null } }];`;

const prepareContextCode = `const base = $('Resolver contacto Don Ramon').first().json;
const response = $input.first().json ?? {};
const contact = response.data ?? response;
const fields = Array.isArray(contact?.custom_fields_values) ? contact.custom_fields_values : [];
const phoneField = fields.find((field) => field?.field_code === 'PHONE' || /tel[eé]fono|phone/i.test(String(field?.field_name ?? '')));
const rawPhone = base.phone || phoneField?.values?.[0]?.value || '';
const phone = String(rawPhone).replace(/\D/g, '');
return [{ json: {
  ...base,
  phone,
  name: base.name || contact?.name || '',
  sessionId: 'lead:' + base.leadId,
  currentLead: base.currentLead,
} }];`;

const prepareAiCode = `const base = $('Preparar contexto Don Ramon').first().json;
const response = $input.first().json ?? {};
const context = response.data ?? null;
const business = context?.business ?? null;
const storeUrl = business?.checkout?.storeUrl ?? '';
const currentLead = base.currentLead ?? null;
const aiInput = {
  message: base.text,
  store_url: storeUrl,
  business,
  knowledge: Array.isArray(context?.knowledge) ? context.knowledge : [],
  current_lead_stage: currentLead ? {
    pipeline_id: currentLead.pipeline_id ?? null,
    status_id: currentLead.status_id ?? null,
  } : null,
  context_available: Boolean(business),
};
return [{ json: { ...base, contextAvailable: Boolean(business), business, storeUrl, aiInput: JSON.stringify(aiInput) } }];`;

const parseAiCode = `const base = $('Preparar entrada IA Don Ramon').first().json;
const raw = String($input.first().json.output ?? $input.first().json.text ?? '').trim();
const allowedIntents = new Set(['GREETING','CATALOG','PROMOS','PRICE','ORDER','DELIVERY','LOCATION','HOURS','PAYMENT','ORDER_STATUS','CANCELLATION','HUMAN','THANKS','OTHER']);
const allowedEvents = new Set(['NONE','COMMERCIAL_INTEREST','CHECKOUT_SENT','HUMAN_REQUIRED','CANCELLATION_REQUESTED']);
const fallback = {
  intent: 'OTHER', greeting: false, needs_human: true, crm_event: 'HUMAN_REQUIRED', requested_items: [],
  reply: 'No pude verificar la información en este momento. Te paso con una persona del equipo 🙌', confidence: 0,
};
let parsed;
try {
  parsed = JSON.parse(raw.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, ''));
} catch { parsed = fallback; }
const result = {
  intent: allowedIntents.has(parsed?.intent) ? parsed.intent : fallback.intent,
  greeting: parsed?.greeting === true,
  needs_human: parsed?.needs_human === true,
  crm_event: allowedEvents.has(parsed?.crm_event) ? parsed.crm_event : fallback.crm_event,
  requested_items: Array.isArray(parsed?.requested_items) ? parsed.requested_items.map((item) => ({
    product_id: item?.product_id == null ? null : String(item.product_id),
    product_name: String(item?.product_name ?? '').trim(),
    quantity: Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : null,
  })).filter((item) => item.product_name) : [],
  reply: typeof parsed?.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : fallback.reply,
  confidence: Number.isFinite(Number(parsed?.confidence)) ? Math.min(1, Math.max(0, Number(parsed.confidence))) : 0,
};
if (!base.contextAvailable && ['CATALOG','PROMOS','PRICE','ORDER'].includes(result.intent)) {
  result.needs_human = true;
  result.crm_event = 'HUMAN_REQUIRED';
  result.reply = fallback.reply;
  result.confidence = Math.min(result.confidence, 0.5);
}
return [{ json: { ...base, ...result } }];`;

const decideStageCode = `const base = $('Parsear respuesta IA Don Ramon').first().json;
const response = $input.first().json ?? {};
const pipelines = response?._embedded?.pipelines ?? response?.data?._embedded?.pipelines ?? [];
const lead = base.currentLead ?? {};
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const pipeline = pipelines.find((item) => Number(item.id) === Number(lead.pipeline_id));
const statuses = pipeline?._embedded?.statuses ?? [];
const current = statuses.find((item) => Number(item.id) === Number(lead.status_id));
const forbidden = /ganad|perdid|venta confirm|vendid|pedido confirm|entregad|finaliz|closed/;
const candidates = statuses.filter((item) => ![142, 143].includes(Number(item.id)) && !forbidden.test(normalize(item.name)));
const patterns = {
  COMMERCIAL_INTEREST: [/venta potencial/, /interes comercial/, /interes/, /consulta/, /contacto inicial/, /nuevo/],
  CHECKOUT_SENT: [/checkout/, /link enviado/, /pedido web/, /^pedido$/, /presupuesto/],
  HUMAN_REQUIRED: [/atencion personal/, /requiere personal/, /atencion humana/, /humano/, /asesor/, /reclamo/],
  CANCELLATION_REQUESTED: [/atencion personal/, /requiere personal/, /atencion humana/, /humano/, /asesor/, /reclamo/],
};
const eventPatterns = patterns[base.crm_event] ?? [];
let target = null;
for (const pattern of eventPatterns) {
  target = candidates.find((item) => pattern.test(normalize(item.name)));
  if (target) break;
}
const canMoveForward = ['HUMAN_REQUIRED','CANCELLATION_REQUESTED'].includes(base.crm_event)
  || !current || Number(target?.sort ?? 0) >= Number(current?.sort ?? 0);
if (!target || !canMoveForward || [142, 143].includes(Number(lead.status_id)) || Number(target.id) === Number(lead.status_id)) target = null;
return [{ json: {
  ...base,
  targetPipelineId: target ? Number(pipeline.id) : null,
  targetStageId: target ? Number(target.id) : null,
  targetStageName: target?.name ?? null,
} }];`;

const validateFieldCode = `const base = $('Decidir etapa Don Ramon').first().json;
const response = $input.first().json ?? {};
const fields = response?._embedded?.custom_fields ?? response?.data?._embedded?.custom_fields ?? [];
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const expected = fields.find((field) => Number(field.id) === 1637404);
const named = fields.find((field) => /respuesta.*(ia|bot)|respuesta del bot|respuesta/.test(normalize(field.name)) && ['text','textarea'].includes(String(field.type)));
const selected = expected && ['text','textarea'].includes(String(expected.type)) ? expected : named;
return [{ json: { ...base, replyFieldId: selected ? Number(selected.id) : null, replyFieldName: selected?.name ?? null } }];`;

const selectBotCode = `const base = $('Validar campo respuesta Don Ramon').first().json;
const response = $input.first().json ?? {};
const bots = response?._embedded?.bots ?? response?.data?._embedded?.bots ?? [];
const regular = bots.filter((bot) => bot?.type_functionality === 'regular' && bot?.settings?.active !== false);
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const scored = regular.map((bot) => {
  const name = normalize(bot.name);
  let score = 0;
  if (/don ramon|avicola/.test(name)) score += 10;
  if (/whatsapp|respuesta|responder|mensaje/.test(name)) score += 5;
  return { bot, score };
}).sort((a, b) => b.score - a.score);
const selected = scored[0]?.score > 0 ? scored[0].bot : regular.length === 1 ? regular[0] : null;
return [{ json: { ...base, botId: selected ? Number(selected.id) : null, botName: selected?.name ?? null } }];`;

const env = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
if (!env.N8N_API_URL || !env.N8N_API_KEY) throw new Error("Faltan N8N_API_URL o N8N_API_KEY en .env.local");
const avicolaCredentialId = process.env.N8N_AVICOLA_WEB_CREDENTIAL_ID || env.N8N_AVICOLA_WEB_CREDENTIAL_ID;
if (!avicolaCredentialId) throw new Error("Falta N8N_AVICOLA_WEB_CREDENTIAL_ID para autenticar la API web.");
const AVICOLA_WEB_CREDENTIAL = {
  httpHeaderAuth: {
    id: avicolaCredentialId,
    name: "AvicolaDonRamonWebApi",
  },
};
const baseUrl = apiRoot(env.N8N_API_URL);
const headers = { "X-N8N-API-KEY": env.N8N_API_KEY, "Content-Type": "application/json" };
const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${response.status} ${data?.message ?? response.statusText}`);
  return data;
};

const workflow = await request(`/workflows/${WORKFLOW_ID}`);
if (!workflow.active) throw new Error("El workflow esperado no está activo; no se modificó nada.");

const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
await request("/workflows", {
  method: "POST",
  body: JSON.stringify({
    name: `BACKUP Avicola Don Ramon ${timestamp}`,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: {
      executionOrder: workflow.settings?.executionOrder ?? "v1",
      timezone: workflow.settings?.timezone ?? "America/Argentina/Buenos_Aires",
    },
  }),
});

workflow.nodes = workflow.nodes.filter((item) => !managedNames.has(item.name));
const byName = (name) => workflow.nodes.find((item) => item.name === name);
for (const required of ["Dedup mensaje", "Edit Fields", "Es entrante?1", "AI Agent", "Simple Memory1", "Escribir respuesta normal", "Lanzar Salesbot"]) {
  if (!byName(required)) throw new Error(`No se encontró el nodo requerido: ${required}`);
}

const knowledgePromptStart = "[INICIO APRENDIZAJE DON RAMON]";
const knowledgePromptEnd = "[FIN APRENDIZAJE DON RAMON]";
const knowledgePrompt = `${knowledgePromptStart}
BASE DE CONOCIMIENTO Y APRENDIZAJE:
- El campo knowledge contiene información y correcciones revisadas por el administrador.
- Aplicá únicamente las entradas relevantes al mensaje actual.
- Si una entrada contiene "CÓMO DEBERÍA RESPONDER", tratala como una pauta explícita para casos similares.
- Una pauta explícita tiene prioridad sobre el estilo de una conversación de ejemplo.
- El catálogo actual siempre tiene prioridad sobre ejemplos históricos para precios, promociones y stock.
- No copies nombres, teléfonos ni otros datos particulares de conversaciones de ejemplo.
- Si dos pautas se contradicen, preferí la más específica y luego la más reciente según updatedAt.
${knowledgePromptEnd}`;
const agent = byName("AI Agent");
const currentSystemMessage = String(agent.parameters?.options?.systemMessage ?? "");
const withoutOldKnowledgePrompt = currentSystemMessage
  .replace(new RegExp(`${knowledgePromptStart}[\\s\\S]*?${knowledgePromptEnd}`, "g"), "")
  .trim();
agent.parameters.options = {
  ...(agent.parameters.options ?? {}),
  systemMessage: `${withoutOldKnowledgePrompt}\n\n${knowledgePrompt}`,
};

byName("Dedup mensaje").parameters.jsCode = dedupCode;
const assignments = byName("Edit Fields").parameters.assignments.assignments;
for (const field of [
  { id: "donramon-contact-id", name: "contactId", value: "={{ $json._normalized.contactId }}", type: "string" },
  { id: "donramon-phone", name: "phone", value: "={{ $json._normalized.phone }}", type: "string" },
]) {
  const existing = assignments.find((item) => item.name === field.name);
  if (existing) Object.assign(existing, field);
  else assignments.push(field);
}
byName("AI Agent").parameters.text = "={{ $json.aiInput }}";
byName("Simple Memory1").parameters = {
  sessionIdType: "customKey",
  sessionKey: "={{ $json.sessionId }}",
  contextWindowLength: 8,
};
byName("Escribir respuesta normal").parameters = {
  method: "PATCH",
  url: `=${KOMMO_BASE}/api/v4/leads/{{ $('Edit Fields').first().json.leadId }}`,
  authentication: "genericCredentialType",
  genericAuthType: "httpHeaderAuth",
  sendBody: true,
  specifyBody: "json",
  jsonBody: "={{ ({ custom_fields_values: [{ field_id: Number($('Validar campo respuesta Don Ramon').first().json.replyFieldId), values: [{ value: String($('Parsear respuesta IA Don Ramon').first().json.reply).substring(0, 1000) }] }] }) }}",
  options: { timeout: 8000 },
};
byName("Escribir respuesta normal").credentials = KOMMO_CREDENTIAL;
byName("Escribir respuesta normal").onError = "continueRegularOutput";
byName("Lanzar Salesbot").parameters = {
  method: "POST",
  url: `=${KOMMO_BASE}/api/v4/bots/{{ $json.botId }}/run`,
  authentication: "genericCredentialType",
  genericAuthType: "httpHeaderAuth",
  sendBody: true,
  specifyBody: "json",
  jsonBody: "={{ ({ entity_id: Number($('Edit Fields').first().json.leadId), entity_type: 'leads' }) }}",
  options: { timeout: 8000 },
};
byName("Lanzar Salesbot").credentials = KOMMO_CREDENTIAL;
byName("Lanzar Salesbot").onError = "continueRegularOutput";

workflow.nodes.push(
  ifNode(ids.validLead, "Lead valido Don Ramon", [-48, 0], "={{ /^\\d+$/.test(String($json.leadId || '')) }}"),
  httpNode({ id: ids.lead, name: "Buscar lead Don Ramon", position: [160, 0], url: `=${KOMMO_BASE}/api/v4/leads/{{ $('Edit Fields').first().json.leadId }}?with=contacts` }),
  codeNode(ids.resolveContact, "Resolver contacto Don Ramon", [368, 0], resolveContactCode),
  httpNode({ id: ids.contact, name: "Buscar contacto Don Ramon", position: [576, 0], url: `=${KOMMO_BASE}/api/v4/contacts/{{ $json.contactId || 0 }}` }),
  codeNode(ids.prepareContext, "Preparar contexto Don Ramon", [784, 0], prepareContextCode),
  httpNode({
    id: ids.webContext,
    name: "Contexto web Don Ramon",
    position: [992, 0],
    method: "POST",
    url: "https://avicoladonramon.consultoriadigital.io/api/v1/assistant/context",
    body: "={{ ({ phone: $('Preparar contexto Don Ramon').first().json.phone, name: $('Preparar contexto Don Ramon').first().json.name, message: $('Preparar contexto Don Ramon').first().json.text }) }}",
    credentials: AVICOLA_WEB_CREDENTIAL,
  }),
  ifNode(ids.shouldReply, "Responder Don Ramon", [1200, 0], "={{ $json.data?.assistant?.enabled !== false }}"),
  codeNode(ids.aiInput, "Preparar entrada IA Don Ramon", [1408, 0], prepareAiCode),
  codeNode(ids.parse, "Parsear respuesta IA Don Ramon", [1824, 0], parseAiCode),
  httpNode({ id: ids.pipelines, name: "Buscar pipelines Don Ramon", position: [2032, 0], url: `=${KOMMO_BASE}/api/v4/leads/pipelines` }),
  codeNode(ids.stage, "Decidir etapa Don Ramon", [2240, 0], decideStageCode),
  ifNode(ids.hasStage, "Mover etapa Don Ramon", [2448, 0], "={{ Number.isFinite(Number($json.targetStageId)) && Number($json.targetStageId) > 0 }}"),
  httpNode({
    id: ids.move,
    name: "Mover lead Don Ramon",
    position: [2656, -112],
    method: "PATCH",
    url: `=${KOMMO_BASE}/api/v4/leads/{{ $('Edit Fields').first().json.leadId }}`,
    body: "={{ ({ pipeline_id: Number($('Decidir etapa Don Ramon').first().json.targetPipelineId), status_id: Number($('Decidir etapa Don Ramon').first().json.targetStageId) }) }}",
  }),
  httpNode({ id: ids.fields, name: "Buscar campos Don Ramon", position: [2864, 0], url: `=${KOMMO_BASE}/api/v4/leads/custom_fields?limit=250` }),
  codeNode(ids.responseField, "Validar campo respuesta Don Ramon", [3072, 0], validateFieldCode),
  ifNode(ids.hasResponseField, "Campo respuesta disponible Don Ramon", [3280, 0], "={{ Number.isFinite(Number($json.replyFieldId)) && Number($json.replyFieldId) > 0 }}"),
  httpNode({ id: ids.bots, name: "Buscar Salesbots Don Ramon", position: [3696, 0], url: `=${KOMMO_BASE}/api/v4/bots?limit=250&filter[type_functionality][]=regular` }),
  codeNode(ids.selectBot, "Elegir Salesbot Don Ramon", [3904, 0], selectBotCode),
  ifNode(ids.hasBot, "Salesbot disponible Don Ramon", [4112, 0], "={{ Number.isFinite(Number($json.botId)) && Number($json.botId) > 0 }}"),
);

const activeSources = new Set([
  "Webhook1", "Dedup mensaje", "Edit Fields", "Es entrante?1", "AI Agent", "Escribir respuesta normal", "Lanzar Salesbot",
  ...managedNames,
]);
for (const source of activeSources) delete workflow.connections[source];
const main = (name) => ({ node: name, type: "main", index: 0 });
workflow.connections["Webhook1"] = { main: [[main("Dedup mensaje")]] };
workflow.connections["Dedup mensaje"] = { main: [[main("Edit Fields")]] };
workflow.connections["Edit Fields"] = { main: [[main("Es entrante?1")]] };
workflow.connections["Es entrante?1"] = { main: [[main("Lead valido Don Ramon")], []] };
workflow.connections["Lead valido Don Ramon"] = { main: [[main("Buscar lead Don Ramon")], []] };
workflow.connections["Buscar lead Don Ramon"] = { main: [[main("Resolver contacto Don Ramon")]] };
workflow.connections["Resolver contacto Don Ramon"] = { main: [[main("Buscar contacto Don Ramon")]] };
workflow.connections["Buscar contacto Don Ramon"] = { main: [[main("Preparar contexto Don Ramon")]] };
workflow.connections["Preparar contexto Don Ramon"] = { main: [[main("Contexto web Don Ramon")]] };
workflow.connections["Contexto web Don Ramon"] = { main: [[main("Responder Don Ramon")]] };
workflow.connections["Responder Don Ramon"] = { main: [[main("Preparar entrada IA Don Ramon")], []] };
workflow.connections["Preparar entrada IA Don Ramon"] = { main: [[main("AI Agent")]] };
workflow.connections["AI Agent"] = { main: [[main("Parsear respuesta IA Don Ramon")]] };
workflow.connections["Parsear respuesta IA Don Ramon"] = { main: [[main("Buscar pipelines Don Ramon")]] };
workflow.connections["Buscar pipelines Don Ramon"] = { main: [[main("Decidir etapa Don Ramon")]] };
workflow.connections["Decidir etapa Don Ramon"] = { main: [[main("Mover etapa Don Ramon")]] };
workflow.connections["Mover etapa Don Ramon"] = { main: [[main("Mover lead Don Ramon")], [main("Buscar campos Don Ramon")]] };
workflow.connections["Mover lead Don Ramon"] = { main: [[main("Buscar campos Don Ramon")]] };
workflow.connections["Buscar campos Don Ramon"] = { main: [[main("Validar campo respuesta Don Ramon")]] };
workflow.connections["Validar campo respuesta Don Ramon"] = { main: [[main("Campo respuesta disponible Don Ramon")]] };
workflow.connections["Campo respuesta disponible Don Ramon"] = { main: [[main("Escribir respuesta normal")], []] };
workflow.connections["Escribir respuesta normal"] = { main: [[main("Buscar Salesbots Don Ramon")]] };
workflow.connections["Buscar Salesbots Don Ramon"] = { main: [[main("Elegir Salesbot Don Ramon")]] };
workflow.connections["Elegir Salesbot Don Ramon"] = { main: [[main("Salesbot disponible Don Ramon")]] };
workflow.connections["Salesbot disponible Don Ramon"] = { main: [[main("Lanzar Salesbot")], []] };
workflow.connections["Lanzar Salesbot"] = { main: [[]] };

const payload = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: {
    executionOrder: workflow.settings?.executionOrder ?? "v1",
    timezone: workflow.settings?.timezone ?? "America/Argentina/Buenos_Aires",
  },
};
const updated = await request(`/workflows/${WORKFLOW_ID}`, { method: "PUT", body: JSON.stringify(payload) });
console.log(JSON.stringify({ id: updated.id, name: updated.name, active: updated.active, nodes: updated.nodes?.length }, null, 2));
