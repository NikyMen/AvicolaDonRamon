import { requirePerm } from "@/lib/auth/permissions";
import { WhatsAppIcon } from "@/components/admin/WhatsAppIcon";
import {
  getWhatsappAssistantEnabled,
  listWhatsappContacts,
} from "@/lib/whatsapp-assistant";
import { WhatsappAssistantManager } from "./WhatsappAssistantManager";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requirePerm("asistente");
  const [enabled, contacts] = await Promise.all([
    getWhatsappAssistantEnabled(),
    listWhatsappContacts(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#159447]"><WhatsAppIcon size={21} /></span>
          <h1 className="text-2xl font-bold text-brand-ink">Asistente WhatsApp</h1>
        </div>
        <p className="mt-1 text-sm text-brand-ink/55">
          Controlá cuándo debe responder el asistente y administrá sus contactos.
        </p>
      </div>
      <WhatsappAssistantManager
        initialEnabled={enabled}
        knowledge={[]}
        contacts={contacts}
        mode="control"
      />
    </div>
  );
}
