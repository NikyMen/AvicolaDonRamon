"use server";

import { revalidatePath } from "next/cache";
import { assertPerm } from "@/lib/auth/permissions";
import { createNovedad, updateNovedad, deleteNovedad, NoDatabaseError } from "@/lib/repo";
import { stripImageVersion } from "@/lib/image-url";

export interface SaveNovedadState {
  ok?: boolean;
  error?: string;
}

async function requireAdmin(): Promise<string | null> {
  return assertPerm("novedades");
}

function revalidateHome() {
  revalidatePath("/admin/novedades");
  revalidatePath("/");
}

export async function saveNovedad(
  _prev: SaveNovedadState,
  formData: FormData
): Promise<SaveNovedadState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const image = stripImageVersion(String(formData.get("image") ?? "").trim());
  const link = String(formData.get("link") ?? "").trim();
  const positionRaw = String(formData.get("position") ?? "").trim();
  const position = positionRaw ? Math.round(Number(positionRaw)) : 0;
  const active = formData.get("active") === "on";

  if (!image) return { error: "La imagen es obligatoria (URL o ruta)." };
  if (!Number.isFinite(position)) return { error: "El orden debe ser un número." };

  const data = { title: title || null, image, link: link || null, active, position };

  try {
    if (id) {
      const updated = await updateNovedad(id, data);
      if (!updated) return { error: "Novedad no encontrada." };
    } else {
      await createNovedad(data);
    }
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    return { error: "No se pudo guardar la novedad." };
  }

  revalidateHome();
  return { ok: true };
}

export async function toggleNovedadActive(id: string, active: boolean): Promise<void> {
  const denied = await requireAdmin();
  if (denied) return;
  try {
    await updateNovedad(id, { active });
  } catch {
    return;
  }
  revalidateHome();
}

export async function removeNovedad(id: string): Promise<void> {
  const denied = await requireAdmin();
  if (denied) return;
  try {
    await deleteNovedad(id);
  } catch {
    return;
  }
  revalidateHome();
}
