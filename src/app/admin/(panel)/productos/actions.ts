"use server";

import { revalidatePath } from "next/cache";
import { assertPerm } from "@/lib/auth/permissions";
import {
  createProduct,
  deleteProduct,
  getProduct,
  updateProduct,
  NoDatabaseError,
  ProductInUseError,
} from "@/lib/repo";
import { deleteProductImage, isUploadedFile, saveProductImage } from "@/lib/product-images";
import { stripImageVersion } from "@/lib/image-url";
import type { Category } from "@/lib/types";

export interface SaveProductState {
  ok?: boolean;
  error?: string;
}

const CATEGORIES: Category[] = ["cortes", "cajones", "rebozados"];

async function requireAdmin(): Promise<string | null> {
  return assertPerm("productos");
}

function revalidateCatalog() {
  revalidatePath("/admin/productos");
  revalidatePath("/productos");
  revalidatePath("/ofertas");
  revalidatePath("/");
}

export async function saveProduct(
  _prev: SaveProductState,
  formData: FormData
): Promise<SaveProductState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageInput = stripImageVersion(String(formData.get("image") ?? "").trim());
  const fileValue = formData.get("file");
  const uploadedFile = isUploadedFile(fileValue) && fileValue.size > 0 ? fileValue : null;
  const badge = String(formData.get("badge") ?? "").trim();
  const category = String(formData.get("category") ?? "") as Category;
  const price = Math.round(Number(formData.get("price")));
  const oldPriceRaw = String(formData.get("oldPrice") ?? "").trim();
  const oldPrice = oldPriceRaw ? Math.round(Number(oldPriceRaw)) : null;
  const stock = Math.round(Number(formData.get("stock")));
  const available = formData.get("available") === "on";

  if (!name) return { error: "El nombre es obligatorio." };
  if (!Number.isFinite(price) || price <= 0) return { error: "El precio debe ser mayor a 0." };
  if (!Number.isInteger(stock) || stock < 0)
    return { error: "El stock debe ser un número igual o mayor a 0." };
  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice <= price))
    return { error: "El precio anterior debe ser mayor al precio actual." };
  if (!CATEGORIES.includes(category)) return { error: "Categoría inválida." };
  const dataWithoutImage = {
    name,
    description,
    price,
    oldPrice,
    category,
    badge: badge || null,
    available,
    stock,
  };

  let uploadedImage = "";
  try {
    const previous = id ? await getProduct(id) : null;
    if (id && !previous) return { error: "Producto no encontrado." };
    uploadedImage = uploadedFile ? await saveProductImage(uploadedFile) : "";
    const image = uploadedImage || imageInput;
    const data = { ...dataWithoutImage, image };
    if (id) {
      const updated = await updateProduct(id, data);
      if (!updated) return { error: "Producto no encontrado." };
    } else {
      await createProduct(data);
    }

    if (previous && stripImageVersion(previous.image) !== image) {
      try {
        await deleteProductImage(previous.image);
      } catch {
        // No se revierte el producto si falla la limpieza del archivo anterior.
      }
    }
  } catch (e) {
    if (uploadedImage) {
      try {
        await deleteProductImage(uploadedImage);
      } catch {
        // La limpieza no debe ocultar el error original.
      }
    }
    if (e instanceof NoDatabaseError) return { error: e.message };
    return { error: "No se pudo guardar el producto." };
  }

  revalidateCatalog();
  return { ok: true };
}

export async function toggleProductAvailability(id: string, available: boolean): Promise<void> {
  const denied = await requireAdmin();
  if (denied) return;
  try {
    await updateProduct(id, { available });
  } catch {
    return;
  }
  revalidateCatalog();
}

export async function deleteProductAction(id: string): Promise<SaveProductState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  try {
    const product = await getProduct(id);
    if (!product) return { error: "Producto no encontrado." };

    const deleted = await deleteProduct(id);
    if (!deleted) return { error: "Producto no encontrado." };

    try {
      await deleteProductImage(product.image);
    } catch {
      // El registro ya fue eliminado; la limpieza del archivo no debe bloquearlo.
    }
  } catch (error) {
    if (error instanceof NoDatabaseError) return { error: error.message };
    if (error instanceof ProductInUseError) {
      return { error: "No se puede eliminar: tiene pedidos o cupones asociados. Podés pausarlo." };
    }
    return { error: "No se pudo eliminar el producto." };
  }

  revalidateCatalog();
  return { ok: true };
}
