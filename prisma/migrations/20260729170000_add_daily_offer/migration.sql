-- AddColumn
ALTER TABLE "Product" ADD COLUMN "dailyOffer" BOOLEAN NOT NULL DEFAULT false;

-- Preserve the products that were already shown in "Ofertas del día".
UPDATE "Product"
SET "dailyOffer" = true
WHERE "oldPrice" IS NOT NULL OR "badge" = 'Promo del día';
