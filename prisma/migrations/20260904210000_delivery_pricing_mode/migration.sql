ALTER TABLE "DeliverySettings"
ADD COLUMN "pricingMode" TEXT NOT NULL DEFAULT 'flat',
ADD COLUMN "flatFee" INTEGER NOT NULL DEFAULT 2000;

ALTER TABLE "DeliverySettings" ALTER COLUMN "fixedSucursalId" SET DEFAULT 'don-ramon';
