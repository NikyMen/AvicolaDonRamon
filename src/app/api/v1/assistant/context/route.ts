import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { handleError, ok } from "@/lib/api/respond";
import { FLAT_DELIVERY_FEE, MIN_ENVIO_TOTAL } from "@/lib/geo";
import { isValidPhone } from "@/lib/phone";
import { getSuperOferta, listOffers, listProducts } from "@/lib/repo";
import { sucursales } from "@/lib/sucursales";
import {
  getWhatsappAssistantEnabled,
  listWhatsappKnowledge,
  selectRelevantWhatsappKnowledge,
  touchWhatsappContact,
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
    const [contact, enabled, knowledge, products, offers, superOferta] =
      await Promise.all([
        touchWhatsappContact(input.phone, input.name, input.leadId),
        getWhatsappAssistantEnabled(),
        listWhatsappKnowledge({ activeOnly: true }),
        listProducts(),
        listOffers(),
        getSuperOferta(),
      ]);

    const relevantKnowledge = selectRelevantWhatsappKnowledge(knowledge, input.message ?? "");

    return ok({
      assistant: {
        enabled,
        pausedForPhone: contact.assistantPaused,
        shouldReply: enabled && !contact.assistantPaused,
      },
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
        products,
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
          },
        })),
        delivery: {
          onlyHomeDelivery: true,
          minimumOrder: MIN_ENVIO_TOTAL,
          coverage: "Todas las zonas",
          pricing: "flat",
          flatFee: FLAT_DELIVERY_FEE,
          originBranchId: sucursales[0]?.id ?? null,
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
