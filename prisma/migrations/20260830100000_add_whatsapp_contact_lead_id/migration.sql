ALTER TABLE "WhatsappContact" ADD COLUMN "leadId" TEXT;
CREATE UNIQUE INDEX "WhatsappContact_leadId_key" ON "WhatsappContact"("leadId");
