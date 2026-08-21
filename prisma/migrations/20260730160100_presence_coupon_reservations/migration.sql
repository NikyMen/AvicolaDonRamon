ALTER TABLE "Order"
ADD COLUMN "couponReservedUntil" TIMESTAMP(3),
ADD COLUMN "couponUsedAt" TIMESTAMP(3);

-- Los rechazos históricos de Mercado Pago no son cancelaciones de una venta.
UPDATE "Order"
SET "status" = 'no_pagado'
WHERE "status" = 'cancelado'
  AND "payment" = 'mercadopago'
  AND "mpPaymentId" IS NULL
  AND "paidAt" IS NULL;

-- usedCount refleja exclusivamente cupones de pagos acreditados.
UPDATE "Order"
SET "couponUsedAt" = COALESCE("paidAt", "updatedAt")
WHERE "couponId" IS NOT NULL
  AND "status" IN ('en_preparacion', 'en_camino', 'entregado');

UPDATE "Coupon" AS c
SET "usedCount" = (
  SELECT COUNT(*)::INTEGER
  FROM "Order" AS o
  WHERE o."couponId" = c."id"
    AND o."couponUsedAt" IS NOT NULL
);

CREATE INDEX "Order_couponId_couponReservedUntil_idx"
ON "Order"("couponId", "couponReservedUntil");

CREATE TABLE "AnalyticsSession" (
  "id" TEXT NOT NULL,
  "path" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsSession_lastSeenAt_idx"
ON "AnalyticsSession"("lastSeenAt");
