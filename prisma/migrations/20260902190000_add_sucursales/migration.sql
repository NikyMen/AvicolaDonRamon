CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "mapsUrl" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Sucursal_region_active_idx" ON "Sucursal"("region", "active");

INSERT INTO "Sucursal" ("id", "name", "street", "number", "region", "lat", "lng", "active", "updatedAt") VALUES
('don-ramon', 'Avícola Don Ramón', 'Avenida Las Américas', '4117', 'Paraná, Entre Ríos', -31.7770076, -60.5200741, true, CURRENT_TIMESTAMP);
