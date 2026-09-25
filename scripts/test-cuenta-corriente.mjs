import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Node >=22.13. Sin red, paquetes adicionales ni conexión a PostgreSQL.
const load = async (path) => import(`data:text/javascript;base64,${Buffer.from(
  stripTypeScriptTypes(readFileSync(new URL(path, import.meta.url), 'utf8'))
).toString('base64')}`);

const {
  isCuentaCorriente,
  normalizeCommercialCondition,
  parseKommoContactWebhook,
} = await load('../src/lib/commercial-condition.ts');
const { parseArsAmount, parseWholesaleSheet } = await load('../src/lib/wholesale-import.ts');

// Condición comercial: tolera mayúsculas, acentos y espacios.
assert.equal(normalizeCommercialCondition('  cuenta   CORRIENTE '), 'Cuenta corriente');
assert.equal(normalizeCommercialCondition('Débito'), 'Debito');
assert.equal(normalizeCommercialCondition(''), undefined);
assert.equal(normalizeCommercialCondition('Otra condición'), 'Otra condición');
assert.equal(isCuentaCorriente('Cuenta Corriente'), true);
assert.equal(isCuentaCorriente('Contado efectivo'), false);
assert.equal(isCuentaCorriente(undefined), false);

// Webhook de Kommo (x-www-form-urlencoded, formato de "Contacto modificado").
const webhook = new URLSearchParams({
  'contacts[update][0][id]': '31337',
  'contacts[update][0][name]': 'Juan Pérez',
  'contacts[update][0][custom_fields][0][id]': '111',
  'contacts[update][0][custom_fields][0][name]': 'Teléfono',
  'contacts[update][0][custom_fields][0][code]': 'PHONE',
  'contacts[update][0][custom_fields][0][values][0][value]': '+54 9 343 555-1234',
  'contacts[update][0][custom_fields][0][values][0][enum]': '1',
  'contacts[update][0][custom_fields][1][id]': '222',
  'contacts[update][0][custom_fields][1][name]': 'Condición comercial',
  'contacts[update][0][custom_fields][1][values][0][value]': 'Cuenta corriente',
  'contacts[update][0][custom_fields][1][values][0][enum]': '9',
  // Contacto sin el campo: no debe tocar la condición guardada.
  'contacts[update][1][id]': '42',
  'contacts[update][1][name]': 'Sin campo',
  // Intento de contaminar prototipos: se ignora.
  'contacts[__proto__][polluted]': 'yes',
  'account[subdomain]': 'contactoavicoladonramoncomar',
});
assert.deepEqual(parseKommoContactWebhook(webhook), [
  { kommoContactId: '31337', phones: ['+54 9 343 555-1234'], commercialCondition: 'Cuenta corriente' },
]);
assert.equal({}.polluted, undefined);
// Con ID de campo configurado se ignora el nombre.
assert.deepEqual(parseKommoContactWebhook(webhook, { fieldId: '999' }), []);
assert.equal(parseKommoContactWebhook(webhook, { fieldId: '222' })[0].commercialCondition, 'Cuenta corriente');
// Campo presente pero vacío = "Sin definir".
const cleared = new URLSearchParams({
  'contacts[update][0][id]': '5',
  'contacts[update][0][custom_fields][0][id]': '222',
  'contacts[update][0][custom_fields][0][name]': 'Condicion comercial',
});
assert.equal(parseKommoContactWebhook(cleared)[0].commercialCondition, 'Sin definir');
assert.deepEqual(parseKommoContactWebhook(new URLSearchParams('leads[update][0][id]=1')), []);

// Montos en pesos.
assert.equal(parseArsAmount('$ 38.500'), 38500);
assert.equal(parseArsAmount('38500'), 38500);
assert.equal(parseArsAmount('38.500,50'), 38501);
assert.equal(parseArsAmount('1.250.000'), 1250000);
assert.equal(parseArsAmount('817.5'), 818);
assert.equal(parseArsAmount('abc'), undefined);

// Pegado desde Excel con encabezados en cualquier orden.
let sheet = parseWholesaleSheet([
  'Código\tProducto\tPrecio mayorista\tStock\tCategoría',
  'R15\tCaja pata muslo Resistire x15 kg\t$ 35.000\t20\tCajones',
  'N20\tCaja pata muslo Noelma x20 kg\t52.000\t\tCajones',
  '\tSin precio\t\t3\t',
  '',
].join('\n'));
assert.deepEqual(sheet.rows, [
  { code: 'R15', name: 'Caja pata muslo Resistire x15 kg', description: undefined, category: 'Cajones', price: 35000, stock: 20 },
  { code: 'N20', name: 'Caja pata muslo Noelma x20 kg', description: undefined, category: 'Cajones', price: 52000, stock: null },
]);
assert.deepEqual(sheet.errors, ['Fila 4 (Sin precio): precio inválido.']);

// Sin encabezados y separado por ";": Nombre; Precio; Stock; Categoría; Código.
sheet = parseWholesaleSheet('Pechuga x kg;7.900;;Cortes\r\nAlas x kg;4500;-1');
assert.equal(sheet.rows.length, 1);
assert.equal(sheet.rows[0].stock, null);
assert.deepEqual(sheet.errors, ['Fila 2 (Alas x kg): stock inválido.']);

// Sin columna de stock: se conserva el stock existente.
sheet = parseWholesaleSheet('Nombre\tPrecio\nMilanesas x kg\t9800');
assert.equal(sheet.rows[0].stock, undefined);

console.log('OK: cuenta corriente, webhook de Kommo e importación mayorista');
