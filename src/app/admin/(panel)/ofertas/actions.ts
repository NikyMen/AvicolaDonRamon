"use server";

import { revalidatePath } from "next/cache";
import { assertPerm } from "@/lib/auth/permissions";
import { getProduct, updateProduct, upsertSuperOferta, NoDatabaseError, getSuperOferta } from "@/lib/repo";
import { deleteProductImage, isUploadedFile, saveProductImage } from "@/lib/product-images";
import { stripImageVersion } from "@/lib/image-url";

export interface SetOfferState {
  ok?: boolean;
  error?: string;
}

function revalidateCatalog() {
  revalidatePath("/admin/ofertas");
  revalidatePath("/admin/productos");
  revalidatePath("/ofertas");
  revalidatePath("/productos");
  revalidatePath("/");
}

/**
 * Pone, actualiza o saca un producto de ofertas.
 *
 * Modelo de datos: un producto está "en oferta" cuando tiene `oldPrice`.
 * - `oldPrice` = precio normal (tachado en la tienda).
 * - `price`    = precio de oferta (el que se cobra).
 *
 * `offerPrice = null` saca el producto de ofertas y restaura el precio normal.
 */
export async function setOffer(id: string, offerPrice: number | null): Promise<SetOfferState> {
  const denied = await assertPerm("ofertas");
  if (denied) return { error: denied };

  const product = await getProduct(id);
  if (!product) return { error: "Producto no encontrado." };

  // Precio normal del producto (lo que vale sin oferta).
  const normalPrice = product.oldPrice ?? product.price;

  try {
    if (offerPrice === null) {
      // Sacar de ofertas: restaurar el precio normal.
      await updateProduct(id, { price: normalPrice, oldPrice: null });
    } else {
      if (!Number.isFinite(offerPrice) || offerPrice <= 0)
        return { error: "El precio de oferta debe ser mayor a 0." };
      if (offerPrice >= normalPrice)
        return { error: "El precio de oferta debe ser menor al precio normal." };
      await updateProduct(id, { price: offerPrice, oldPrice: normalPrice });
    }
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    return { error: "No se pudo actualizar la oferta." };
  }

  revalidateCatalog();
  return { ok: true };
}

/** Marca si el producto aparece en la sección "Ofertas del día" de la home. */
export async function setDailyOffer(id: string, dailyOffer: boolean): Promise<SetOfferState> {
  const denied = await assertPerm("ofertas");
  if (denied) return { error: denied };

  try {
    const updated = await updateProduct(id, { dailyOffer });
    if (!updated) return { error: "Producto no encontrado." };
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    return { error: "No se pudo actualizar la selección de ofertas del día." };
  }

  revalidateCatalog();
  return { ok: true };
}

export interface SaveSuperOfertaState {
  ok?: boolean;
  error?: string;
}

/**
 * Guarda el banner "Super Oferta" de la home (fila única).
 * La imagen es obligatoria; el video mp4 es opcional y, si está, se usa como
 * fondo animado del banner (la imagen queda de póster).
 */
export async function saveSuperOferta(
  _prev: SaveSuperOfertaState,
  formData: FormData
): Promise<SaveSuperOfertaState> {
  const denied = await assertPerm("ofertas");
  if (denied) return { error: denied };

  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  const imageInput = stripImageVersion(String(formData.get("image") ?? "").trim());
  const fileValue = formData.get("file");
  const uploadedFile = isUploadedFile(fileValue) && fileValue.size > 0 ? fileValue : null;
  const video = String(formData.get("video") ?? "").trim();
  const cartProductId = String(formData.get("cartProductId") ?? "").trim();
  const cartQuantity = Math.round(Number(String(formData.get("cartQuantity") ?? "").trim()));
  const active = formData.get("active") === "on";
  const price = Math.round(Number(String(formData.get("price") ?? "").trim()));
  const oldPriceRaw = String(formData.get("oldPrice") ?? "").trim();
  const oldPrice = oldPriceRaw ? Math.round(Number(oldPriceRaw)) : null;

  if (!title) return { error: "El título es obligatorio." };
  if (!uploadedFile && (!imageInput || imageInput.startsWith("blob:"))) {
    return { error: "Elegí una imagen o ingresá una URL/ruta válida." };
  }
  if (video) {
    const cleanVideo = video.split(/[?#]/)[0]?.toLowerCase() ?? "";
    if (!cleanVideo.endsWith(".mp4")) return { error: "El video debe ser un archivo mp4." };
  }
  if (!Number.isFinite(price) || price <= 0)
    return { error: "El precio de oferta debe ser mayor a 0." };
  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice <= price))
    return { error: "El precio anterior debe ser mayor al precio de oferta." };
  if (!cartProductId) return { error: "Elegí el producto que agregará el botón." };
  if (!Number.isInteger(cartQuantity) || cartQuantity < 1)
    return { error: "La cantidad a agregar debe ser un entero mayor a 0." };
  if (!(await getProduct(cartProductId))) return { error: "El producto seleccionado no existe." };

  let uploadedImage = "";
  try {
    const previous = await getSuperOferta();
    uploadedImage = uploadedFile ? await saveProductImage(uploadedFile) : "";
    const image = uploadedImage || imageInput;
    await upsertSuperOferta({
      title,
      subtitle: subtitle || null,
      price,
      oldPrice,
      image,
      video: video || null,
      cartProductId,
      cartQuantity,
      active,
    });

    if (stripImageVersion(previous.image) !== image) {
      try {
        await deleteProductImage(previous.image);
      } catch {
        // La limpieza del archivo anterior no debe ocultar el guardado exitoso.
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
    return { error: "No se pudo guardar la super oferta." };
  }

  revalidatePath("/admin/ofertas");
  revalidatePath("/");
  return { ok: true };
}
