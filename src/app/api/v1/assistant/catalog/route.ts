import { handleError, ok } from "@/lib/api/respond";
import { FLAT_DELIVERY_FEE, MIN_ENVIO_TOTAL } from "@/lib/geo";
import { getSuperOferta, listOffers, listProducts } from "@/lib/repo";
import { sucursales } from "@/lib/sucursales";
import { getWhatsappAssistantEnabled } from "@/lib/whatsapp-assistant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Contexto comercial de solo lectura. Expone únicamente información que ya
 * es pública en la tienda; no registra contactos ni devuelve notas internas.
 */
export async function GET() {
  try {
    const [enabled, products, offers, superOferta] = await Promise.all([
      getWhatsappAssistantEnabled(),
      listProducts(),
      listOffers(),
      getSuperOferta(),
    ]);

    return ok({
      assistant: { enabled },
      business: {
        products,
        offers,
        superOffer: superOferta.active ? superOferta : null,
        branches: sucursales.map(({ id, name, address }) => ({
          id,
          name,
          address,
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
