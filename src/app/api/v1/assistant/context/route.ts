import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { handleError, ok } from "@/lib/api/respond";
import {
  isCuentaCorriente,
  normalizeCommercialCondition,
  SIN_DEFINIR,
} from "@/lib/commercial-condition";
import { FLAT_DELIVERY_FEE, MIN_ENVIO_TOTAL } from "@/lib/geo";
import { isValidPhone } from "@/lib/phone";
import { getSuperOferta, listOffers, listProducts } from "@/lib/repo";
import { sucursales } from "@/lib/sucursales";
import {
  getWhatsappAssistantEnabled,
  listWhatsappKnowledge,
  selectRelevantWhatsappKnowledge,
  touchWhatsappContact,
  recordWhatsappInteraction,
  selectRelevantWhatsappProducts,
} from "@/lib/whatsapp-assistant";
import { isWholesaleInStock, listWholesaleProducts } from "@/lib/wholesale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const inputSchema = z.object({
  phone: z.string().trim().min(1).refine(isValidPhone, "Teléfono inválido."),
  leadId: z.string().trim().max(100).optional(),
  name: z.string().trim().max(100).optional(),
  message: z.string().trim().max(4000).optional(),
  // Datos del contacto de Kommo que n8n ya lee en "Preparar contexto".
  contactId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      const id = value === undefined ? "" : String(value).trim();
      return /^\d+$/.test(id) ? id : undefined;
    }),
  commercialCondition: z.string().trim().max(100).optional(),
  // true cuando n8n pudo leer el contacto: un campo vacío equivale a "Sin
  // definir". Si la lectura falló no se toca la condición guardada.
  commercialConditionKnown: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

const WHOLESALE_INSTRUCTION =
  "Cliente en cuenta corriente: usá únicamente los precios de la lista mayorista de business.products. " +
  "No ofrezcas ofertas ni la lista de precios minorista. Si el producto no figura en la lista mayorista, derivá a una persona.";

/**
 * Punto único para que n8n consulte si debe responder y obtenga contexto seguro.
 * Registra el contacto, pero nunca guarda mensajes ni expone notas internas.
 */
export async function POST(req: NextRequest) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  try {
    const input = inputSchema.parse(await req.json());
    const reportedCondition =
      normalizeCommercialCondition(input.commercialCondition)
      ?? (input.commercialConditionKnown ? SIN_DEFINIR : undefined);
    const [contact, enabled, knowledge] = await Promise.all([
      touchWhatsappContact(input.phone, input.name, input.leadId, {
        kommoContactId: input.contactId,
        commercialCondition: reportedCondition,
      }),
      getWhatsappAssistantEnabled(),
      listWhatsappKnowledge({ activeOnly: true }),
    ]);

    // Cuenta corriente: la lista mayorista reemplaza al catálogo minorista y
    // sus promociones, para que el asistente nunca mezcle precios.
    const cuentaCorriente = isCuentaCorriente(contact.commercialCondition);
    const [products, offers, superOferta] = cuentaCorriente
      ? [
          (await listWholesaleProducts({ availableOnly: true })).map((product) => ({
            id: product.id,
            code: product.code ?? null,
            name: product.name,
            description: product.description,
            category: product.category,
            price: product.price,
            stock: product.stock,
            available: product.available,
            inStock: isWholesaleInStock(product),
            priceList: "mayorista" as const,
          })),
          [],
          null,
        ]
      : await Promise.all([listProducts(), listOffers(), getSuperOferta()]);

    const relevantKnowledge = selectRelevantWhatsappKnowledge(knowledge, input.message ?? "");
    const relevantProducts = selectRelevantWhatsappProducts<(typeof products)[number]>(products, input.message ?? "");
    await recordWhatsappInteraction({ contactId: contact.id, leadId: contact.leadId, phone: contact.phone, message: input.message });

    return ok({
      assistant: {
        enabled,
        pausedForPhone: contact.assistantPaused,
        shouldReply: enabled && !contact.assistantPaused,
      },
      flowScope: { type: "whatsapp_flow", leadId: contact.leadId, chatPhone: contact.phone, instruction: "Usá únicamente el contexto y la conversación de este chat; no mezcles datos de otros contactos." },
      contact: {
        id: contact.id,
        leadId: contact.leadId,
        kommoContactId: contact.kommoContactId,
        phone: contact.phone,
        name: contact.name,
        commercialCondition: contact.commercialCondition ?? null,
        cuentaCorriente,
        lastSeenAt: contact.lastSeenAt,
      },
      pricing: {
        priceList: cuentaCorriente ? "mayorista" : "minorista",
        commercialCondition: contact.commercialCondition ?? null,
        instruction: cuentaCorriente ? WHOLESALE_INSTRUCTION : null,
      },
      knowledge: relevantKnowledge.map(({ id, title, category, content, tags, updatedAt }) => ({
        id,
        title,
        category,
        content,
        tags,
        updatedAt,
      })),
      knowledgeMeta: {
        active: knowledge.length,
        selected: relevantKnowledge.length,
      },
      business: {
        priceList: cuentaCorriente ? "mayorista" : "minorista",
        products: relevantProducts,
        productsMeta: {
          priceList: cuentaCorriente ? "mayorista" : "minorista",
          total: products.length,
          selected: relevantProducts.length,
          filtered: relevantProducts.length < products.length,
        },
        offers,
        superOffer: superOferta?.active ? superOferta : null,
        branches: sucursales.map(({ id, name, address, phone }) => ({
          id,
          name,
          address,
          phone,
          hours: {
            weekdays: "08:00 a 13:00 y 16:30 a 20:30",
            saturday: "08:00 a 13:00",
            winterAfternoon: "17:00 a 20:00",
            sunday: "09:30 a 13:00",
            pickup: "Dentro del horario de atención al público",
            whatsapp: "Dentro del horario de atención al público",
          },
        })),
        delivery: {
          onlyHomeDelivery: false,
          minimumOrder: MIN_ENVIO_TOTAL,
          coverage: "Todas las zonas",
          pricing: "flat",
          flatFee: FLAT_DELIVERY_FEE,
          originBranchId: sucursales[0]?.id ?? null,
          orderCutoffs: {
            coloniaAvellaneda: "Solicitar idealmente antes de las 08:00 (como máximo 08:30); luego puede pasar al día siguiente.",
            sanBenito: "Solicitar idealmente antes de las 08:00 (como máximo 08:30); luego puede pasar al día siguiente.",
          },
        },
        checkout: {
          ordersAreClosedOnWebsite: true,
          whatsappIsForQuestionsAndSupport: true,
          storeUrl: process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || null,
        },
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
