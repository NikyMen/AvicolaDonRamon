import { BrainCircuit } from "lucide-react";
import { requirePerm } from "@/lib/auth/permissions";
import { listWhatsappKnowledge } from "@/lib/whatsapp-assistant";
import { WhatsappAssistantManager } from "../asistente/WhatsappAssistantManager";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  await requirePerm("conocimiento");
  const knowledge = await listWhatsappKnowledge();

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
            <BrainCircuit size={21} />
          </span>
          <h1 className="text-2xl font-bold text-brand-ink">Base de conocimiento</h1>
        </div>
        <p className="mt-1 text-sm text-brand-ink/55">
          Administrá la información y el mapa que usa el asistente para responder.
        </p>
      </div>
      <WhatsappAssistantManager
        initialEnabled={false}
        knowledge={knowledge}
        contacts={[]}
        mode="knowledge"
      />
    </div>
  );
}
