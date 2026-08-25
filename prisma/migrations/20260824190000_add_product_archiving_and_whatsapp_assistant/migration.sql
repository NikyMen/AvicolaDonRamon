-- Preserve product history while removing archived products from the active catalog.
ALTER TABLE "Product" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Product_deletedAt_category_idx" ON "Product"("deletedAt", "category");

-- Global WhatsApp assistant state.
CREATE TABLE "WhatsappAssistantSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappAssistantSettings_pkey" PRIMARY KEY ("id")
);

-- Curated knowledge used by the n8n flow.
CREATE TABLE "WhatsappKnowledge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappKnowledge_pkey" PRIMARY KEY ("id")
);

-- Contacts seen by n8n. Message contents are intentionally not persisted.
CREATE TABLE "WhatsappContact" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "notes" TEXT,
    "assistantPaused" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WhatsappKnowledge_active_updatedAt_idx" ON "WhatsappKnowledge"("active", "updatedAt");
CREATE UNIQUE INDEX "WhatsappContact_phone_key" ON "WhatsappContact"("phone");
CREATE INDEX "WhatsappContact_lastSeenAt_idx" ON "WhatsappContact"("lastSeenAt");
