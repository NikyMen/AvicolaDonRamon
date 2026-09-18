// Ejecutar con pnpm exec node scripts/repair-cuantico-prices.mjs ...
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
nextRequire('@next/env').loadEnvConfig(process.cwd(), false);
const [mode, file, ...extra] = process.argv.slice(2);
if (!['preview', 'apply', 'restore'].includes(mode) || !file || extra.length) {
  throw new Error('Uso: pnpm exec node scripts/repair-cuantico-prices.mjs preview|apply|restore precios-respaldo.json');
}
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL. Ejecutar desde la carpeta del proyecto.');
const db = new PrismaClient();
const path = resolve(file);
try {
  if (mode === 'preview') {
    const products = await db.product.findMany({
      where: { id: { startsWith: 'cuantico-' }, deletedAt: null },
      select: { id: true, name: true, price: true, oldPrice: true, updatedAt: true },
      orderBy: { id: 'asc' },
    });
    const skippedZeroPrice = products.filter(p => p.price === 0);
    console.log(`${skippedZeroPrice.length} productos con precio cero omitidos; quedan sin cambios.`);
    const rows = products.filter(p => p.price !== 0).map(p => ({
      ...p, updatedAt: p.updatedAt.toISOString(),
      nextPrice: Math.round(p.price / 10),
      nextOldPrice: p.oldPrice === null ? null : Math.round(p.oldPrice / 10),
    }));
    validateRows(rows);
    await writeFile(path, JSON.stringify({ version: 1, divisor: 10, createdAt: new Date().toISOString(), skippedZeroPrice, rows }, null, 2), { flag: 'wx', mode: 0o600 });
    console.table(rows.slice(0, 20).map(({ id, name, price, nextPrice }) => ({ id, name, antes: price, despues: nextPrice })));
    console.log(`${rows.length} productos Cuántico. Vista previa y respaldo completo: ${path}`);
    console.log('Sin cambios en la base. Revisá el archivo: la división afecta a TODOS los productos listados, incluidos sus precios anteriores.');
  } else {
    const plan = JSON.parse(await readFile(path, 'utf8'));
    if (plan.version !== 1 || plan.divisor !== 10) throw new Error('Formato de respaldo inválido.');
    validateRows(plan.rows);
    const restoring = mode === 'restore';
    const result = await db.$transaction(async tx => {
      let changed = 0;
      let unchanged = 0;
      for (const row of plan.rows) {
        const current = await tx.product.findUnique({ where: { id: row.id } });
        if (!current || current.deletedAt) throw new Error(`${row.id}: producto ausente o archivado.`);
        const price = restoring ? row.price : row.nextPrice;
        const oldPrice = restoring ? row.oldPrice : row.nextOldPrice;
        if (current.price === price && current.oldPrice === oldPrice) { unchanged++; continue; }
        const expectedPrice = restoring ? row.nextPrice : row.price;
        const expectedOldPrice = restoring ? row.nextOldPrice : row.oldPrice;
        if (current.price !== expectedPrice || current.oldPrice !== expectedOldPrice) {
          throw new Error(`${row.id}: precio cambiado desde la vista previa. Se cancela todo el lote.`);
        }
        if (!restoring && current.updatedAt.toISOString() !== row.updatedAt) {
          throw new Error(`${row.id}: producto modificado desde la vista previa. Pausá la sincronización y revisá.`);
        }
        const updated = await tx.product.updateMany({
          where: { id: row.id, price: expectedPrice, oldPrice: expectedOldPrice, updatedAt: current.updatedAt, deletedAt: null },
          data: { price, oldPrice },
        });
        if (updated.count !== 1) throw new Error(`${row.id}: actualización concurrente; lote cancelado.`);
        changed++;
      }
      return { changed, unchanged };
    }, { isolationLevel: 'Serializable', timeout: 300000, maxWait: 10000 });
    console.log(mode, result, 'Pedidos históricos y ofertas independientes sin cambios.');
  }
} finally {
  await db.$disconnect();
}

function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('No hay productos Cuántico para corregir.');
  const ids = new Set();
  for (const row of rows) {
    if (typeof row.id !== 'string' || !row.id.startsWith('cuantico-') || ids.has(row.id)
      || !Number.isSafeInteger(row.price) || row.price <= 0 || row.price > 2147483647
      || row.nextPrice !== Math.round(row.price / 10) || row.nextPrice <= 0
      || (row.oldPrice !== null && (!Number.isSafeInteger(row.oldPrice) || row.oldPrice <= 0 || row.oldPrice > 2147483647))
      || row.nextOldPrice !== (row.oldPrice === null ? null : Math.round(row.oldPrice / 10))
      || (row.nextOldPrice !== null && row.nextOldPrice <= row.nextPrice)
      || !Number.isFinite(Date.parse(row.updatedAt))) {
      throw new Error(`Fila inválida o precio anterior inconsistente: ${row.id}. Revisar antes de aplicar.`);
    }
    ids.add(row.id);
  }
}
