import { requirePerm } from "@/lib/auth/permissions";
import {
  getWhatsappAssistantEnabled,
  listWhatsappContacts,
  listWhatsappKnowledge,
} from "@/lib/whatsapp-assistant";
import { WhatsappAssistantManager } from "./WhatsappAssistantManager";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requirePerm("asistente");
  const [enabled, knowledge, contacts] = await Promise.all([
    getWhatsappAssistantEnabled(),
    listWhatsappKnowledge(),
    listWhatsappContacts(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Asistente inteligente de WhatsApp</h1>
        <p className="mt-1 text-sm text-brand-ink/55">
          Administrá el conocimiento y decidí cuándo debe responder el flujo de n8n.
        </p>
      </div>
      <WhatsappAssistantManager
        initialEnabled={enabled}
        knowledge={knowledge}
        contacts={contacts}
      />
    </div>
  );
}
