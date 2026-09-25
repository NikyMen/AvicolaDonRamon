-- AlterTable
ALTER TABLE "WhatsappContact" ADD COLUMN "kommoContactId" TEXT;
ALTER TABLE "WhatsappContact" ADD COLUMN "commercialCondition" TEXT;

-- CreateIndex
CREATE INDEX "WhatsappContact_kommoContactId_idx" ON "WhatsappContact"("kommoContactId");

-- CreateTable
CREATE TABLE "WholesaleProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "stock" INTEGER,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleProduct_code_key" ON "WholesaleProduct"("code");

-- CreateIndex
CREATE INDEX "WholesaleProduct_available_name_idx" ON "WholesaleProduct"("available", "name");
