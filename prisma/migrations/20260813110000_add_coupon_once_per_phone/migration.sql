ALTER TABLE "Coupon"
ADD COLUMN "oncePerPhone" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Coupon"
SET "oncePerPhone" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = '3X2';
