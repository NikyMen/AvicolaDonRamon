"use server";

import { revalidatePath } from "next/cache";
import { assertSuperAdmin } from "@/lib/auth/permissions";
import { saveAdminUiSettings, NoDatabaseError } from "@/lib/repo";
import type { AdminUiSettings } from "@/lib/types";

export interface AdminUiSettingsActionState {
  ok?: boolean;
  error?: string;
}

async function saveAndRevalidate(
  input: Partial<AdminUiSettings>
): Promise<AdminUiSettingsActionState> {
  const denied = await assertSuperAdmin();
  if (denied) return { error: denied };
  try {
    await saveAdminUiSettings(input);
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    return { error: "No se pudo guardar la configuración." };
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function setHiddenModulesAction(
  hiddenModules: string[]
): Promise<AdminUiSettingsActionState> {
  return saveAndRevalidate({ hiddenModules });
}

export async function setAdvancedReportsAction(
  advancedReports: boolean
): Promise<AdminUiSettingsActionState> {
  return saveAndRevalidate({ advancedReports });
}
