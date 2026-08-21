ALTER TABLE "Order" ADD COLUMN "deliveryRetryAt" TIMESTAMP(3);

-- Los pedidos pagados que ya fueron despachados y quedaron cancelados deben
-- volver a Entregas para que el encargado pueda reasignarlos.
UPDATE "Order"
SET "deliveryRetryAt" = COALESCE("cancelledAt", "updatedAt")
WHERE "status" = 'cancelado'
  AND "paidAt" IS NOT NULL
  AND "dispatchedAt" IS NOT NULL;
