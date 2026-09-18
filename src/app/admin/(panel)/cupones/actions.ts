"use server";

import { revalidatePath } from "next/cache";
import { assertCanManageCoupons } from "@/lib/auth/coupon-access";
import { assertPerm } from "@/lib/auth/permissions";
import { deleteCoupon, saveCoupon, setCouponActive, NoDatabaseError } from "@/lib/repo";

export interface CouponActionState { ok?: boolean; error?: string }

export async function saveCouponAction(
  _prev: CouponActionState,
  formData: FormData
): Promise<CouponActionState> {
  const denied = await assertPerm("cupones");
  if (denied) return { error: denied };
  const roleDenied = await assertCanManageCoupons();
  if (roleDenied) return { error: roleDenied };

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const rawKind = String(formData.get("kind") ?? "coupon");
  const kind = rawKind === "second_unit" || rawKind === "three_for_two" ? rawKind : "coupon";
  const hasPriceBenefit = formData.get("benefitPrice") === "on";
  const hasShippingBenefit = formData.get("benefitShipping") === "on";
  const couponType = hasPriceBenefit && hasShippingBenefit
    ? "precio_envio"
    : hasShippingBenefit
      ? "envio"
      : "precio";
  const maxUses = Number(formData.get("maxUses"));
  const discountPercent = Number(formData.get("discountPercent"));
  const shippingDiscountPercent = Number(formData.get("shippingDiscountPercent"));
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
  const discountProductIds = formData
    .getAll("discountProductIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const discountProductId = discountProductIds[0] ?? null;
  const giftProductId =
    kind === "coupon" && hasPriceBenefit
      ? String(formData.get("giftProductId") ?? "").trim() || null
      : null;
  const giftQty = giftProductId ? Number(formData.get("giftQty")) : 1;
  let code = String(formData.get("code") ?? "").trim().toUpperCase();

  if (!Number.isInteger(maxUses) || maxUses < 1) return { error: "La cantidad de usos debe ser mayor a 0." };
  if (!hasPriceBenefit && !hasShippingBenefit) return { error: "Elegí al menos un beneficio para el cupón." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsAtRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(endsAtRaw)) {
    return { error: "Elegí desde qué fecha hasta qué fecha estará disponible." };
  }
  if (startsAtRaw > endsAtRaw) return { error: "La fecha desde no puede ser posterior a la fecha hasta." };
  if (kind === "coupon") {
    if (!/^[A-Z0-9_-]{3,30}$/.test(code) || !/\d/.test(code)) {
      return { error: "El código debe tener al menos 3 caracteres y 1 número. Ej: FACU12." };
    }
    if (hasPriceBenefit && (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 99)) {
      return { error: "El descuento debe estar entre 0% y 99%." };
    }
    if (hasPriceBenefit && discountPercent === 0 && !giftProductId) {
      return { error: "Configurá un descuento o un producto de regalo." };
    }
  } else if (kind === "second_unit") {
    if (!hasPriceBenefit || hasShippingBenefit) return { error: "La promo automática solo puede ser de precio." };
    if (!discountProductId) return { error: "Elegí el producto de la promoción." };
    if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 99) {
      return { error: "El descuento de la segunda unidad debe estar entre 1% y 99%." };
    }
    // El código es interno: la promo se aplica sin que el cliente lo escriba.
    if (!code) code = `PROMO-${discountProductId}-${crypto.randomUUID().slice(0, 6)}`.toUpperCase();
  } else {
    if (!hasPriceBenefit || hasShippingBenefit) return { error: "El 3x2 solo puede ser de precio." };
    if (!/^[A-Z0-9_-]{3,30}$/.test(code) || !/\d/.test(code)) {
      return { error: "El código debe tener al menos 3 caracteres y 1 número. Ej: TRES2." };
    }
    if (!discountProductId) return { error: "Elegí el producto de la promoción." };
  }
  if (hasShippingBenefit && (!Number.isInteger(shippingDiscountPercent) || shippingDiscountPercent < 1 || shippingDiscountPercent > 100)) {
    return { error: "El descuento de envío debe estar entre 1% y 100%." };
  }
  if (!Number.isInteger(giftQty) || giftQty < 1) return { error: "La cantidad de regalo debe ser mayor a 0." };

  try {
    await saveCoupon(id, {
      code,
      couponType,
      kind,
      automatic: kind === "second_unit",
      maxUses,
      availableDays: [],
      startsAt: new Date(`${startsAtRaw}T00:00:00.000Z`),
      endsAt: new Date(`${endsAtRaw}T00:00:00.000Z`),
      discountPercent: hasPriceBenefit ? discountPercent : 0,
      shippingDiscountPercent: hasShippingBenefit ? shippingDiscountPercent : 0,
      discountProductId,
      discountProductIds: [...new Set(discountProductIds)],
      giftProductId,
      giftQty,
      firstPurchaseOnly: false,
      oncePerPhone: kind !== "second_unit",
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

export async function setCouponActiveAction(id: string, active: boolean): Promise<CouponActionState> {
  const denied = await assertPerm("cupones");
  if (denied) return { error: denied };
  const roleDenied = await assertCanManageCoupons();
  if (roleDenied) return { error: roleDenied };
  try {
    await setCouponActive(id, active);
    revalidatePath("/admin/cupones");
    return { ok: true };
  } catch {
    return { error: "No se pudo actualizar el estado del cupón." };
  }
}

export async function deleteCouponAction(id: string): Promise<CouponActionState> {
  const denied = await assertPerm("cupones");
  if (denied) return { error: denied };
  const roleDenied = await assertCanManageCoupons();
  if (roleDenied) return { error: roleDenied };
  try {
    await deleteCoupon(id);
    revalidatePath("/admin/cupones");
    return { ok: true };
  } catch {
    return { error: "No se puede eliminar una regla que ya fue usada. Podés desactivarla." };
  }
}
