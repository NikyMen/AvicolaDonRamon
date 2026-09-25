"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { assertPerm } from "@/lib/auth/permissions";
import { NoDatabaseError } from "@/lib/repo";
import {
  deleteWholesaleProduct,
  importWholesaleProducts,
  saveWholesaleProduct,
  setWholesaleProductAvailable,
  wholesaleImportSchema,
} from "@/lib/wholesale";
import type { WholesaleImportRow } from "@/lib/wholesale-import";

export interface WholesaleActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const MAX_INT = 2147483647;

// Quien administra el Stock también administra la lista mayorista.
async function requireStockPermission(): Promise<string | null> {
  return assertPerm("productos");
}

function failure(error: unknown, fallback: string): WholesaleActionState {
  if (error instanceof NoDatabaseError) return { error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { error: "Ya existe un producto mayorista con ese código." };
  }
  return { error: fallback };
}

function refreshWholesale() {
  revalidatePath("/admin/mayorista");
}

export async function saveWholesaleProductAction(
  _previous: WholesaleActionState,
  formData: FormData
): Promise<WholesaleActionState> {
  const denied = await requireStockPermission();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const price = Math.round(Number(formData.get("price")));
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const stock = stockRaw === "" ? null : Math.round(Number(stockRaw));
  const available = formData.get("available") === "on";

  if (!name || name.length > 200) return { error: "El nombre debe tener entre 1 y 200 caracteres." };
  if (code.length > 100) return { error: "El código no puede superar 100 caracteres." };
  if (description.length > 500) return { error: "La descripción no puede superar 500 caracteres." };
  if (category.length > 100) return { error: "La categoría no puede superar 100 caracteres." };
  if (!Number.isFinite(price) || price <= 0 || price > MAX_INT) return { error: "El precio debe ser mayor a 0." };
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > MAX_INT)) {
    return { error: "El stock debe ser un número igual o mayor a 0, o quedar vacío." };
  }

  try {
    await saveWholesaleProduct({ id, code, name, description, category, price, stock, available });
    refreshWholesale();
    return { ok: true };
  } catch (error) {
    return failure(error, "No se pudo guardar el producto.");
  }
}

export async function toggleWholesaleAvailabilityAction(
  id: string,
  available: boolean
): Promise<WholesaleActionState> {
  const denied = await requireStockPermission();
  if (denied) return { error: denied };
  try {
    await setWholesaleProductAvailable(id, available);
    refreshWholesale();
    return { ok: true };
  } catch (error) {
    return failure(error, "No se pudo cambiar la disponibilidad.");
  }
}

export async function deleteWholesaleProductAction(id: string): Promise<WholesaleActionState> {
  const denied = await requireStockPermission();
  if (denied) return { error: denied };
  try {
    await deleteWholesaleProduct(id);
    refreshWholesale();
    return { ok: true };
  } catch (error) {
    return failure(error, "No se pudo eliminar el producto.");
  }
}

export async function importWholesaleProductsAction(rows: WholesaleImportRow[]): Promise<WholesaleActionState> {
  const denied = await requireStockPermission();
  if (denied) return { error: denied };
  const parsed = wholesaleImportSchema.safeParse(rows);
  if (!parsed.success) return { error: "Hay filas inválidas: revisá nombre, precio y stock." };
  try {
    const result = await importWholesaleProducts(parsed.data);
    refreshWholesale();
    return { ok: true, message: `${result.created} nuevos y ${result.updated} actualizados.` };
  } catch (error) {
    return failure(error, "No se pudo importar la lista.");
  }
}
