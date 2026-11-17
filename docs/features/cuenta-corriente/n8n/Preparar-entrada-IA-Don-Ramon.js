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

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const dayList = (days) =>
  (days ?? []).map((day) => DAY_NAMES[day]).filter(Boolean).join(', ');

if (business.delivery && business.delivery.enabled !== false) {
  const delivery = business.delivery;

  const deliveryCost = delivery.freeAllSlots
    ? 'GRATIS'
    : delivery.pricing === 'flat'
      ? `$${delivery.flatFee ?? 0}`
      : 'Se calcula según distancia';

  lines.push(
    `ENVÍO: ${deliveryCost}`,
    `COBERTURA: ${clean(delivery.coverage) || 'Consultar'}`,
    `MÍNIMO DE COMPRA: $${delivery.minimumOrder ?? 0}`
  );
  // Formato actual: días de la semana (0 = domingo). freeSaturday es el anterior.
  const freeDays = dayList(delivery.freeDays);
  if (freeDays) lines.push(`ENVÍO BONIFICADO: ${freeDays}`);
  else if (delivery.freeSaturday) lines.push('ENVÍO SÁBADOS: Bonificado');
  const noDelivery = dayList(delivery.noDeliveryWeekdays);
  if (noDelivery) lines.push(`SIN REPARTO: ${noDelivery}`);
  if (delivery.noDeliveryDates?.length) lines.push(`SIN REPARTO (fechas): ${delivery.noDeliveryDates.join(', ')}`);
  for (const [zone, cutoff] of Object.entries(delivery.orderCutoffs ?? {})) {
    lines.push(`CORTE ${clean(zone).toUpperCase()}: ${clean(cutoff)}`);
  }
} else if (business.delivery) {
  lines.push('ENVÍO: No disponible, solo retiro en el local');
}

if (business.branches?.length) {
  lines.push('', '=== LOCALES Y HORARIOS ===');

  for (const branch of business.branches) {
    const hours = branch.hours ?? {};
    lines.push(`LOCAL: ${clean(branch.name)}`, `DIRECCIÓN: ${clean(branch.address)}`);

    if (Array.isArray(hours)) {
      // Formato actual: los renglones de Configuración → Horarios.
      for (const line of hours) lines.push(`HORARIO: ${clean(line)}`);
    } else {
      lines.push(
        `LUNES A VIERNES: ${clean(hours.weekdays)}`,
        `SÁBADOS: ${clean(hours.saturday)}`,
        `DOMINGOS: ${clean(hours.sunday)}`,
        `RETIRO: ${clean(hours.pickup || 'Dentro del horario de atención')}`,
        `WHATSAPP: ${clean(hours.whatsapp || 'Dentro del horario de atención')}`
      );
    }
    lines.push('');
  }
}

// Solo productos activos: los pausados o sin stock no se le pasan a la IA.
const isActive = (product) =>
  product.available !== false &&
  (product.inStock ?? Number(product.stock) > 0);
const activeProducts = (business.products ?? []).filter(isActive);

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

if (wholesale) {
  // La lista mayorista es corta: va completa y agrupada por categoría para
  // que el asistente vea todas las marcas y presentaciones.
  lines.push(
    '',
    '=== PRODUCTOS DE LA LISTA MAYORISTA ===',
    'Precios en pesos, número entero sin separadores. "XKG" o "POR KG" = precio por kilo. "CAJA ... X15KG" = precio de la caja completa. "FRACCIONADA" = caja fraccionada.'
  );

  if (activeProducts.length === 0) {
    lines.push('La lista mayorista no tiene productos activos. Derivá la consulta a una persona.');
  }

  const byCategory = new Map();
  for (const product of activeProducts) {
    const category = clean(product.category) || 'Otros';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(product);
  }

  for (const [category, products] of byCategory) {
    lines.push(`-- ${category.toUpperCase()} --`);
    for (const product of products) {
      lines.push(
        `${clean(product.name)}` +
          (product.description ? ` (${clean(product.description)})` : '') +
          ` | Precio: $${product.price ?? '-'}`
      );
    }
  }
} else {
  lines.push('', '=== PRODUCTOS DEL CATÁLOGO ===');

  // Búsqueda por palabras: entiende plurales y abreviaturas del catálogo, el
  // nombre pesa más que la descripción, "sin piel" descarta lo que dice
  // "C/PIEL" o "con piel" y "por kg" pone primero lo que se vende suelto.
  const ABBREVIATIONS = {
    hmb: "hamburguesa",
    hamb: "hamburguesa",
    hambur: "hamburguesa",
    hamburg: "hamburguesa",
    mila: "milanesa",
    jyq: "jamon queso",
    rell: "rellena",
    cong: "congelada",
  };
  const NOISE = new Set([
    "sin", "buen", "dia", "tenes", "tene", "hay", "algun", "alguna", "recomenda", "recomienda",
    "recomendame", "cuanto", "sale", "cuesta", "vale", "esta", "estan", "busco", "queria", "kilo",
    "como", "cuando", "donde", "pero", "porque", "sobre", "tiene", "unos", "unas", "buenos", "dias",
    "tardes", "noches", "gracias", "favor", "dame", "decime",
  ]);
  const stem = (term) =>
    term.length > 4 && term.endsWith("es")
      ? term.slice(0, -2)
      : term.length > 3 && term.endsWith("s")
        ? term.slice(0, -1)
        : term;
  const rawWords = (value) =>
    normalize(value)
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  const words = (value) =>
    rawWords(value)
      .flatMap((word) => (ABBREVIATIONS[word] ?? word).split(" "))
      .map(stem);
  const hasPair = (list, first, second) =>
    list.some((word, index) => first.includes(word) && list[index + 1] === second);
  const matches = (list, term) =>
    list.some((word) => word === term || (term.length >= 4 && word.startsWith(term)));

  const messageWords = rawWords(base.text);
  const searchTerms = [
    ...new Set(
      messageWords
        .flatMap((word) => (ABBREVIATIONS[word] ?? word).split(" "))
        .filter((term) => term.length >= 3 && !stopWords.has(term))
        .map(stem)
        .filter((term) => !NOISE.has(term))
    ),
  ];
  const excluded = messageWords.flatMap((word, index) =>
    word === "sin" && messageWords[index + 1] ? [stem(messageWords[index + 1])] : []
  );
  const perKilo = /\b(por|x|el|al) (kg|kilo)s?\b|\bxkg\b|\bsuelt[oa]s?\b/.test(messageWords.join(" "));

  const rankedProducts = activeProducts.map((product, index) => {
    const nameWords = words(product.name);
    const otherWords = words(`${product.category} ${product.description}`);
    const allWords = [...nameWords, ...otherWords];
    if (excluded.some((word) => hasPair(allWords, ["c", "con"], word))) {
      return { product, index, score: 0 };
    }
    const score =
      searchTerms.reduce(
        (total, term) => total + (matches(nameWords, term) ? 3 : matches(otherWords, term) ? 1 : 0),
        0
      ) + excluded.filter((word) => hasPair(allWords, ["s", "sin"], word)).length;
    const loose = perKilo && (nameWords.includes("xkg") || hasPair(nameWords, ["x", "por"], "kg"));
    return { product, index, score: score > 0 && loose ? score + 2 : score };
  });

  rankedProducts.sort((a, b) => b.score - a.score || a.index - b.index);

  const maxProducts = isCatalogRequest ? 60 : 30;

  const selectedProducts = rankedProducts
    .filter((item) => isCatalogRequest || item.score > 0)
    .slice(0, maxProducts);

  if (selectedProducts.length === 0) {
    lines.push('No se encontró una coincidencia exacta en el catálogo recibido.');
  }

  for (const { product } of selectedProducts) {
    lines.push(
      `${clean(product.name)} | ` +
        (product.description && product.description !== product.name
          ? `${clean(product.description)} | `
          : '') +
        `ID: ${clean(product.id)} | ` +
        `Precio: $${product.price ?? '-'} | ` +
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
