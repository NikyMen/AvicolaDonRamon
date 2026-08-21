import { ThemeSettings } from "./ThemeSettings";
import { ConfigSettings } from "./ConfigSettings";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold text-brand-ink">Configuración</h1><p className="mt-1 text-sm text-brand-ink/55">Personalizá el panel y los módulos visibles.</p></div><ConfigSettings /><ThemeSettings /></div>;
}
