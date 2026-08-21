ALTER TABLE "Coupon"
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'coupon',
ADD COLUMN "automatic" BOOLEAN NOT NULL DEFAULT false;

-- Deja disponible la regla inicial cuando el catálogo ya fue cargado.
INSERT INTO "Coupon" (
    "id", "code", "kind", "automatic", "maxUses", "discountPercent",
    "discountProductId", "giftQty", "firstPurchaseOnly", "active", "updatedAt"
)
SELECT
    'promo-medallones-2da', 'PROMO-MEDALLONES-2DA', 'second_unit', true, 100000, 50,
    p."id", 1, false, true, CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."id" = 'p-medallones-1kg'
ON CONFLICT ("code") DO NOTHING;
