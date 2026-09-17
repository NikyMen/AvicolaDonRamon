import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { handleError, ok } from "@/lib/api/respond";
import { DELIVERY_LOCALITIES, MIN_ENVIO_TOTAL } from "@/lib/geo";
import { isValidPhone } from "@/lib/phone";
import { getDeliverySettings, listSucursales, getSuperOferta, listOffers, listProducts } from "@/lib/repo";
import {
  getWhatsappAssistantEnabled,
  listWhatsappKnowledge,
  selectRelevantWhatsappKnowledge,
  touchWhatsappContact,
  recordWhatsappInteraction,
  selectRelevantWhatsappProducts,
} from "@/lib/whatsapp-assistant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const inputSchema = z.object({
  phone: z.string().trim().min(1).refine(isValidPhone, "Teléfono inválido."),
  leadId: z.string().trim().max(100).optional(),
  name: z.string().trim().max(100).optional(),
  message: z.string().trim().max(4000).optional(),
});

/**
 * Punto único para que n8n consulte si debe responder y obtenga contexto seguro.
 * Registra el contacto, pero nunca guarda mensajes ni expone notas internas.
 */
export async function POST(req: NextRequest) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  try {
    const input = inputSchema.parse(await req.json());
    const [contact, enabled, knowledge, products, offers, superOferta, sucursales, deliverySettings] =
      await Promise.all([
        touchWhatsappContact(input.phone, input.name, input.leadId),
        getWhatsappAssistantEnabled(),
        listWhatsappKnowledge({ activeOnly: true }),
        listProducts(),
        listOffers(),
        getSuperOferta(),
      listSucursales(),
      getDeliverySettings(),
      ]);

    const relevantKnowledge = selectRelevantWhatsappKnowledge(knowledge, input.message ?? "");
    const relevantProducts = selectRelevantWhatsappProducts(products, input.message ?? "");
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
        phone: contact.phone,
        name: contact.name,
        lastSeenAt: contact.lastSeenAt,
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
        products: relevantProducts,
        productsMeta: {
          total: products.length,
          selected: relevantProducts.length,
          filtered: relevantProducts.length < products.length,
        },
        offers,
        superOffer: superOferta.active ? superOferta : null,
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
          coverage: DELIVERY_LOCALITIES.map((locality) => locality.name).join(", "),
          pricing: deliverySettings.pricingMode,
          flatFee: deliverySettings.flatFee,
          pricePerKm: deliverySettings.pricePerKm,
          freeAllSlots: deliverySettings.freeAllSlots,
          freeSaturday: deliverySettings.freeSaturday,
          originBranchId: sucursales.find((branch) => branch.id === deliverySettings.fixedSucursalId)?.id ?? sucursales[0]?.id ?? null,
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
