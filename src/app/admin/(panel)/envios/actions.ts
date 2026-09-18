"use server";

import { revalidatePath } from "next/cache";
import { assertPerm } from "@/lib/auth/permissions";
import { NoDatabaseError, saveDeliverySettings } from "@/lib/repo";

export interface SaveEnviosState {
  ok?: boolean;
  error?: string;
}

export async function saveEnvios(
  _prev: SaveEnviosState,
  formData: FormData
): Promise<SaveEnviosState> {
  const denied = await assertPerm("envios");
  if (denied) return { error: denied };

  const pricingMode = formData.get("pricingMode");
  const flatFee = Number(formData.get("flatFee"));
  if ((pricingMode !== "flat" && pricingMode !== "distance") || !Number.isSafeInteger(flatFee) || flatFee < 0) {
    return { error: "Revisá el modo y el importe fijo de envío." };
  }

  const pricePerKm = Number(formData.get("pricePerKm"));
  if (!Number.isFinite(pricePerKm) || pricePerKm < 0) {
    return { error: "Ingresá un precio por kilometro valido." };
  }

  try {
    await saveDeliverySettings({
      pricingMode,
      flatFee,
      pricePerKm,
      freeAllSlots: formData.get("freeAllSlots") === "on",
      freeSaturday: formData.get("freeSaturday") === "on",
    });
    revalidatePath("/admin/envios");
    return { ok: true };
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    return { error: "No se pudo guardar la configuracion de envios." };
  }
}
