import assert from "node:assert/strict";

// Dobles de base de datos: estas pruebas no conectan a PostgreSQL ni a servicios externos.
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/integration";
const { prisma } = await import("../src/lib/prisma.ts");
const repo = await import("../src/lib/repo.ts");
const geo = await import("../src/lib/geo.ts");
const { estimatedDeliveryOptions } = await import("../src/lib/entrega.ts");
const { sucursales } = await import("../src/lib/sucursales.ts");

let settings = { pricingMode: "flat", flatFee: 2000, pricePerKm: 500, freeAllSlots: false, freeSaturday: false, fixedSucursalId: "don-ramon" };
prisma.deliverySettings.upsert = async () => settings;
prisma.sucursal.findMany = async () => sucursales;
const point = { ...geo.PARANA_CENTER, deliveryDate: "2026-09-05" };
assert.equal((await repo.quoteDelivery(point)).fee, 2000);
settings = { ...settings, pricingMode: "distance" };
assert.equal((await repo.quoteDelivery(point)).fee, Math.round(geo.distanceKm(sucursales[0], point) * 500));
settings = { ...settings, freeSaturday: true };
assert.equal((await repo.quoteDelivery(point)).fee, 0);
assert.ok((await repo.quoteDelivery({ ...point, deliveryDate: "2026-09-07" })).fee > 0);
settings = { ...settings, freeAllSlots: true };
assert.equal((await repo.quoteDelivery({ ...point, deliveryDate: "2026-09-07" })).fee, 0);
assert.equal(geo.isInsideDeliveryLocality("parana", point.lat, point.lng), true);
assert.equal(geo.isInsideDeliveryLocality("parana", -27.4692, -58.8306), false);
assert.equal(geo.isDeliveryLocality("corrientes"), false);
assert.deepEqual(estimatedDeliveryOptions(new Date("2026-09-04T18:00:00Z"), "parana").map(o => [o.id, o.date]), [["08-12", "2026-09-05"], ["08-12", "2026-09-07"]]);

const product = { id: "test-product", name: "Pollo", description: "", price: 1000, stock: 20, available: true, category: "cortes", image: "/logo.jpg", dailyOffer: false, deletedAt: null };
let archived = false;
let couponDeactivation;
prisma.$transaction = async (work) => work({
  product: {
    findFirst: async () => archived ? null : product,
    update: async ({ data }) => { archived = true; return { ...product, ...data }; },
  },
  coupon: { updateMany: async (args) => { couponDeactivation = args; return { count: 1 }; } },
  superOferta: { updateMany: async () => ({ count: 1 }) },
});
const archivedProduct = await repo.deleteProduct(product.id);
assert.equal(archivedProduct.available, false);
assert.equal(archivedProduct.stock, 0);
assert.deepEqual(couponDeactivation.where.OR, [{ discountProductId: product.id }, { discountProductIds: { has: product.id } }, { giftProductId: product.id }]);
assert.equal(await repo.deleteProduct(product.id), null);

prisma.order.findMany = async () => [];
let reservations = 0;
prisma.order.count = async () => reservations;
prisma.product.findMany = async ({ where }) => {
  assert.equal(where.deletedAt, null);
  return [product];
};
let coupon = { id: "test-coupon", code: "TEST", active: true, couponType: "precio_envio", kind: "coupon", automatic: false, maxUses: 3, usedCount: 0, availableDays: [6], startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: new Date("2026-09-30T00:00:00Z"), discountPercent: 10, shippingDiscountPercent: 50, discountProductIds: [product.id], discountProductId: null, firstPurchaseOnly: false, oncePerPhone: false, giftProduct: null };
prisma.coupon.findUnique = async () => coupon;
const items = [{ productId: product.id, qty: 3 }];
const quote = await repo.quoteCoupon("TEST", items, undefined, "2026-09-05");
assert.equal(quote.discount, 300);
assert.equal(quote.shippingDiscountPercent, 50);
await assert.rejects(repo.quoteCoupon("TEST", items, undefined, "2026-09-07"), /día elegido/);
await assert.rejects(repo.quoteCoupon("TEST", items, undefined, "2026-10-03"), /venció/);
reservations = 3;
await assert.rejects(repo.quoteCoupon("TEST", items, undefined, "2026-09-05"), /agotó/);
reservations = 0;
coupon = { ...coupon, kind: "three_for_two" };
assert.equal((await repo.quoteCoupon("TEST", items, undefined, "2026-09-05")).discount, 1000);
console.log("Integración verificada: tarifas, bonificaciones, cobertura, calendario, archivado y cupones.");
await prisma.$disconnect();
