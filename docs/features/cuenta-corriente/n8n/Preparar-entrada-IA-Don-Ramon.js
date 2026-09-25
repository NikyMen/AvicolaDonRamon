const base = $('Preparar contexto Don Ramon').first().json;
const response = $input.first().json ?? {};
const context = response.data ?? {};
const business = context.business ?? {};

const clean = (value) =>
  String(value ?? '').replace(/\s+/g, ' ').trim();

// La web decide la lista según la condición comercial sincronizada con Kommo.
const wholesale = (context.pricing?.priceList ?? business.priceList) === 'mayorista';
const commercialCondition =
  context.contact?.commercialCondition || base.commercialCondition || 'Sin definir';

const lines = [
  '=== MENSAJE DEL CLIENTE ===',
  clean(base.text),
  '',
  '=== IDENTIFICACIÓN DEL CLIENTE ===',
  `Nombre: ${clean(base.name || 'No informado')}`,
  `Teléfono: ${clean(base.phone || 'No informado')}`,
  `Lead ID: ${clean(base.leadId || 'No informado')}`,
  `Condición comercial: ${clean(commercialCondition)}`,
  '',
  '=== LISTA DE PRECIOS ===',
  wholesale
    ? 'LISTA: MAYORISTA (cliente en cuenta corriente)'
    : 'LISTA: MINORISTA',
  ...(wholesale && context.pricing?.instruction
    ? [clean(context.pricing.instruction)]
    : []),
  '',
  '=== BASE DE CONOCIMIENTO ===',
];

for (const item of context.knowledge ?? []) {
  lines.push(
    `TEMA: ${clean(item.title)}`,
    clean(item.content),
    ''
  );
}

lines.push('=== INFORMACIÓN COMERCIAL ===');

if (!wholesale && business.superOffer?.active) {
  const offer = business.superOffer;

  lines.push(
    `SUPEROFERTA: ${clean(offer.title)} - $${offer.price}` +
      (offer.oldPrice ? ` antes $${offer.oldPrice}` : '')
  );
}

if (!wholesale && business.offers?.length) {
  lines.push('OFERTAS VIGENTES:');

  for (const offer of business.offers) {
    lines.push(
      `${clean(offer.title || offer.name)} | ` +
        `${clean(offer.description || '')} | ` +
        `Precio: $${offer.price ?? '-'}`
    );
  }
}

if (business.delivery) {
  const delivery = business.delivery;

  const deliveryCost = delivery.freeAllSlots
    ? 'GRATIS'
    : delivery.pricing === 'flat'
      ? `$${delivery.flatFee ?? 0}`
      : 'Se calcula según distancia';

  lines.push(
    `ENVÍO: ${deliveryCost}`,
    `COBERTURA: ${clean(delivery.coverage)}`,
    `MÍNIMO DE COMPRA: $${delivery.minimumOrder ?? 0}`,
    `ENVÍO SÁBADOS: ${
      delivery.freeSaturday
        ? 'Bonificado'
        : 'Según tarifa configurada'
    }`,
    `CORTE COLONIA AVELLANEDA: ${clean(
      delivery.orderCutoffs?.coloniaAvellaneda ||
        'Consultar disponibilidad'
    )}`,
    `CORTE SAN BENITO: ${clean(
      delivery.orderCutoffs?.sanBenito ||
        'Consultar disponibilidad'
    )}`
  );
}

if (business.branches?.length) {
  lines.push('', '=== LOCALES Y HORARIOS ===');

  for (const branch of business.branches) {
    const hours = branch.hours ?? {};

    lines.push(
      `LOCAL: ${clean(branch.name)}`,
      `DIRECCIÓN: ${clean(branch.address)}`,
      `LUNES A VIERNES: ${clean(hours.weekdays)}`,
      `SÁBADOS: ${clean(hours.saturday)}`,
      `DOMINGOS: ${clean(hours.sunday)}`,
      `RETIRO: ${clean(
        hours.pickup || 'Dentro del horario de atención'
      )}`,
      `WHATSAPP: ${clean(
        hours.whatsapp || 'Dentro del horario de atención'
      )}`,
      ''
    );
  }
}

lines.push(
  '',
  wholesale
    ? '=== PRODUCTOS DE LA LISTA MAYORISTA ==='
    : '=== PRODUCTOS DEL CATÁLOGO ==='
);

const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const stopWords = new Set([
  'que',
  'quiero',
  'tenes',
  'tienen',
  'precio',
  'precios',
  'para',
  'con',
  'sin',
  'por',
  'del',
  'una',
  'uno',
  'lista',
  'pasame',
  'hola',
  'buenas',
  'necesito',
]);

const message = normalize(base.text);

const terms = message
  .split(/[^a-z0-9]+/)
  .filter(
    (term) => term.length >= 3 && !stopWords.has(term)
  );

const isCatalogRequest =
  /lista|catalogo|catalog|todos|productos|precios|que tienen/.test(
    message
  );

const rankedProducts = [];

for (const product of business.products ?? []) {
  if (!product.available) continue;

  const searchableText = normalize(
    `${product.name} ${product.category} ${product.description}`
  );

  const score = terms.reduce(
    (total, term) =>
      total + (searchableText.includes(term) ? 1 : 0),
    0
  );

  rankedProducts.push({
    product,
    score,
  });
}

rankedProducts.sort((a, b) => b.score - a.score);

const maxProducts = isCatalogRequest ? 60 : 30;

const selectedProducts = rankedProducts
  .filter((item) => isCatalogRequest || item.score > 0)
  .slice(0, maxProducts);

if (selectedProducts.length === 0) {
  lines.push(
    wholesale
      ? 'No se encontró una coincidencia en la lista mayorista. Derivá la consulta a una persona.'
      : 'No se encontró una coincidencia exacta en el catálogo recibido.'
  );
} else {
  for (const item of selectedProducts) {
    const product = item.product;

    // En la lista mayorista el stock puede no controlarse (inStock lo resuelve la web).
    const stockLabel =
      (product.inStock ?? Number(product.stock) > 0)
        ? 'DISPONIBLE'
        : 'SIN STOCK';

    lines.push(
      `${clean(product.name)} | ` +
        (product.description && product.description !== product.name
          ? `${clean(product.description)} | `
          : '') +
        `ID: ${clean(product.id)} | ` +
        `Precio: $${product.price ?? '-'} | ` +
        `Estado: ${stockLabel} | ` +
        `Categoría: ${clean(product.category)}`
    );
  }
}

if (base.currentLead) {
  lines.push(
    '',
    '=== ETAPA CRM ===',
    `Pipeline: ${base.currentLead.pipeline_id ?? '-'}`,
    `Etapa: ${base.currentLead.status_id ?? '-'}`
  );
}

return [
  {
    json: {
      ...base,
      commercialCondition,
      priceList: wholesale ? 'mayorista' : 'minorista',
      contextAvailable: Boolean(context.business),
      shouldReply: context.assistant?.shouldReply === true,
      aiInput: lines.join('\n'),
    },
  },
];
