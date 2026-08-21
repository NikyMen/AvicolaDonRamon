-- Idempotencia del checkout y trazabilidad del pago/cancelación.
ALTER TABLE "Order"
ADD COLUMN "checkoutId" TEXT,
ADD COLUMN "mpPreferenceId" TEXT,
ADD COLUMN "mpInitPoint" TEXT,
ADD COLUMN "mpPaymentId" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- Los pedidos históricos cancelados conservan como mejor referencia disponible
-- la hora de su última actualización.
UPDATE "Order"
SET "cancelledAt" = "updatedAt"
WHERE "status" = 'cancelado' AND "cancelledAt" IS NULL;

CREATE UNIQUE INDEX "Order_checkoutId_key" ON "Order"("checkoutId");
CREATE UNIQUE INDEX "Order_mpPreferenceId_key" ON "Order"("mpPreferenceId");
CREATE UNIQUE INDEX "Order_mpPaymentId_key" ON "Order"("mpPaymentId");
