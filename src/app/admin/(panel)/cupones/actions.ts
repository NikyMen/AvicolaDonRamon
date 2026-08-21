"use server";

import { revalidatePath } from "next/cache";
import { assertPerm } from "@/lib/auth/permissions";
import { deleteCoupon, saveCoupon, NoDatabaseError } from "@/lib/repo";

export interface CouponActionState { ok?: boolean; error?: string }

export async function saveCouponAction(
  _prev: CouponActionState,
  formData: FormData
): Promise<CouponActionState> {
  const denied = await assertPerm("cupones");
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const rawKind = String(formData.get("kind") ?? "coupon");
  const kind = rawKind === "second_unit" || rawKind === "three_for_two" ? rawKind : "coupon";
  const maxUses = Number(formData.get("maxUses"));
  const discountPercent = Number(formData.get("discountPercent"));
  const discountProductId = String(formData.get("discountProductId") ?? "").trim() || null;
  const giftProductId = kind === "coupon" ? String(formData.get("giftProductId") ?? "").trim() || null : null;
  const giftQty = giftProductId ? Number(formData.get("giftQty")) : 1;
  let code = String(formData.get("code") ?? "").trim().toUpperCase();

  if (!Number.isInteger(maxUses) || maxUses < 1) return { error: "La cantidad de usos debe ser mayor a 0." };
  if (kind === "coupon") {
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { error: "Usá entre 3 y 30 letras, números, guion o guion bajo." };
    if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 99) {
      return { error: "El descuento debe estar entre 0% y 99%." };
    }
    if (discountPercent === 0 && !giftProductId) return { error: "Configurá un descuento o un producto de regalo." };
  } else if (kind === "second_unit") {
    if (!discountProductId) return { error: "Elegí el producto de la promoción." };
    if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 99) {
      return { error: "El descuento de la segunda unidad debe estar entre 1% y 99%." };
    }
    // El código es interno: la promo se aplica sin que el cliente lo escriba.
    if (!code) code = `PROMO-${discountProductId}-${crypto.randomUUID().slice(0, 6)}`.toUpperCase();
  } else {
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { error: "Usá entre 3 y 30 letras, números, guion o guion bajo." };
    if (!discountProductId) return { error: "Elegí el producto de la promoción." };
  }
  if (!Number.isInteger(giftQty) || giftQty < 1) return { error: "La cantidad de regalo debe ser mayor a 0." };

  try {
    await saveCoupon(id, {
      code,
      kind,
      automatic: kind === "second_unit",
      maxUses,
      discountPercent,
      discountProductId,
      giftProductId,
      giftQty,
      firstPurchaseOnly: kind === "coupon" && formData.get("firstPurchaseOnly") === "on",
      oncePerPhone: kind !== "second_unit" && formData.get("oncePerPhone") === "on",
      active: formData.get("active") === "on",
    });
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return { error: "Ese código de regla ya existe." };
    return { error: "No se pudo guardar la regla." };
  }
  revalidatePath("/admin/cupones");
  return { ok: true };
}

export async function deleteCouponAction(id: string): Promise<CouponActionState> {
  const denied = await assertPerm("cupones");
  if (denied) return { error: denied };
  try {
    await deleteCoupon(id);
    revalidatePath("/admin/cupones");
    return { ok: true };
  } catch {
    return { error: "No se puede eliminar una regla que ya fue usada. Podés desactivarla." };
  }
}
