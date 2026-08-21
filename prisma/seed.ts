import { PrismaClient } from "@prisma/client";
import {
  products,
  customers,
  orders,
  CODIGO_BIENVENIDA,
  REGALO_BIENVENIDA_PRODUCT_ID,
} from "../src/lib/data";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Limpiando datos previos…");
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();

  console.log("🍗 Cargando productos…");
  for (const p of products) {
    await prisma.product.create({
      data: {
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        oldPrice: p.oldPrice ?? null,
        category: p.category,
        image: p.image,
        badge: p.badge ?? null,
        available: p.available,
        stock: p.stock,
      },
    });
  }

  console.log("🎁 Cargando el código de bienvenida…");
  await prisma.coupon.create({
    data: {
      code: CODIGO_BIENVENIDA,
      maxUses: 100_000,
      discountPercent: 0,
      giftProductId: REGALO_BIENVENIDA_PRODUCT_ID,
      giftQty: 1,
      firstPurchaseOnly: true,
      oncePerPhone: false,
      active: true,
    },
  });

  console.log("📰 Cargando novedades…");
  await prisma.novedad.createMany({
    data: [
      { title: "Día del Padre", image: "/2.jpeg", position: 0 },
      { title: "Compartí en familia", image: "/4.jpeg", position: 1 },
    ],
    skipDuplicates: true,
  });

  console.log("👤 Cargando clientes…");
  for (const c of customers) {
    await prisma.customer.create({
      data: {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        joinedAt: new Date(c.joined),
      },
    });
  }

  console.log("🧾 Cargando pedidos…");
  const nameToId = Object.fromEntries(customers.map((c) => [c.name, c.id]));
  for (const o of orders) {
    const created = await prisma.order.create({
      data: {
        customerId: nameToId[o.customer] ?? null,
        customerName: o.customer,
        total: o.total,
        status: o.status,
        payment: o.payment,
        createdAt: new Date(o.date),
        items: {
          create: o.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            qty: i.qty,
            price: i.price,
          })),
        },
      },
    });
    // Código público legible a partir del número secuencial.
    await prisma.order.update({
      where: { id: created.id },
      data: { code: `#${1000 + created.seq}` },
    });
  }

  console.log("✅ Seed completado.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Error en el seed:", e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
