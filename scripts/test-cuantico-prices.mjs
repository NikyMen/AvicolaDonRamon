import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Node >=22.13. Sin red, paquetes adicionales ni conexión a PostgreSQL.
const sourceUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const policyUrl = sourceUrl(stripTypeScriptTypes(readFileSync(new URL('../src/lib/cuantico-pricing.ts', import.meta.url), 'utf8')));
const { cuanticoPricePolicy, validatedCuanticoPrice } = await import(policyUrl);

const policy = cuanticoPricePolicy({ CUANTICO_PRICE_DIVISOR: '10' });
assert.equal(validatedCuanticoPrice(385000, 38500, policy), 38500);
assert.equal(validatedCuanticoPrice(379500, 37950, policy), 37950);
assert.equal(validatedCuanticoPrice(36000, undefined, policy), 3600);
assert.equal(validatedCuanticoPrice(400000, 38500, policy), 40000);
// Repetir una importación nunca vuelve a dividir el precio ya guardado.
let stored = 38500;
for (let i = 0; i < 5; i++) stored = validatedCuanticoPrice(385000, stored, policy);
assert.equal(stored, 38500);
// Si la fuente cambia de escala, conservar la base bloqueando el lote.
assert.throws(() => validatedCuanticoPrice(38500, 38500, policy), /Variación/);
assert.throws(() => validatedCuanticoPrice(3850000, 38500, policy), /Variación/);
assert.throws(() => validatedCuanticoPrice(0, undefined, policy), /rango/);
assert.throws(() => cuanticoPricePolicy({ CUANTICO_PRICE_DIVISOR: '' }), /debe/);
assert.throws(() => cuanticoPricePolicy({ CUANTICO_MAX_PRICE_CHANGE_PERCENT: 'NaN' }), /debe/);
assert.equal(validatedCuanticoPrice(38500, 38500, cuanticoPricePolicy({})), 38500);

// Divisor 1000: el origen trae tres ceros de más y el precio guardado ya es el real.
const milPolicy = cuanticoPricePolicy({ CUANTICO_PRICE_DIVISOR: '1000' });
assert.equal(validatedCuanticoPrice(3600000, 3600, milPolicy), 3600);
assert.equal(validatedCuanticoPrice(147500000, undefined, milPolicy), 147500);
assert.throws(() => validatedCuanticoPrice(3600, 3600, milPolicy), /Variación/);
assert.throws(() => cuanticoPricePolicy({ CUANTICO_PRICE_DIVISOR: '500' }), /debe/);

// Verifica el importador real con dobles: ninguna escritura si una fila es anómala.
process.env.CUANTICO_ID_EMPRESA = 'test';
process.env.CUANTICO_TOKEN = 'test';
process.env.CUANTICO_PRICE_DIVISOR = '10';
const repoUrl = sourceUrl(`
export const listProducts = async () => globalThis.priceTestProducts;
export const updateProduct = async (id, data) => { globalThis.priceTestWrites++; return { id, ...data }; };
export const createProduct = async () => { throw new Error('Creación inesperada'); };
`);
const importer = stripTypeScriptTypes(readFileSync(new URL('../src/lib/cuantico.ts', import.meta.url), 'utf8'))
  .replace('import "server-only";', '')
  .replace('"@/lib/repo"', JSON.stringify(repoUrl))
  .replace('"@/lib/cuantico-pricing"', JSON.stringify(policyUrl));
const { syncCuanticoProducts, parseCuanticoPrice } = await import(sourceUrl(importer));
assert.equal(parseCuanticoPrice('817.0000'), 817);
assert.equal(parseCuanticoPrice('385000.0000'), 385000);
globalThis.priceTestWrites = 0;
const products = [
  { id: 'cuantico-1', name: 'A', price: 38500, image: '', createdAt: new Date(), updatedAt: new Date() },
  { id: 'cuantico-2', name: 'B', price: 42000, image: '', createdAt: new Date(), updatedAt: new Date() },
];
globalThis.priceTestProducts = products;
let rows = [{ id: 1, nombre: 'A', precio: 385000 }, { id: 2, nombre: 'B', precio: 4200000 }];
globalThis.fetch = async () => ({ ok: true, json: async () => rows });
await assert.rejects(syncCuanticoProducts(), /sin cambios/);
assert.equal(globalThis.priceTestWrites, 0);
rows[1].precio = 420000;
assert.equal((await syncCuanticoProducts()).updated, 2);
assert.equal(globalThis.priceTestWrites, 2);
rows = [rows[0], rows[0]];
await assert.rejects(syncCuanticoProducts(), /duplicado/);
assert.equal(globalThis.priceTestWrites, 2);
// Corrección masiva: selección por umbral, divisor y validación del respaldo.
const { parseArgs, buildPlan, validateRows, defaultMinPrice, planFromFile } = await import('./repair-cuantico-prices.mjs');
assert.deepEqual(parseArgs(['preview', 'x.json', '--divisor=1000']), { mode: 'preview', file: 'x.json', divisor: 1000, minPrice: 1000000 });
assert.deepEqual(parseArgs(['preview', 'x.json', '--divisor=1000', '--min-precio=500000']), { mode: 'preview', file: 'x.json', divisor: 1000, minPrice: 500000 });
assert.deepEqual(parseArgs(['apply', 'x.json']), { mode: 'apply', file: 'x.json', divisor: undefined, minPrice: undefined });
assert.throws(() => parseArgs(['preview', 'x.json']), /divisor/);
assert.throws(() => parseArgs(['preview', 'x.json', '--divisor=3']), /divisor/);
assert.throws(() => parseArgs(['apply', 'x.json', '--divisor=1000']), /respaldo/);
assert.equal(defaultMinPrice(1000), 1000000);

const fecha = new Date('2026-09-20T12:00:00.000Z');
const catalogo = [
  { id: 'cuantico-1', name: 'Pata muslo', price: 3600000, oldPrice: null, updatedAt: fecha },
  { id: 'cuantico-2', name: 'Caja pechuga', price: 147500000, oldPrice: 150000000, updatedAt: fecha },
  { id: 'cuantico-3', name: 'Ya corregido', price: 9500, oldPrice: null, updatedAt: fecha },
  { id: 'cuantico-4', name: 'VARIOS', price: 0, oldPrice: null, updatedAt: fecha },
];
const plan = buildPlan(catalogo, { divisor: 1000, minPrice: defaultMinPrice(1000) });
assert.deepEqual(plan.rows.map(r => [r.id, r.nextPrice, r.nextOldPrice]), [['cuantico-1', 3600, null], ['cuantico-2', 147500, 150000]]);
assert.deepEqual(plan.skippedBelowMin.map(r => r.id), ['cuantico-3']);
assert.deepEqual(plan.skippedZeroPrice.map(r => r.id), ['cuantico-4']);
validateRows(plan.rows, 1000, defaultMinPrice(1000));
// Un precio ya corregido no puede colarse en el lote ni volver a dividirse.
assert.throws(() => validateRows([...plan.rows, { ...catalogo[2], updatedAt: fecha.toISOString(), nextPrice: 10, nextOldPrice: null }], 1000, defaultMinPrice(1000)), /umbral/);
assert.throws(() => validateRows(plan.rows, 1000, 200000000), /umbral/);
assert.throws(() => validateRows(plan.rows, 10, defaultMinPrice(1000)), /inconsistente/);
assert.throws(() => validateRows([], 1000, 1000000), /No hay productos/);
assert.equal(planFromFile({ version: 1, divisor: 10, rows: [] }).minPrice, 1);
assert.throws(() => planFromFile({ version: 2, divisor: 7, rows: [] }), /Formato/);

console.log('OK: escala, reimportación, cambio anómalo, decimales, lote bloqueado sin escrituras y corrección masiva por umbral.');
