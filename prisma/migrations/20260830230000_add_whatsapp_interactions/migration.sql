CREATE TABLE "WhatsappInteraction" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "leadId" TEXT,
    "phone" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappInteraction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WhatsappInteraction_createdAt_idx" ON "WhatsappInteraction"("createdAt");
CREATE INDEX "WhatsappInteraction_leadId_createdAt_idx" ON "WhatsappInteraction"("leadId", "createdAt");
CREATE INDEX "WhatsappInteraction_contactId_createdAt_idx" ON "WhatsappInteraction"("contactId", "createdAt");
ALTER TABLE "WhatsappInteraction" ADD CONSTRAINT "WhatsappInteraction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WhatsappContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
