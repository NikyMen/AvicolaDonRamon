INSERT INTO "Coupon" (
    "id", "code", "kind", "automatic", "maxUses", "discountPercent",
    "discountProductId", "giftQty", "firstPurchaseOnly", "active", "updatedAt"
)
SELECT
    'cupon-pata-muslo-3x2', '3X2', 'three_for_two', false, 100000, 0,
    p."id", 1, false, true, CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."id" = 'p-cuartos-traseros-3kg'
ON CONFLICT ("code") DO UPDATE SET
    "kind" = EXCLUDED."kind",
    "automatic" = EXCLUDED."automatic",
    "maxUses" = EXCLUDED."maxUses",
    "discountPercent" = EXCLUDED."discountPercent",
    "discountProductId" = EXCLUDED."discountProductId",
    "giftProductId" = NULL,
    "giftQty" = EXCLUDED."giftQty",
    "firstPurchaseOnly" = EXCLUDED."firstPurchaseOnly",
    "active" = EXCLUDED."active",
    "updatedAt" = CURRENT_TIMESTAMP;
