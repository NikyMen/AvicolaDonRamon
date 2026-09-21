// Ejecutar con pnpm exec node scripts/repair-cuantico-prices.mjs ...
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const USO = [
  'Uso:',
  '  pnpm exec node scripts/repair-cuantico-prices.mjs preview precios-respaldo.json --divisor=1000 [--min-precio=N]',
  '  pnpm exec node scripts/repair-cuantico-prices.mjs apply|restore precios-respaldo.json',
].join('\n');
const DIVISORES = [10, 100, 1000];

/** Umbral por defecto: solo corrige precios tan grandes que la escala inflada es indudable. */
export function defaultMinPrice(divisor) {
  return divisor * 1000;
}

export function parseArgs(argv) {
  const [mode, file, ...flags] = argv;
  if (!['preview', 'apply', 'restore'].includes(mode) || !file) throw new Error(USO);
  if (mode !== 'preview' && flags.length) throw new Error(`${mode} usa el divisor y el umbral guardados en el respaldo.\n${USO}`);
  let divisor;
  let minPrice;
  for (const flag of flags) {
    const divisorFlag = /^--divisor=(\d+)$/.exec(flag);
    const minFlag = /^--min-precio=(\d+)$/.exec(flag);
    if (divisorFlag && divisor === undefined) divisor = Number(divisorFlag[1]);
    else if (minFlag && minPrice === undefined) minPrice = Number(minFlag[1]);
    else throw new Error(`Opción inválida o repetida: ${flag}\n${USO}`);
  }
  if (mode === 'preview') {
    if (!DIVISORES.includes(divisor)) throw new Error(`--divisor debe ser ${DIVISORES.join(', ')} (1000 quita tres ceros).\n${USO}`);
    if (minPrice === undefined) minPrice = defaultMinPrice(divisor);
    if (!Number.isSafeInteger(minPrice) || minPrice < 0) throw new Error('--min-precio debe ser un entero mayor o igual a cero.');
  }
  return { mode, file, divisor, minPrice };
}

/**
 * Separa los productos a corregir de los que quedan intactos. Nunca se infiere la
 * escala: el umbral lo decide quien ejecuta y el preview lista ambos grupos.
 */
export function buildPlan(products, { divisor, minPrice }) {
  const skippedZeroPrice = [];
  const skippedBelowMin = [];
  const rows = [];
  for (const product of products) {
    const updatedAt = product.updatedAt instanceof Date ? product.updatedAt.toISOString() : product.updatedAt;
    if (product.price === 0) {
      skippedZeroPrice.push({ ...product, updatedAt });
      continue;
    }
    if (product.price < minPrice) {
      skippedBelowMin.push({ ...product, updatedAt });
      continue;
    }
    rows.push({
      ...product,
      updatedAt,
      nextPrice: Math.round(product.price / divisor),
      nextOldPrice: product.oldPrice === null || product.oldPrice === undefined ? null : Math.round(product.oldPrice / divisor),
    });
  }
  return { rows, skippedZeroPrice, skippedBelowMin };
}

export function validateRows(rows, divisor, minPrice) {
  if (!DIVISORES.includes(divisor)) throw new Error('Divisor inválido en el respaldo.');
  if (!Number.isSafeInteger(minPrice) || minPrice < 0) throw new Error('Umbral inválido en el respaldo.');
  if (!Array.isArray(rows) || !rows.length) throw new Error('No hay productos Cuántico para corregir con ese divisor y umbral.');
  const ids = new Set();
  for (const row of rows) {
    if (typeof row.id !== 'string' || !row.id.startsWith('cuantico-') || ids.has(row.id)
      || !Number.isSafeInteger(row.price) || row.price <= 0 || row.price > 2147483647 || row.price < minPrice
      || row.nextPrice !== Math.round(row.price / divisor) || row.nextPrice <= 0
      || (row.oldPrice !== null && (!Number.isSafeInteger(row.oldPrice) || row.oldPrice <= 0 || row.oldPrice > 2147483647))
      || row.nextOldPrice !== (row.oldPrice === null ? null : Math.round(row.oldPrice / divisor))
      || (row.nextOldPrice !== null && row.nextOldPrice <= row.nextPrice)
      || !Number.isFinite(Date.parse(row.updatedAt))) {
      throw new Error(`Fila inválida, por debajo del umbral o precio anterior inconsistente: ${row.id}. Revisar antes de aplicar.`);
    }
    ids.add(row.id);
  }
}

export function planFromFile(plan) {
  // version 1 fue siempre divisor 10 sobre todos los precios distintos de cero.
  if (plan?.version === 1) return { ...plan, divisor: 10, minPrice: 1 };
  if (plan?.version !== 2 || !DIVISORES.includes(plan.divisor)) throw new Error('Formato de respaldo inválido.');
  return plan;
}

async function main() {
  const require = createRequire(import.meta.url);
  const nextRequire = createRequire(require.resolve('next/package.json'));
  nextRequire('@next/env').loadEnvConfig(process.cwd(), false);
  const { mode, file, divisor, minPrice } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL. Ejecutar desde la carpeta del proyecto.');
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  const path = resolve(file);
  try {
    if (mode === 'preview') {
      const products = await db.product.findMany({
        where: { id: { startsWith: 'cuantico-' }, deletedAt: null },
        select: { id: true, name: true, price: true, oldPrice: true, updatedAt: true },
        orderBy: { id: 'asc' },
      });
      const { rows, skippedZeroPrice, skippedBelowMin } = buildPlan(products, { divisor, minPrice });
      console.log(`${skippedZeroPrice.length} productos con precio cero omitidos; quedan sin cambios.`);
      console.log(`${skippedBelowMin.length} productos por debajo de ${minPrice} omitidos; quedan sin cambios.`);
      validateRows(rows, divisor, minPrice);
      await writeFile(path, JSON.stringify({ version: 2, divisor, minPrice, createdAt: new Date().toISOString(), skippedZeroPrice, skippedBelowMin, rows }, null, 2), { flag: 'wx', mode: 0o600 });
      console.table(rows.slice(0, 20).map(({ id, name, price, nextPrice }) => ({ id, name, antes: price, despues: nextPrice })));
      console.log(`${rows.length} productos a dividir por ${divisor}. Vista previa y respaldo completo: ${path}`);
      console.log('Sin cambios en la base. Revisá el archivo: la división afecta a TODOS los productos listados en "rows", incluidos sus precios anteriores.');
      console.log('Los omitidos quedan en "skippedZeroPrice" y "skippedBelowMin"; si alguno debía corregirse, bajá --min-precio y generá otra vista previa en un archivo nuevo.');
    } else {
      const plan = planFromFile(JSON.parse(await readFile(path, 'utf8')));
      validateRows(plan.rows, plan.divisor, plan.minPrice);
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
      console.log(mode, `divisor ${plan.divisor}`, result, 'Pedidos históricos y ofertas independientes sin cambios.');
    }
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
