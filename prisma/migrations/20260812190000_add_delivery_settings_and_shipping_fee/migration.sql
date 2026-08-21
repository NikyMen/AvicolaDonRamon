ALTER TABLE "Order"
ADD COLUMN "shippingFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "shippingDistanceKm" DOUBLE PRECISION,
ADD COLUMN "shippingFreeReason" TEXT;

CREATE TABLE "DeliverySettings" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "pricePerKm" INTEGER NOT NULL DEFAULT 500,
  "freeAllSlots" BOOLEAN NOT NULL DEFAULT false,
  "freeSaturday" BOOLEAN NOT NULL DEFAULT false,
  "fixedSucursalId" TEXT NOT NULL DEFAULT 'maipu',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliverySettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "DeliverySettings" (
  "id",
  "pricePerKm",
  "freeAllSlots",
  "freeSaturday",
  "fixedSucursalId",
  "updatedAt"
) VALUES (
  'main',
  500,
  false,
  false,
  'maipu',
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;
