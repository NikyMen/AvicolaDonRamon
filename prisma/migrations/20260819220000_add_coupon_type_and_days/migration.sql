ALTER TABLE "Coupon"
ADD COLUMN "couponType" TEXT NOT NULL DEFAULT 'precio',
ADD COLUMN "availableDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

CREATE INDEX "Coupon_active_couponType_idx" ON "Coupon"("active", "couponType");
