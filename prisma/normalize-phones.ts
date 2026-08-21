/**
 * Migración: normaliza los teléfonos de Customer y Order y fusiona los clientes
 * que resultan ser la misma persona.
 *
 * Antes, el teléfono se guardaba como lo tipeaba el cliente en el checkout, así
 * que "+54 379 452-5617", "0379 15 452 5617" y "3794525617" creaban tres filas
 * distintas y el historial de compras quedaba partido. Este script recalcula la
 * clave canónica (ver src/lib/phone.ts), elige un cliente "ganador" por número
 * y le reasigna los pedidos de sus duplicados.
 *
 * Ganador = el que tiene más pedidos; a igualdad, el más antiguo (conserva la
 * antigüedad como cliente).
 *
 * Uso:
 *   pnpm tsx prisma/normalize-phones.ts          # dry-run: solo informa
 *   pnpm tsx prisma/normalize-phones.ts --apply  # aplica los cambios
 */
import { PrismaClient } from "@prisma/client";
import { normalizePhone } from "../src/lib/phone";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const customers = await prisma.customer.findMany({
    include: { orders: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Agrupar por teléfono canónico.
  const groups = new Map<string, typeof customers>();
  for (const c of customers) {
    const key = normalizePhone(c.phone);
    if (!key) {
      console.warn(`! Cliente ${c.id} (${c.name}) tiene un teléfono ilegible: "${c.phone}". Se deja como está.`);
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const merges = [...groups.entries()].filter(([, list]) => list.length > 1);
  const renames = [...groups.entries()].filter(
    ([key, list]) => list.length === 1 && list[0].phone !== key
  );

  console.log(`Clientes: ${customers.length}`);
  console.log(`Números canónicos: ${groups.size}`);
  console.log(`Teléfonos a reescribir (sin fusión): ${renames.length}`);
  console.log(`Números con duplicados a fusionar: ${merges.length}`);

  for (const [key, list] of merges) {
    const winner = pickWinner(list);
    const losers = list.filter((c) => c.id !== winner.id);
    console.log(
      `\n  ${key}\n    ganador: ${winner.name} (${winner.id}, ${winner.orders.length} pedidos)\n` +
        losers
          .map((l) => `    fusiona: ${l.name} (${l.id}, "${l.phone}", ${l.orders.length} pedidos)`)
          .join("\n")
    );
  }

  if (!APPLY) {
    console.log("\n[dry-run] No se modificó nada. Volvé a correr con --apply para aplicar.");
    return;
  }

  console.log("\nAplicando…");

  for (const [key, list] of groups) {
    const winner = pickWinner(list);
    const losers = list.filter((c) => c.id !== winner.id);

    await prisma.$transaction(async (tx) => {
      for (const loser of losers) {
        // Los pedidos del duplicado pasan al ganador.
        await tx.order.updateMany({
          where: { customerId: loser.id },
          data: { customerId: winner.id },
        });
      }

      if (losers.length) {
        // El email/documento del ganador puede estar vacío y el del duplicado no.
        const email = winner.email ?? losers.find((l) => l.email)?.email ?? null;
        const document = winner.document ?? losers.find((l) => l.document)?.document ?? null;

        // Liberamos el phone de los duplicados antes de escribir el canónico:
        // Customer.phone es @unique y si no, el update del ganador choca.
        for (const loser of losers) {
          await tx.customer.update({
            where: { id: loser.id },
            data: { phone: `merged:${loser.id}` },
          });
        }
        await tx.customer.update({
          where: { id: winner.id },
          data: { phone: key, email, document },
        });
        for (const loser of losers) {
          await tx.customer.delete({ where: { id: loser.id } });
        }
      } else if (winner.phone !== key) {
        await tx.customer.update({ where: { id: winner.id }, data: { phone: key } });
      }
    });
  }

  // Order.phone es una copia denormalizada para mostrar en el panel/reparto.
  const orders = await prisma.order.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });
  let fixedOrders = 0;
  for (const o of orders) {
    const key = normalizePhone(o.phone!);
    if (key && key !== o.phone) {
      await prisma.order.update({ where: { id: o.id }, data: { phone: key } });
      fixedOrders++;
    }
  }

  console.log(`Listo. Clientes fusionados: ${merges.reduce((a, [, l]) => a + l.length - 1, 0)}.`);
  console.log(`Teléfonos de pedidos normalizados: ${fixedOrders}.`);
}

/** Gana el que tiene más pedidos; a igualdad, el más antiguo. */
function pickWinner<T extends { orders: unknown[]; createdAt: Date }>(list: T[]): T {
  return [...list].sort(
    (a, b) => b.orders.length - a.orders.length || a.createdAt.getTime() - b.createdAt.getTime()
  )[0];
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
