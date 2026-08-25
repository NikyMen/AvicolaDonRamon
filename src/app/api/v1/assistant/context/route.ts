import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { handleError, ok } from "@/lib/api/respond";
import { MIN_ENVIO_TOTAL } from "@/lib/geo";
import { isValidPhone } from "@/lib/phone";
import {
  getDeliverySettings,
  getSuperOferta,
  listOffers,
  listProducts,
} from "@/lib/repo";
import { sucursales } from "@/lib/sucursales";
import {
  getWhatsappAssistantEnabled,
  listWhatsappKnowledge,
  touchWhatsappContact,
} from "@/lib/whatsapp-assistant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const inputSchema = z.object({
  phone: z.string().trim().min(1).refine(isValidPhone, "Teléfono inválido."),
  name: z.string().trim().max(100).optional(),
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
    const [contact, enabled, knowledge, products, offers, superOferta, delivery] =
      await Promise.all([
        touchWhatsappContact(input.phone, input.name),
        getWhatsappAssistantEnabled(),
        listWhatsappKnowledge({ activeOnly: true }),
        listProducts(),
        listOffers(),
        getSuperOferta(),
        getDeliverySettings(),
      ]);

    return ok({
      assistant: {
        enabled,
        pausedForPhone: contact.assistantPaused,
        shouldReply: enabled && !contact.assistantPaused,
      },
      contact: {
        id: contact.id,
        phone: contact.phone,
        name: contact.name,
        lastSeenAt: contact.lastSeenAt,
      },
      knowledge: knowledge.map(({ id, title, category, content, tags, updatedAt }) => ({
        id,
        title,
        category,
        content,
        tags,
        updatedAt,
      })),
      business: {
        products,
        offers,
        superOffer: superOferta.active ? superOferta : null,
        branches: sucursales.map(({ id, name, address, phone }) => ({
          id,
          name,
          address,
          phone,
        })),
        delivery: {
          onlyHomeDelivery: true,
          minimumOrder: MIN_ENVIO_TOTAL,
          slots: ["08-12", "17-20"],
          pricePerKm: delivery.pricePerKm,
          freeAllSlots: delivery.freeAllSlots,
          freeSaturday: delivery.freeSaturday,
          originBranchId: delivery.fixedSucursalId,
        },
        checkout: {
          ordersAreClosedOnWebsite: true,
          whatsappIsForQuestionsAndSupport: true,
        },
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
