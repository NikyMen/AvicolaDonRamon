import { handleError, ok } from "@/lib/api/respond";
import { DELIVERY_LOCALITIES, MIN_ENVIO_TOTAL } from "@/lib/geo";
import { getDeliverySettings, listSucursales, getSuperOferta, listOffers, listProducts } from "@/lib/repo";
import { getWhatsappAssistantEnabled } from "@/lib/whatsapp-assistant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Contexto comercial de solo lectura. Expone únicamente información que ya
 * es pública en la tienda; no registra contactos ni devuelve notas internas.
 */
export async function GET() {
  try {
    const [enabled, products, offers, superOferta, sucursales, deliverySettings] = await Promise.all([
      getWhatsappAssistantEnabled(),
      listProducts(),
      listOffers(),
      getSuperOferta(),
      listSucursales(),
      getDeliverySettings(),
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
