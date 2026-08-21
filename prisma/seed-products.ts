import { PrismaClient } from "@prisma/client";
import { products, CODIGO_BIENVENIDA, REGALO_BIENVENIDA_PRODUCT_ID } from "../src/lib/data";

// Carga/actualiza el catálogo (upsert por id) y el cupón de bienvenida.
// Seguro de correr en producción: no toca clientes ni pedidos.
const prisma = new PrismaClient();

async function main() {
  console.log("🍗 Subiendo productos…");
  for (const p of products) {
    const data = {
      name: p.name,
      description: p.description,
      price: p.price,
      oldPrice: p.oldPrice ?? null,
      category: p.category,
      image: p.image,
      badge: p.badge ?? null,
      available: p.available,
    };
    await prisma.product.upsert({
      where: { id: p.id },
      // El stock solo se define al crear el producto: si ya existe se respeta
      // el que venga cargado desde el panel (puede haber ventas en el medio).
      create: { id: p.id, ...data, dailyOffer: p.dailyOffer, stock: p.stock },
      update: data,
    });
    console.log(`  ✔ ${p.name}`);
  }
  console.log(`✅ ${products.length} productos cargados/actualizados.`);

  // Regalo de bienvenida: cupón de un solo uso por número de teléfono que
  // suma una bolsa de patitas de 1 kg. El cliente tiene que escribir el código.
  console.log("🎁 Configurando el código de bienvenida…");
  const regalo = {
    maxUses: 100_000,
    discountPercent: 0,
    giftProductId: REGALO_BIENVENIDA_PRODUCT_ID,
    giftQty: 1,
    firstPurchaseOnly: true,
    oncePerPhone: false,
    active: true,
  };
  await prisma.coupon.upsert({
    where: { code: CODIGO_BIENVENIDA },
    create: { code: CODIGO_BIENVENIDA, ...regalo },
    update: regalo,
  });
  console.log(`✅ Código ${CODIGO_BIENVENIDA} listo.`);

  // Promo automática: la segunda unidad de Medallones Calisa 1 kg tiene 50%
  // de descuento. Se administra desde /admin/cupones.
  const promoMedallones = {
    kind: "second_unit",
    automatic: true,
    maxUses: 100_000,
    discountPercent: 50,
    discountProductId: "p-medallones-1kg",
    giftProductId: null,
    giftQty: 1,
    firstPurchaseOnly: false,
    oncePerPhone: false,
    active: true,
  };
  await prisma.coupon.upsert({
    where: { code: "PROMO-MEDALLONES-2DA" },
    create: { code: "PROMO-MEDALLONES-2DA", ...promoMedallones },
    update: promoMedallones,
  });
  console.log("✅ Promo automática de segunda unidad para Medallones Calisa lista.");

  const cuponTresPorDos = {
    kind: "three_for_two",
    automatic: false,
    maxUses: 100_000,
    discountPercent: 0,
    discountProductId: "p-cuartos-traseros-3kg",
    giftProductId: null,
    giftQty: 1,
    firstPurchaseOnly: false,
    oncePerPhone: true,
    active: true,
  };
  await prisma.coupon.upsert({
    where: { code: "3X2" },
    create: { code: "3X2", ...cuponTresPorDos },
    update: cuponTresPorDos,
  });
  console.log("✅ Cupón 3X2 para pata muslo de 3 kg listo.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Error:", e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
