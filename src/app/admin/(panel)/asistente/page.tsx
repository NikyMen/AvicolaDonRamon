import { AssistantSettings } from "./AssistantSettings";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold text-brand-ink">Apagar asistente de IA</h1><p className="mt-1 text-sm text-brand-ink/55">Controlá dónde está disponible el asistente de la tienda.</p></div><AssistantSettings /></div>;
}
