"use server";

import { revalidatePath } from "next/cache";
import { assertPerm } from "@/lib/auth/permissions";
import { createCustomer, updateCustomer, NoDatabaseError } from "@/lib/repo";

export interface SaveCustomerState {
  ok?: boolean;
  error?: string;
}

async function requireAdmin(): Promise<string | null> {
  return assertPerm("clientes");
}

export async function saveCustomer(
  _prev: SaveCustomerState,
  formData: FormData
): Promise<SaveCustomerState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const document = String(formData.get("document") ?? "").trim();

  if (!name) return { error: "El nombre es obligatorio." };

  try {
    if (id) {
      const updated = await updateCustomer(id, {
        name,
        email: email || null,
        document: document || null,
      });
      if (!updated) return { error: "Cliente no encontrado." };
    } else {
      if (!phone) return { error: "El teléfono es obligatorio para un cliente nuevo." };
      await createCustomer({ name, phone, email: email || undefined, document: document || undefined });
    }
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    return { error: "No se pudo guardar el cliente." };
  }

  revalidatePath("/admin/clientes");
  return { ok: true };
}
