import { ThemeSettings } from "./ThemeSettings";
import { ConfigSettings } from "./ConfigSettings";
import { getAdminUiSettings } from "@/lib/repo";
import { getSession } from "@/lib/auth/session";
import { ALL_PERMS } from "@/lib/auth/perm-modules";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [settings, session] = await Promise.all([getAdminUiSettings(), getSession()]);
  const canManage = Boolean(session?.perms?.includes(ALL_PERMS));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Configuración</h1>
        <p className="mt-1 text-sm text-brand-ink/55">Personalizá el panel y los módulos visibles.</p>
      </div>
      <ConfigSettings
        hiddenModules={settings.hiddenModules}
        advancedReports={settings.advancedReports}
        canManage={canManage}
      />
      <ThemeSettings />
    </div>
  );
}
